use near_sdk::borsh::{BorshDeserialize, BorshSerialize};
use near_sdk::json_types::U128;
use near_sdk::serde::{Deserialize, Serialize};
use near_sdk::{env, near, AccountId, Gas, NearToken, PanicOnDefault, Promise, PromiseOrValue};
use std::collections::BTreeMap;

const YEAR: u128 = 31_536_000;
const PRICE_AGE: u64 = 90_000_000_000;
const TRANSFER_GAS: Gas = Gas::from_tgas(20);
const CALLBACK_GAS: Gas = Gas::from_tgas(15);

#[derive(BorshDeserialize, BorshSerialize)]
#[borsh(crate = "near_sdk::borsh")]
struct Asset { decimals: u8, ltv_bps: u16, price_usd6: u128, at_ns: u64 }
#[derive(BorshDeserialize, BorshSerialize)]
#[borsh(crate = "near_sdk::borsh")]
struct Loan { debt: u128, at_sec: u64 }
#[derive(BorshDeserialize, BorshSerialize)]
#[borsh(crate = "near_sdk::borsh")]
struct Installment { owner: AccountId, recipient: AccountId, amount: u128, due_sec: u64, paid: bool }
#[derive(Deserialize)]
#[serde(crate = "near_sdk::serde", tag = "kind", rename_all = "snake_case")]
enum Deposit { Collateral, Pool, Repay, LiquidationCredit, Yield { borrower: AccountId } }
#[derive(Serialize, Deserialize)]
#[serde(crate = "near_sdk::serde")]
pub struct PriceData { pub timestamp: String, pub prices: Vec<PriceItem> }
#[derive(Serialize, Deserialize)]
#[serde(crate = "near_sdk::serde")]
pub struct PriceItem { pub asset_id: String, pub price: Option<OraclePrice> }
#[derive(Serialize, Deserialize)]
#[serde(crate = "near_sdk::serde")]
pub struct OraclePrice { pub multiplier: String, pub decimals: u32 }

#[near(contract_state)]
#[derive(PanicOnDefault)]
pub struct NorenCredit {
    owner: AccountId, oracle: AccountId, yield_source: AccountId, usdc: AccountId, apr_bps: u16,
    assets: BTreeMap<AccountId, Asset>,
    collateral: BTreeMap<(AccountId, AccountId), u128>,
    loans: BTreeMap<AccountId, Loan>,
    credits: BTreeMap<AccountId, u128>,
    lp_balances: BTreeMap<AccountId, u128>,
    liquidity: u128, supplied: u128,
    pending: BTreeMap<AccountId, u64>, nonce: u64,
    installments: BTreeMap<u64, Installment>, next_installment: u64,
}

#[near]
impl NorenCredit {
    #[init]
    pub fn new(owner: AccountId, oracle: AccountId, yield_source: AccountId, usdc: AccountId, apr_bps: u16) -> Self {
        assert!(!env::state_exists(), "ERR_INITIALIZED");
        assert!(apr_bps <= 5_000, "ERR_APR_CAP");
        Self { owner, oracle, yield_source, usdc, apr_bps, assets: BTreeMap::new(), collateral: BTreeMap::new(),
            loans: BTreeMap::new(), credits: BTreeMap::new(), lp_balances: BTreeMap::new(), liquidity: 0, supplied: 0,
            pending: BTreeMap::new(), nonce: 0, installments: BTreeMap::new(), next_installment: 0 }
    }

    pub fn configure_asset(&mut self, token: AccountId, decimals: u8, ltv_bps: u16) {
        assert_eq!(env::predecessor_account_id(), self.owner, "ERR_OWNER_ONLY");
        assert!(decimals <= 24 && ltv_bps > 0 && ltv_bps <= 7_000, "ERR_ASSET_CONFIG");
        let old = self.assets.get(&token);
        self.assets.insert(token, Asset { decimals, ltv_bps,
            price_usd6: old.map_or(0, |x| x.price_usd6), at_ns: old.map_or(0, |x| x.at_ns) });
    }

    /// The oracle contract is the only caller that may set prices.
    pub fn oracle_on_call(&mut self, sender_id: AccountId, data: PriceData, msg: String) {
        let _ = (sender_id, msg);
        assert_eq!(env::predecessor_account_id(), self.oracle, "ERR_ORACLE_ONLY");
        let at: u64 = data.timestamp.parse().expect("ERR_TIMESTAMP");
        let now = env::block_timestamp();
        assert!(at <= now && now - at <= PRICE_AGE, "ERR_STALE_PRICE");
        for item in data.prices {
            let Ok(token) = item.asset_id.parse::<AccountId>() else { continue; };
            let Some(asset) = self.assets.get_mut(&token) else { continue; };
            let Some(price) = item.price else { continue; };
            let n: u128 = price.multiplier.parse().expect("ERR_PRICE");
            assert!(n > 0 && price.decimals <= 32, "ERR_PRICE");
            let usd6 = if price.decimals >= 6 { n / 10u128.pow(price.decimals - 6) }
                else { n.checked_mul(10u128.pow(6 - price.decimals)).expect("ERR_OVERFLOW") };
            assert!(usd6 > 0, "ERR_PRICE");
            asset.price_usd6 = usd6; asset.at_ns = at;
        }
    }

    /// Only a genuine NEP-141 transfer callback can credit collateral.
    pub fn ft_on_transfer(&mut self, sender_id: AccountId, amount: U128, msg: String) -> PromiseOrValue<U128> {
        assert!(amount.0 > 0, "ERR_ZERO");
        let token = env::predecessor_account_id();
        let kind: Deposit = near_sdk::serde_json::from_str(&msg).expect("ERR_MESSAGE");
        let unused = match kind {
            Deposit::Collateral => {
                assert!(self.assets.contains_key(&token), "ERR_ASSET");
                let k = (sender_id, token); let old = self.collateral.get(&k).copied().unwrap_or(0);
                self.collateral.insert(k, old.checked_add(amount.0).expect("ERR_OVERFLOW")); 0
            }
            Deposit::Pool => {
                assert_eq!(token, self.usdc, "ERR_USDC_ONLY");
                self.liquidity = self.liquidity.checked_add(amount.0).expect("ERR_OVERFLOW");
                self.supplied = self.supplied.checked_add(amount.0).expect("ERR_OVERFLOW");
                *self.lp_balances.entry(sender_id).or_default() += amount.0; 0
            }
            Deposit::LiquidationCredit => {
                assert_eq!(token, self.usdc, "ERR_USDC_ONLY");
                let old = self.credits.get(&sender_id).copied().unwrap_or(0);
                self.credits.insert(sender_id, old.checked_add(amount.0).expect("ERR_OVERFLOW")); 0
            }
            Deposit::Repay => {
                assert_eq!(token, self.usdc, "ERR_USDC_ONLY");
                self.ensure_unlocked(&sender_id);
                let mut loan = self.accrued(&sender_id); let paid = amount.0.min(loan.debt);
                loan.debt -= paid; self.loans.insert(sender_id, loan);
                self.liquidity = self.liquidity.checked_add(paid).expect("ERR_OVERFLOW"); amount.0 - paid
            }
            Deposit::Yield { borrower } => {
                assert_eq!(token, self.usdc, "ERR_USDC_ONLY");
                assert_eq!(sender_id, self.yield_source, "ERR_YIELD_SOURCE");
                self.ensure_unlocked(&borrower);
                let mut loan = self.accrued(&borrower); let paid = amount.0.min(loan.debt);
                loan.debt -= paid; self.loans.insert(borrower, loan);
                self.liquidity = self.liquidity.checked_add(paid).expect("ERR_OVERFLOW"); amount.0 - paid
            }
        };
        PromiseOrValue::Value(U128(unused))
    }

    pub fn collateral_of(&self, borrower: AccountId, token: AccountId) -> U128 {
        U128(self.collateral.get(&(borrower, token)).copied().unwrap_or(0))
    }
    pub fn debt(&self, borrower: AccountId) -> U128 { U128(self.accrued(&borrower).debt) }
    pub fn credit_limit(&self, borrower: AccountId) -> U128 { U128(self.power(&borrower, true)) }
    pub fn health_bps(&self, borrower: AccountId) -> U128 {
        let debt = self.accrued(&borrower).debt;
        U128(if debt == 0 { u128::MAX } else { self.power(&borrower, false).saturating_mul(10_000) / debt })
    }
    pub fn pool_status(&self) -> (U128, U128) { (U128(self.liquidity), U128(self.supplied)) }
    pub fn borrow_apr_bps(&self) -> u16 { self.apr_bps }
    pub fn utilization_bps(&self) -> u16 {
        if self.supplied == 0 { 0 } else { ((self.supplied.saturating_sub(self.liquidity) * 10_000) / self.supplied).min(10_000) as u16 }
    }
    pub fn lp_balance(&self, account: AccountId) -> U128 { U128(self.lp_balances.get(&account).copied().unwrap_or(0)) }

    pub fn withdraw_liquidity(&mut self, amount: U128, recipient: AccountId) -> Promise {
        let user = env::predecessor_account_id(); self.ensure_unlocked(&user);
        let held = self.lp_balances.get(&user).copied().unwrap_or(0);
        assert!(amount.0 > 0 && held >= amount.0, "ERR_LP_BALANCE");
        assert!(self.liquidity >= amount.0, "ERR_LIQUIDITY");
        self.lp_balances.insert(user.clone(), held - amount.0);
        self.liquidity -= amount.0; self.supplied -= amount.0;
        let nonce = self.lock(&user);
        self.transfer(&self.usdc, &recipient, amount.0).then(self.callback("on_liquidity_withdraw",
            near_sdk::serde_json::json!({"user":user,"amount":amount,"nonce":nonce})))
    }
    #[private]
    pub fn on_liquidity_withdraw(&mut self, user: AccountId, amount: U128, nonce: u64) -> bool {
        self.unlock(&user, nonce);
        if env::promise_result_checked(0, 1024).is_err() {
            *self.lp_balances.entry(user).or_default() += amount.0;
            self.liquidity += amount.0; self.supplied += amount.0; return false;
        }
        true
    }

    /// Borrow USDC to a NEAR account. Cross-chain merchant delivery requires a subsequent 1Click swap.
    pub fn borrow(&mut self, amount: U128, recipient: AccountId) -> Promise {
        self.borrow_for(env::predecessor_account_id(), amount.0, recipient, None)
    }
    pub fn schedule_pay_in_3(&mut self, total: U128, recipient: AccountId) -> Vec<u64> {
        assert!(total.0 >= 3, "ERR_AMOUNT");
        let owner = env::predecessor_account_id();
        let first = total.0 / 3; let now = env::block_timestamp() / 1_000_000_000;
        let mut ids = vec![];
        for (i, amount) in [first, first, total.0 - first * 2].into_iter().enumerate() {
            let id = self.next_installment; self.next_installment += 1;
            self.installments.insert(id, Installment { owner: owner.clone(), recipient: recipient.clone(),
                amount, due_sec: now + 2_592_000 * i as u64, paid: false }); ids.push(id);
        }
        ids
    }
    pub fn pay_installment(&mut self, id: u64) -> Promise {
        let item = self.installments.get(&id).expect("ERR_INSTALLMENT");
        assert!(!item.paid && env::block_timestamp() / 1_000_000_000 >= item.due_sec, "ERR_NOT_DUE");
        let (owner, amount, recipient) = (item.owner.clone(), item.amount, item.recipient.clone());
        self.installments.get_mut(&id).unwrap().paid = true;
        self.borrow_for(owner, amount, recipient, Some(id))
    }
    pub fn installment(&self, id: u64) -> Option<(AccountId, AccountId, U128, u64, bool)> {
        self.installments.get(&id).map(|x| (x.owner.clone(), x.recipient.clone(), U128(x.amount), x.due_sec, x.paid))
    }

    pub fn withdraw(&mut self, token: AccountId, amount: U128, recipient: AccountId) -> Promise {
        let user = env::predecessor_account_id(); self.ensure_unlocked(&user);
        assert!(amount.0 > 0, "ERR_ZERO");
        let key = (user.clone(), token.clone()); let old = self.collateral.get(&key).copied().unwrap_or(0);
        assert!(old >= amount.0, "ERR_COLLATERAL");
        self.collateral.insert(key, old - amount.0);
        let debt = self.accrued(&user).debt;
        assert!(debt == 0 || self.power(&user, true) >= debt, "ERR_HEALTH");
        let nonce = self.lock(&user);
        self.transfer(&token, &recipient, amount.0).then(self.callback("on_withdraw",
            near_sdk::serde_json::json!({"user":user,"token":token,"amount":amount,"nonce":nonce})))
    }
    #[private]
    pub fn on_withdraw(&mut self, user: AccountId, token: AccountId, amount: U128, nonce: u64) -> bool {
        self.unlock(&user, nonce);
        if env::promise_result_checked(0, 1024).is_err() {
            *self.collateral.entry((user, token)).or_default() += amount.0; return false;
        }
        true
    }
    #[private]
    pub fn on_borrow(&mut self, borrower: AccountId, amount: U128, nonce: u64, installment_id: Option<u64>) -> bool {
        self.unlock(&borrower, nonce);
        if env::promise_result_checked(0, 1024).is_err() {
            self.loans.get_mut(&borrower).unwrap().debt -= amount.0;
            self.liquidity += amount.0;
            if let Some(id) = installment_id { self.installments.get_mut(&id).unwrap().paid = false; }
            return false;
        }
        true
    }

    pub fn liquidate(&mut self, borrower: AccountId, token: AccountId, repay: U128) -> Promise {
        let liquidator = env::predecessor_account_id(); self.ensure_unlocked(&borrower);
        assert!(repay.0 > 0 && self.power(&borrower, true) < self.accrued(&borrower).debt, "ERR_HEALTHY");
        assert!(self.credits.get(&liquidator).copied().unwrap_or(0) >= repay.0, "ERR_PAYMENT");
        assert!(self.accrued(&borrower).debt >= repay.0, "ERR_REPAY_TOO_HIGH");
        let asset = self.fresh_asset(&token);
        let seize = repay.0.checked_mul(10_500).and_then(|n| n.checked_mul(10u128.pow(asset.decimals as u32)))
            .expect("ERR_OVERFLOW") / 10_000 / asset.price_usd6;
        let key = (borrower.clone(), token.clone());
        assert!(seize > 0 && self.collateral.get(&key).copied().unwrap_or(0) >= seize, "ERR_COLLATERAL");
        let nonce = self.lock(&borrower);
        self.transfer(&token, &liquidator, seize).then(self.callback("on_liquidate",
            near_sdk::serde_json::json!({"borrower":borrower,"liquidator":liquidator,"token":token,"repay":repay,"seize":U128(seize),"nonce":nonce})))
    }
    #[private]
    pub fn on_liquidate(&mut self, borrower: AccountId, liquidator: AccountId, token: AccountId, repay: U128, seize: U128, nonce: u64) -> bool {
        self.unlock(&borrower, nonce);
        if env::promise_result_checked(0, 1024).is_err() { return false; }
        *self.collateral.get_mut(&(borrower.clone(), token)).unwrap() -= seize.0;
        let mut loan = self.accrued(&borrower); loan.debt -= repay.0; self.loans.insert(borrower, loan);
        *self.credits.get_mut(&liquidator).unwrap() -= repay.0;
        self.liquidity += repay.0; true
    }

    fn borrow_for(&mut self, borrower: AccountId, amount: u128, recipient: AccountId, installment_id: Option<u64>) -> Promise {
        self.ensure_unlocked(&borrower);
        assert!(amount > 0 && amount <= self.liquidity, "ERR_LIQUIDITY");
        let mut loan = self.accrued(&borrower);
        let next = loan.debt.checked_add(amount).expect("ERR_OVERFLOW");
        assert!(next <= self.power(&borrower, true), "ERR_LTV");
        loan.debt = next; self.loans.insert(borrower.clone(), loan); self.liquidity -= amount;
        let nonce = self.lock(&borrower);
        self.transfer(&self.usdc, &recipient, amount).then(self.callback("on_borrow",
            near_sdk::serde_json::json!({"borrower":borrower,"amount":U128(amount),"nonce":nonce,"installment_id":installment_id})))
    }
    fn accrued(&self, user: &AccountId) -> Loan {
        let now = env::block_timestamp() / 1_000_000_000;
        let Some(old) = self.loans.get(user) else { return Loan { debt: 0, at_sec: now }; };
        let elapsed = now.saturating_sub(old.at_sec) as u128;
        let interest = old.debt.checked_mul(self.apr_bps as u128).and_then(|n| n.checked_mul(elapsed))
            .expect("ERR_OVERFLOW") / 10_000 / YEAR;
        Loan { debt: old.debt.checked_add(interest).expect("ERR_OVERFLOW"), at_sec: now }
    }
    fn power(&self, user: &AccountId, fresh: bool) -> u128 {
        self.collateral.iter().filter(|((u,_),_)| u == user).fold(0u128, |total, ((_,token),amount)| {
            let asset = if fresh { self.fresh_asset(token) } else { self.assets.get(token).expect("ERR_ASSET") };
            let usd6 = amount.checked_mul(asset.price_usd6).expect("ERR_OVERFLOW") / 10u128.pow(asset.decimals as u32);
            total.checked_add(usd6.checked_mul(asset.ltv_bps as u128).expect("ERR_OVERFLOW") / 10_000).expect("ERR_OVERFLOW")
        })
    }
    fn fresh_asset(&self, token: &AccountId) -> &Asset {
        let a = self.assets.get(token).expect("ERR_ASSET"); let now = env::block_timestamp();
        assert!(a.at_ns > 0 && a.at_ns <= now && now - a.at_ns <= PRICE_AGE, "ERR_STALE_PRICE"); a
    }
    fn ensure_unlocked(&self, user: &AccountId) { assert!(!self.pending.contains_key(user), "ERR_PENDING"); }
    fn lock(&mut self, user: &AccountId) -> u64 { self.nonce += 1; self.pending.insert(user.clone(), self.nonce); self.nonce }
    fn unlock(&mut self, user: &AccountId, nonce: u64) { assert_eq!(self.pending.remove(user), Some(nonce), "ERR_CALLBACK_NONCE"); }
    fn transfer(&self, token: &AccountId, recipient: &AccountId, amount: u128) -> Promise {
        Promise::new(token.clone()).function_call("ft_transfer",
            near_sdk::serde_json::to_vec(&near_sdk::serde_json::json!({"receiver_id":recipient,"amount":U128(amount)})).unwrap(),
            NearToken::from_yoctonear(1), TRANSFER_GAS)
    }
    fn callback(&self, method: &str, args: near_sdk::serde_json::Value) -> Promise {
        Promise::new(env::current_account_id()).function_call(method,
            near_sdk::serde_json::to_vec(&args).unwrap(), NearToken::from_yoctonear(0), CALLBACK_GAS)
    }
}
