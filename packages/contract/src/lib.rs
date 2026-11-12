//! Noren credit on NEAR: NEP-141 collateral, a USDC pool, LTV-bounded borrowing paid to any account,
//! repayment, withdrawal and liquidation. Prices arrive either from an oracle contract (`oracle_on_call`,
//! the Rhea/OutLayer mainnet path) or as an ed25519-signed relayer price checked on-chain (testnet path).
use near_sdk::borsh::{BorshDeserialize, BorshSerialize};
use near_sdk::json_types::{Base64VecU8, U128, U64};
use near_sdk::serde::{Deserialize, Serialize};
use near_sdk::{env, near, AccountId, Gas, NearToken, PanicOnDefault, Promise, PromiseOrValue};
use std::collections::BTreeMap;

const YEAR: u128 = 31_536_000;
/// A price older than this blocks borrowing, withdrawal under debt and liquidation. Repayment always works.
const PRICE_AGE: u64 = 90_000_000_000;
/// A signed relayer price may be at most this far ahead of the block clock (exchange vs. chain clock skew).
const FUTURE_SKEW: u64 = 5_000_000_000;
/// Liquidation starts this far above the borrowing LTV, so a max borrow is not liquidatable one second later.
const LIQ_BUFFER_BPS: u128 = 1_000;
const LIQ_CAP_BPS: u128 = 9_000;
const BONUS_BPS: u128 = 10_500;
const TRANSFER_GAS: Gas = Gas::from_tgas(20);
const CALLBACK_GAS: Gas = Gas::from_tgas(15);

#[derive(BorshDeserialize, BorshSerialize)]
#[borsh(crate = "near_sdk::borsh")]
struct Asset { decimals: u8, ltv_bps: u16, price_usd6: u128, at_ns: u64, source: String }
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

#[derive(Serialize)]
#[serde(crate = "near_sdk::serde")]
pub struct AssetView { pub token: AccountId, pub decimals: u8, pub ltv_bps: u16, pub liq_bps: u16, pub price_usd6: U128, pub price_at_ns: U64, pub price_fresh: bool, pub source: String }
#[derive(Serialize)]
#[serde(crate = "near_sdk::serde")]
pub struct CollateralView { pub token: AccountId, pub amount: U128, pub value_usd6: U128 }
#[derive(Serialize)]
#[serde(crate = "near_sdk::serde")]
pub struct PositionView {
    pub borrower: AccountId, pub collateral: Vec<CollateralView>, pub collateral_usd6: U128,
    pub credit_limit_usd6: U128, pub debt_usd6: U128, pub available_usd6: U128,
    /// Σ(collateral × price × liquidation threshold) ÷ debt, in bps. None when there is no debt.
    pub health_bps: Option<U128>, pub prices_fresh: bool, pub pending: bool, pub apr_bps: u16,
}

#[near(contract_state)]
#[derive(PanicOnDefault)]
pub struct NorenCredit {
    owner: AccountId, oracle: AccountId, yield_source: AccountId, usdc: AccountId, apr_bps: u16,
    relayer_key: Option<[u8; 32]>,
    assets: BTreeMap<AccountId, Asset>,
    collateral: BTreeMap<(AccountId, AccountId), u128>,
    loans: BTreeMap<AccountId, Loan>,
    credits: BTreeMap<AccountId, u128>,
    lp_balances: BTreeMap<AccountId, u128>,
    liquidity: u128, supplied: u128,
    pending: BTreeMap<AccountId, u64>, nonce: u64,
    installments: BTreeMap<u64, Installment>, next_installment: u64,
    schema_version: u8,
}

// Exact deployed v1 layout. Kept only for the private, one-way migration.
#[derive(BorshDeserialize, BorshSerialize)]
#[borsh(crate = "near_sdk::borsh")]
struct LegacyCredit {
    owner: AccountId, oracle: AccountId, yield_source: AccountId, usdc: AccountId, apr_bps: u16,
    relayer_key: Option<[u8; 32]>,
    assets: BTreeMap<AccountId, Asset>,
    collateral: BTreeMap<(AccountId, AccountId), u128>,
    loans: BTreeMap<AccountId, Loan>,
    credits: BTreeMap<AccountId, u128>,
    lp_balances: BTreeMap<AccountId, u128>,
    liquidity: u128, supplied: u128,
    pending: BTreeMap<AccountId, u64>, nonce: u64,
    installments: BTreeMap<u64, Installment>, next_installment: u64,
}

fn price_message(contract: &AccountId, token: &AccountId, price_usd6: u128, timestamp_ns: u64, source: &str) -> String {
    format!("noren-price:v1|{contract}|{token}|{price_usd6}|{timestamp_ns}|{source}")
}
fn key32(key: &Base64VecU8) -> [u8; 32] { key.0.as_slice().try_into().expect("ERR_RELAYER_KEY") }

#[near]
impl NorenCredit {
    #[init]
    pub fn new(owner: AccountId, oracle: AccountId, yield_source: AccountId, usdc: AccountId, apr_bps: u16,
        relayer_key: Option<Base64VecU8>) -> Self {
        assert!(!env::state_exists(), "ERR_INITIALIZED");
        assert!(apr_bps <= 5_000, "ERR_APR_CAP");
        Self { owner, oracle, yield_source, usdc, apr_bps, relayer_key: relayer_key.as_ref().map(key32),
            assets: BTreeMap::new(), collateral: BTreeMap::new(), loans: BTreeMap::new(), credits: BTreeMap::new(),
            lp_balances: BTreeMap::new(), liquidity: 0, supplied: 0, pending: BTreeMap::new(), nonce: 0,
            installments: BTreeMap::new(), next_installment: 0, schema_version: 2 }
    }

    /// Deploy and call atomically from the contract account's existing full-access key.
    #[init(ignore_state)]
    #[private]
    pub fn migrate() -> Self {
        assert_eq!(env::predecessor_account_id(), env::current_account_id(), "ERR_SELF_ONLY");
        let old: LegacyCredit = env::state_read().expect("ERR_V1_STATE");
        Self {
            owner: old.owner,
            oracle: old.oracle,
            yield_source: old.yield_source,
            usdc: old.usdc,
            apr_bps: old.apr_bps,
            relayer_key: old.relayer_key,
            assets: old.assets,
            collateral: old.collateral,
            loans: old.loans,
            credits: old.credits,
            lp_balances: old.lp_balances,
            liquidity: old.liquidity,
            supplied: old.supplied,
            pending: old.pending,
            nonce: old.nonce,
            installments: old.installments,
            next_installment: old.next_installment,
            schema_version: 2,
        }
    }

    pub fn configure_asset(&mut self, token: AccountId, decimals: u8, ltv_bps: u16) {
        self.owner_only();
        assert!(decimals <= 24 && ltv_bps > 0 && ltv_bps <= 7_000, "ERR_ASSET_CONFIG");
        let old = self.assets.remove(&token);
        let (price_usd6, at_ns, source) = old.map_or((0, 0, String::new()), |x| (x.price_usd6, x.at_ns, x.source));
        self.assets.insert(token, Asset { decimals, ltv_bps, price_usd6, at_ns, source });
    }
    pub fn set_relayer_key(&mut self, relayer_key: Option<Base64VecU8>) {
        self.owner_only();
        self.relayer_key = relayer_key.as_ref().map(key32);
    }

    /// The oracle contract is the only caller that may set prices this way (Rhea / OutLayer `oracle_call`).
    pub fn oracle_on_call(&mut self, sender_id: AccountId, data: PriceData, msg: String) {
        let _ = (sender_id, msg);
        assert_eq!(env::predecessor_account_id(), self.oracle, "ERR_ORACLE_ONLY");
        let at: u64 = data.timestamp.parse().expect("ERR_TIMESTAMP");
        let now = env::block_timestamp();
        assert!(at <= now && now - at <= PRICE_AGE, "ERR_STALE_PRICE");
        let source = format!("oracle:{}", self.oracle);
        for item in data.prices {
            let Ok(token) = item.asset_id.parse::<AccountId>() else { continue; };
            let Some(price) = item.price else { continue; };
            let n: u128 = price.multiplier.parse().expect("ERR_PRICE");
            assert!(n > 0 && price.decimals <= 32, "ERR_PRICE");
            let usd6 = if price.decimals >= 6 { n / 10u128.pow(price.decimals - 6) }
                else { n.checked_mul(10u128.pow(6 - price.decimals)).expect("ERR_OVERFLOW") };
            if self.assets.contains_key(&token) { self.set_price(&token, usd6, at, source.clone()); }
        }
    }

    /// Anyone may submit a price signed by the configured relayer key. The signature covers this contract,
    /// the token, the price, the exchange timestamp and the source URL, so it cannot be replayed elsewhere,
    /// and a price can only replace an older one.
    pub fn post_signed_price(&mut self, token: AccountId, price_usd6: U128, timestamp_ns: U64, source: String, signature: Base64VecU8) {
        let key = self.relayer_key.expect("ERR_NO_RELAYER");
        assert!(source.len() <= 160, "ERR_SOURCE");
        let message = price_message(&env::current_account_id(), &token, price_usd6.0, timestamp_ns.0, &source);
        let sig: [u8; 64] = signature.0.as_slice().try_into().expect("ERR_SIGNATURE");
        assert!(env::ed25519_verify(&sig, env::sha256(message.as_bytes()), &key), "ERR_SIGNATURE");
        let now = env::block_timestamp();
        let at = timestamp_ns.0;
        assert!(at <= now + FUTURE_SKEW && now.saturating_sub(at) <= PRICE_AGE, "ERR_STALE_PRICE");
        assert!(at > self.assets.get(&token).expect("ERR_ASSET").at_ns, "ERR_PRICE_REPLAY");
        self.set_price(&token, price_usd6.0, at.min(now), format!("relayer:{source}"));
    }
    /// The exact string the relayer signs (sha256 of it). Exposed so the relayer and auditors can check it.
    pub fn signed_price_message(&self, token: AccountId, price_usd6: U128, timestamp_ns: U64, source: String) -> String {
        price_message(&env::current_account_id(), &token, price_usd6.0, timestamp_ns.0, &source)
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
                self.pay_down(sender_id, amount.0)
            }
            // A harvester (the configured yield source) forwards earned yield, already converted to USDC.
            Deposit::Yield { borrower } => {
                assert_eq!(token, self.usdc, "ERR_USDC_ONLY");
                assert_eq!(sender_id, self.yield_source, "ERR_YIELD_SOURCE");
                self.pay_down(borrower, amount.0)
            }
        };
        PromiseOrValue::Value(U128(unused))
    }

    // ------------------------------------------------------------------ views
    pub fn collateral_of(&self, borrower: AccountId, token: AccountId) -> U128 {
        U128(self.collateral.get(&(borrower, token)).copied().unwrap_or(0))
    }
    pub fn debt(&self, borrower: AccountId) -> U128 { U128(self.accrued(&borrower).debt) }
    pub fn credit_limit(&self, borrower: AccountId) -> U128 { U128(self.power(&borrower, true, false)) }
    pub fn health_bps(&self, borrower: AccountId) -> U128 {
        let debt = self.accrued(&borrower).debt;
        U128(if debt == 0 { u128::MAX } else { self.power(&borrower, false, true).saturating_mul(10_000) / debt })
    }
    /// Everything the app needs in one read. Never panics on a stale price; it reports `prices_fresh` instead.
    pub fn position(&self, borrower: AccountId) -> PositionView {
        let now = env::block_timestamp();
        let mut collateral = vec![]; let mut total = 0u128; let mut fresh = true;
        for ((user, token), amount) in self.collateral.iter() {
            if user != &borrower || *amount == 0 { continue; }
            let asset = self.assets.get(token).expect("ERR_ASSET");
            fresh &= Self::is_fresh(asset, now);
            let value = Self::value(asset, *amount);
            total += value;
            collateral.push(CollateralView { token: token.clone(), amount: U128(*amount), value_usd6: U128(value) });
        }
        let limit = self.power(&borrower, false, false);
        let debt = self.accrued(&borrower).debt;
        let health = (debt > 0).then(|| U128(self.power(&borrower, false, true).saturating_mul(10_000) / debt));
        PositionView { borrower: borrower.clone(), collateral, collateral_usd6: U128(total), credit_limit_usd6: U128(limit),
            debt_usd6: U128(debt), available_usd6: U128(limit.saturating_sub(debt).min(self.liquidity)), health_bps: health,
            prices_fresh: fresh, pending: self.pending.contains_key(&borrower), apr_bps: self.apr_bps }
    }
    pub fn assets(&self) -> Vec<AssetView> {
        let now = env::block_timestamp();
        self.assets.iter().map(|(token, a)| AssetView { token: token.clone(), decimals: a.decimals, ltv_bps: a.ltv_bps,
            liq_bps: Self::liq_bps(a) as u16, price_usd6: U128(a.price_usd6), price_at_ns: U64(a.at_ns),
            price_fresh: Self::is_fresh(a, now), source: a.source.clone() }).collect()
    }
    pub fn config(&self) -> near_sdk::serde_json::Value {
        near_sdk::serde_json::json!({ "schema_version": self.schema_version, "owner": self.owner, "oracle": self.oracle, "yield_source": self.yield_source,
            "usdc": self.usdc, "apr_bps": self.apr_bps, "relayer_key": self.relayer_key.map(|k| Base64VecU8(k.to_vec())),
            "price_age_sec": PRICE_AGE / 1_000_000_000, "liq_buffer_bps": LIQ_BUFFER_BPS, "liq_bonus_bps": BONUS_BPS - 10_000 })
    }
    pub fn pool_status(&self) -> (U128, U128) { (U128(self.liquidity), U128(self.supplied)) }
    pub fn borrow_apr_bps(&self) -> u16 { self.apr_bps }
    pub fn utilization_bps(&self) -> u16 {
        if self.supplied == 0 { 0 } else { ((self.supplied.saturating_sub(self.liquidity) * 10_000) / self.supplied).min(10_000) as u16 }
    }
    pub fn lp_balance(&self, account: AccountId) -> U128 { U128(self.lp_balances.get(&account).copied().unwrap_or(0)) }
    pub fn liquidation_credit(&self, account: AccountId) -> U128 { U128(self.credits.get(&account).copied().unwrap_or(0)) }
    pub fn installment(&self, id: u64) -> Option<(AccountId, AccountId, U128, u64, bool)> {
        self.installments.get(&id).map(|x| (x.owner.clone(), x.recipient.clone(), U128(x.amount), x.due_sec, x.paid))
    }
    pub fn installments_of(&self, owner: AccountId) -> Vec<(u64, AccountId, U128, u64, bool)> {
        self.installments.iter().filter(|(_, x)| x.owner == owner)
            .map(|(id, x)| (*id, x.recipient.clone(), U128(x.amount), x.due_sec, x.paid)).collect()
    }

    // ------------------------------------------------------------------ pool
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

    // ------------------------------------------------------------------ credit
    /// Draw USDC from the credit line and pay it to any NEAR account: yourself, or a merchant.
    /// Cross-chain merchant delivery is a 1Click swap of that USDC (mainnet only).
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
    /// Anyone (a keeper) may execute a due instalment; it draws on the owner's credit line under the same LTV rules.
    pub fn pay_installment(&mut self, id: u64) -> Promise {
        let item = self.installments.get(&id).expect("ERR_INSTALLMENT");
        assert!(!item.paid && env::block_timestamp() / 1_000_000_000 >= item.due_sec, "ERR_NOT_DUE");
        let (owner, amount, recipient) = (item.owner.clone(), item.amount, item.recipient.clone());
        self.installments.get_mut(&id).unwrap().paid = true;
        self.borrow_for(owner, amount, recipient, Some(id))
    }

    pub fn withdraw(&mut self, token: AccountId, amount: U128, recipient: AccountId) -> Promise {
        let user = env::predecessor_account_id(); self.ensure_unlocked(&user);
        assert!(amount.0 > 0, "ERR_ZERO");
        let key = (user.clone(), token.clone()); let old = self.collateral.get(&key).copied().unwrap_or(0);
        assert!(old >= amount.0, "ERR_COLLATERAL");
        self.collateral.insert(key, old - amount.0);
        let debt = self.accrued(&user).debt;
        assert!(debt == 0 || self.power(&user, true, false) >= debt, "ERR_HEALTH");
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

    // ------------------------------------------------------------------ liquidation
    /// Repays part of an unhealthy loan from the caller's liquidation credit and pays out collateral
    /// worth the repaid amount plus a 5% bonus. Credit and collateral move before the transfer and are
    /// restored if it fails, so one credit balance cannot fund two concurrent liquidations.
    pub fn liquidate(&mut self, borrower: AccountId, token: AccountId, repay: U128) -> Promise {
        let liquidator = env::predecessor_account_id();
        self.ensure_unlocked(&borrower); self.ensure_unlocked(&liquidator);
        let mut loan = self.accrued(&borrower);
        assert!(repay.0 > 0 && self.power(&borrower, true, true) < loan.debt, "ERR_HEALTHY");
        assert!(loan.debt >= repay.0, "ERR_REPAY_TOO_HIGH");
        let credit = self.credits.get(&liquidator).copied().unwrap_or(0);
        assert!(credit >= repay.0, "ERR_PAYMENT");
        let asset = self.fresh_asset(&token);
        let seize = repay.0.checked_mul(BONUS_BPS).and_then(|n| n.checked_mul(10u128.pow(asset.decimals as u32)))
            .expect("ERR_OVERFLOW") / 10_000 / asset.price_usd6;
        let key = (borrower.clone(), token.clone());
        let held = self.collateral.get(&key).copied().unwrap_or(0);
        assert!(seize > 0 && held >= seize, "ERR_COLLATERAL");
        self.collateral.insert(key, held - seize);
        self.credits.insert(liquidator.clone(), credit - repay.0);
        loan.debt -= repay.0; self.loans.insert(borrower.clone(), loan);
        self.liquidity += repay.0;
        let nonce = self.lock(&borrower);
        self.transfer(&token, &liquidator, seize).then(self.callback("on_liquidate",
            near_sdk::serde_json::json!({"borrower":borrower,"liquidator":liquidator,"token":token,"repay":repay,"seize":U128(seize),"nonce":nonce})))
    }
    #[private]
    pub fn on_liquidate(&mut self, borrower: AccountId, liquidator: AccountId, token: AccountId, repay: U128, seize: U128, nonce: u64) -> bool {
        self.unlock(&borrower, nonce);
        if env::promise_result_checked(0, 1024).is_ok() { return true; }
        *self.collateral.entry((borrower.clone(), token)).or_default() += seize.0;
        *self.credits.entry(liquidator).or_default() += repay.0;
        self.loans.get_mut(&borrower).unwrap().debt += repay.0;
        self.liquidity -= repay.0;
        false
    }
    /// Unused liquidation credit is always withdrawable.
    pub fn withdraw_credit(&mut self, amount: U128) -> Promise {
        let user = env::predecessor_account_id(); self.ensure_unlocked(&user);
        let held = self.credits.get(&user).copied().unwrap_or(0);
        assert!(amount.0 > 0 && held >= amount.0, "ERR_CREDIT");
        self.credits.insert(user.clone(), held - amount.0);
        let nonce = self.lock(&user);
        self.transfer(&self.usdc, &user, amount.0).then(self.callback("on_credit_withdraw",
            near_sdk::serde_json::json!({"user":user,"amount":amount,"nonce":nonce})))
    }
    #[private]
    pub fn on_credit_withdraw(&mut self, user: AccountId, amount: U128, nonce: u64) -> bool {
        self.unlock(&user, nonce);
        if env::promise_result_checked(0, 1024).is_err() { *self.credits.entry(user).or_default() += amount.0; return false; }
        true
    }

    // ------------------------------------------------------------------ internals
    fn owner_only(&self) { assert_eq!(env::predecessor_account_id(), self.owner, "ERR_OWNER_ONLY"); }
    fn set_price(&mut self, token: &AccountId, usd6: u128, at: u64, source: String) {
        assert!(usd6 > 0, "ERR_PRICE");
        let asset = self.assets.get_mut(token).expect("ERR_ASSET");
        asset.price_usd6 = usd6; asset.at_ns = at; asset.source = source;
    }
    fn pay_down(&mut self, borrower: AccountId, amount: u128) -> u128 {
        self.ensure_unlocked(&borrower);
        let mut loan = self.accrued(&borrower); let paid = amount.min(loan.debt);
        loan.debt -= paid; self.loans.insert(borrower, loan);
        self.liquidity = self.liquidity.checked_add(paid).expect("ERR_OVERFLOW");
        amount - paid
    }
    fn borrow_for(&mut self, borrower: AccountId, amount: u128, recipient: AccountId, installment_id: Option<u64>) -> Promise {
        self.ensure_unlocked(&borrower);
        assert!(amount > 0 && amount <= self.liquidity, "ERR_LIQUIDITY");
        let mut loan = self.accrued(&borrower);
        let next = loan.debt.checked_add(amount).expect("ERR_OVERFLOW");
        assert!(next <= self.power(&borrower, true, false), "ERR_LTV");
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
    fn liq_bps(a: &Asset) -> u128 { (a.ltv_bps as u128 + LIQ_BUFFER_BPS).min(LIQ_CAP_BPS) }
    fn value(a: &Asset, amount: u128) -> u128 {
        amount.checked_mul(a.price_usd6).expect("ERR_OVERFLOW") / 10u128.pow(a.decimals as u32)
    }
    fn is_fresh(a: &Asset, now: u64) -> bool { a.at_ns > 0 && a.at_ns <= now && now - a.at_ns <= PRICE_AGE }
    /// Σ(collateral × price × LTV), or × liquidation threshold when `liquidation` is set.
    fn power(&self, user: &AccountId, fresh: bool, liquidation: bool) -> u128 {
        self.collateral.iter().filter(|((u, _), amount)| u == user && **amount > 0).fold(0u128, |total, ((_, token), amount)| {
            let asset = if fresh { self.fresh_asset(token) } else { self.assets.get(token).expect("ERR_ASSET") };
            let bps = if liquidation { Self::liq_bps(asset) } else { asset.ltv_bps as u128 };
            total.checked_add(Self::value(asset, *amount).checked_mul(bps).expect("ERR_OVERFLOW") / 10_000).expect("ERR_OVERFLOW")
        })
    }
    fn fresh_asset(&self, token: &AccountId) -> &Asset {
        let a = self.assets.get(token).expect("ERR_ASSET");
        assert!(Self::is_fresh(a, env::block_timestamp()), "ERR_STALE_PRICE"); a
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

#[cfg(test)]
mod migration_tests {
    use super::*;
    use near_sdk::{test_utils::VMContextBuilder, testing_env};
    #[test]
    fn migration_preserves_v1_loans_assets_balances_and_locks() {
        let id: AccountId = "credit.testnet".parse().unwrap();
        let user: AccountId = "alice.testnet".parse().unwrap();
        let token: AccountId = "ttsla.testnet".parse().unwrap();
        testing_env!(VMContextBuilder::new().current_account_id(id.clone()).predecessor_account_id(id).build());
        let old = LegacyCredit {
            owner: user.clone(), oracle: user.clone(), yield_source: user.clone(), usdc: "usdc.testnet".parse().unwrap(), apr_bps: 1000, relayer_key: Some([7;32]),
            assets: BTreeMap::from([(token.clone(), Asset { decimals: 8, ltv_bps: 4000, price_usd6: 100_000_000, at_ns: 1, source: "pyth:test".into() })]),
            collateral: BTreeMap::from([((user.clone(),token.clone()),100_000_000)]), loans: BTreeMap::from([(user.clone(),Loan { debt: 20_000_000, at_sec: 1 })]),
            credits: BTreeMap::from([(user.clone(),3)]), lp_balances: BTreeMap::from([(user.clone(),400)]), liquidity: 380, supplied: 400,
            pending: BTreeMap::from([(user.clone(),9)]), nonce: 9, installments: BTreeMap::from([(4,Installment{owner:user.clone(),recipient:user.clone(),amount:3,due_sec:2,paid:false})]), next_installment: 5,
        };
        env::state_write(&old);
        let migrated = NorenCredit::migrate();
        assert_eq!(migrated.schema_version,2); assert_eq!(migrated.loans[&user].debt,20_000_000);
        assert_eq!(migrated.collateral[&(user.clone(),token.clone())],100_000_000);
        assert_eq!(migrated.assets[&token].ltv_bps,4000);assert_eq!(migrated.credits[&user],3);
        assert_eq!(migrated.lp_balances[&user],400);assert_eq!(migrated.pending[&user],9);
        assert_eq!(migrated.liquidity,380);assert_eq!(migrated.supplied,400);assert_eq!(migrated.nonce,9);
        assert_eq!(migrated.next_installment,5);assert_eq!(migrated.installments[&4].amount,3);assert_eq!(migrated.relayer_key,Some([7;32]));
    }
}

#[cfg(test)]
mod stock_freshness_tests {
    use super::*;
    use near_sdk::{test_utils::VMContextBuilder, testing_env};
    fn position_state(stock_amount: u128) -> NorenCredit {
        let user:AccountId="alice.testnet".parse().unwrap();
        let id:AccountId="credit.testnet".parse().unwrap();
        testing_env!(VMContextBuilder::new().current_account_id(id).predecessor_account_id(user.clone()).block_timestamp(200_000_000_000).build());
        let btc:AccountId="btc.testnet".parse().unwrap();let stock:AccountId="ttsla.testnet".parse().unwrap();
        NorenCredit { owner:user.clone(),oracle:user.clone(),yield_source:user.clone(),usdc:"usdc.testnet".parse().unwrap(),apr_bps:1000,relayer_key:Some([7;32]),
            assets:BTreeMap::from([(btc.clone(),Asset{decimals:8,ltv_bps:5000,price_usd6:50_000_000_000,at_ns:200_000_000_000,source:"test".into()}),(stock.clone(),Asset{decimals:8,ltv_bps:4000,price_usd6:100_000_000,at_ns:100_000_000_000,source:"test".into()})]),
            collateral:BTreeMap::from([((user.clone(),btc),100_000),((user,stock),stock_amount)]),loans:BTreeMap::new(),credits:BTreeMap::new(),lp_balances:BTreeMap::new(),liquidity:500_000_000,supplied:500_000_000,pending:BTreeMap::new(),nonce:0,installments:BTreeMap::new(),next_installment:0,schema_version:2 }
    }
    #[test]
    #[should_panic(expected="ERR_STALE_PRICE")]
    fn stale_stock_blocks_new_borrow_even_with_fresh_btc() {
        let mut c=position_state(100_000_000);let user:AccountId="alice.testnet".parse().unwrap();
        assert!(!c.position(user.clone()).prices_fresh);
        c.borrow(U128(1),user);
    }
    #[test]
    fn withdrawn_zero_stock_does_not_poison_fresh_btc_credit() {
        let c=position_state(0);let user:AccountId="alice.testnet".parse().unwrap();
        assert!(c.position(user.clone()).prices_fresh);assert_eq!(c.credit_limit(user).0,25_000_000);
    }
}
