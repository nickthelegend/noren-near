//! Signed transactions against a real nearcore sandbox. Token transfers use a deployed NEP-141 contract.
use near_workspaces::{network::Sandbox, types::NearToken, Account, Contract, Worker};
use serde_json::{json, Value};
use base64::Engine as _;
use ed25519_dalek::{Signer, SigningKey};
use sha2::{Digest, Sha256};

const CREDIT_WASM: &str = concat!(env!("CARGO_MANIFEST_DIR"), "/target/near/noren_credit.wasm");
const TOKEN_WASM: &str = concat!(env!("CARGO_MANIFEST_DIR"), "/test-token/target/near/noren_test_token.wasm");
const YOCTO: NearToken = NearToken::from_yoctonear(1);
const SOURCE: &str = "https://api.exchange.coinbase.com/products/BTC-USD/ticker";
fn relayer() -> SigningKey { SigningKey::from_bytes(&[7u8; 32]) }
fn b64(bytes: &[u8]) -> String { base64::engine::general_purpose::STANDARD.encode(bytes) }
/// Signs exactly what the contract verifies: sha256("noren-price:v1|contract|token|price|ts|source").
fn signed_price(key: &SigningKey, credit: &Contract, token: &Contract, usd6: u128, ts: u64) -> Value {
    let msg = format!("noren-price:v1|{}|{}|{}|{}|{}", credit.id(), token.id(), usd6, ts, SOURCE);
    let sig = key.sign(&Sha256::digest(msg.as_bytes()));
    json!({"token":token.id(),"price_usd6":usd6.to_string(),"timestamp_ns":ts.to_string(),"source":SOURCE,"signature":b64(&sig.to_bytes())})
}

struct Setup {
    _worker: Worker<Sandbox>, admin: Account, alice: Account, attacker: Account, oracle: Account,
    yield_source: Account, liquidator: Account, credit: Contract, btc: Contract, usdc: Contract,
}
async fn call_ok(account: &Account, contract: &Contract, method: &str, args: Value) -> anyhow::Result<()> {
    account.call(contract.id(), method).args_json(args).max_gas().transact().await?.into_result()?;
    Ok(())
}
async fn view_string(contract: &Contract, method: &str, args: Value) -> anyhow::Result<String> {
    Ok(contract.view(method).args_json(args).await?.json()?)
}
fn now_ns() -> u64 {
    std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).unwrap().as_nanos() as u64
}
async fn price(s: &Setup, usd: u64) -> anyhow::Result<()> {
    call_ok(&s.oracle, &s.credit, "oracle_on_call", json!({
        "sender_id":s.admin.id(), "data":{"timestamp":(now_ns()-5_000_000_000).to_string(),
        "prices":[{"asset_id":s.btc.id(),"price":{"multiplier":(usd*100_000_000).to_string(),"decimals":8}}]}, "msg":""
    })).await
}
async fn transfer(signer: &Account, token: &Contract, receiver: &Contract, amount: u128, kind: Value) -> anyhow::Result<()> {
    signer.call(token.id(), "ft_transfer_call").args_json(json!({
        "receiver_id":receiver.id(),"amount":amount.to_string(),"msg":kind.to_string()
    })).deposit(YOCTO).max_gas().transact().await?.into_result()?;
    Ok(())
}
async fn setup() -> anyhow::Result<Setup> {
    let worker = near_workspaces::sandbox().await?;
    let admin = worker.dev_create_account().await?;
    let alice = worker.dev_create_account().await?;
    let attacker = worker.dev_create_account().await?;
    let oracle = worker.dev_create_account().await?;
    let yield_source = worker.dev_create_account().await?;
    let liquidator = worker.dev_create_account().await?;
    let credit = worker.dev_create_account().await?.deploy(&std::fs::read(CREDIT_WASM)?).await?.into_result()?;
    let btc = worker.dev_create_account().await?.deploy(&std::fs::read(TOKEN_WASM)?).await?.into_result()?;
    let usdc = worker.dev_create_account().await?.deploy(&std::fs::read(TOKEN_WASM)?).await?.into_result()?;
    call_ok(&admin, &btc, "new", json!({"owner":admin.id(),"symbol":"BTC","decimals":8})).await?;
    call_ok(&admin, &usdc, "new", json!({"owner":admin.id(),"symbol":"USDC","decimals":6})).await?;
    call_ok(&admin, &credit, "new", json!({"owner":admin.id(),"oracle":oracle.id(),
        "yield_source":yield_source.id(),"usdc":usdc.id(),"apr_bps":1000,
        "relayer_key":b64(relayer().verifying_key().as_bytes())})).await?;
    call_ok(&admin, &credit, "configure_asset", json!({"token":btc.id(),"decimals":8,"ltv_bps":5000})).await?;
    for t in [&btc, &usdc] {
        call_ok(&admin, t, "register", json!({"account_id":credit.id()})).await?;
    }
    call_ok(&admin, &usdc, "register", json!({"account_id":alice.id()})).await?;
    call_ok(&admin, &btc, "register", json!({"account_id":liquidator.id()})).await?;
    for (t, a, amount) in [(&btc, &alice, 100_000_000u128), (&usdc, &admin, 100_000_000),
        (&usdc, &yield_source, 10_000_000), (&usdc, &liquidator, 20_000_000),
        (&usdc, &attacker, 1)] {
        call_ok(&admin, t, "mint", json!({"account_id":a.id(),"amount":amount.to_string()})).await?;
    }
    Ok(Setup { _worker: worker, admin, alice, attacker, oracle, yield_source, liquidator, credit, btc, usdc })
}

#[tokio::test]
async fn real_token_credit_borrow_yield_repay_withdraw() -> anyhow::Result<()> {
    let s = setup().await?;
    transfer(&s.admin, &s.usdc, &s.credit, 100_000_000, json!({"kind":"pool"})).await?;
    transfer(&s.alice, &s.btc, &s.credit, 100_000_000, json!({"kind":"collateral"})).await?;
    price(&s, 75_000).await?;
    assert_eq!(view_string(&s.credit, "credit_limit", json!({"borrower":s.alice.id()})).await?, "37500000000");
    call_ok(&s.alice, &s.credit, "borrow", json!({"amount":"10000000","recipient":s.alice.id()})).await?;
    assert_eq!(view_string(&s.usdc, "ft_balance_of", json!({"account_id":s.alice.id()})).await?, "10000000");
    s._worker.fast_forward(200).await?;
    assert!(view_string(&s.credit, "debt", json!({"borrower":s.alice.id()})).await?.parse::<u128>()? > 10_000_000);
    transfer(&s.yield_source, &s.usdc, &s.credit, 2_000_000, json!({"kind":"yield","borrower":s.alice.id()})).await?;
    let after_yield: u128 = view_string(&s.credit, "debt", json!({"borrower":s.alice.id()})).await?.parse()?;
    assert!(after_yield < 10_000_000 && after_yield >= 8_000_000);
    transfer(&s.alice, &s.usdc, &s.credit, 10_000_000, json!({"kind":"repay"})).await?;
    assert_eq!(view_string(&s.credit, "debt", json!({"borrower":s.alice.id()})).await?, "0");
    call_ok(&s.alice, &s.credit, "withdraw", json!({"token":s.btc.id(),"amount":"100000000","recipient":s.alice.id()})).await?;
    assert_eq!(view_string(&s.btc, "ft_balance_of", json!({"account_id":s.alice.id()})).await?, "100000000");
    call_ok(&s.admin, &s.credit, "withdraw_liquidity", json!({"amount":"100000000","recipient":s.admin.id()})).await?;
    assert_eq!(view_string(&s.usdc, "ft_balance_of", json!({"account_id":s.admin.id()})).await?, "100000000");
    Ok(())
}

#[tokio::test]
async fn attacks_reject_on_chain() -> anyhow::Result<()> {
    let s = setup().await?;
    transfer(&s.admin, &s.usdc, &s.credit, 100_000_000, json!({"kind":"pool"})).await?;
    // A premature real yield transfer has no debt to repay and must refund in full.
    transfer(&s.yield_source, &s.usdc, &s.credit, 1_000_000, json!({"kind":"yield","borrower":s.alice.id()})).await?;
    assert_eq!(view_string(&s.usdc, "ft_balance_of", json!({"account_id":s.yield_source.id()})).await?, "10000000");
    let pool: Value = s.credit.view("pool_status").args_json(json!({})).await?.json()?;
    assert_eq!(pool, json!(["100000000", "100000000"]));
    // Unconfirmed quote or a plain function call cannot create collateral.
    let unconfirmed = s.alice.call(s.credit.id(), "borrow").args_json(json!({"amount":"1000000","recipient":s.alice.id()})).transact().await?;
    assert!(unconfirmed.is_failure());
    let forged = s.attacker.call(s.credit.id(), "ft_on_transfer").args_json(json!({"sender_id":s.alice.id(),"amount":"100000000","msg":"{\"kind\":\"collateral\"}"})).transact().await?;
    assert!(forged.is_failure());
    let manipulated = s.attacker.call(s.credit.id(), "oracle_on_call").args_json(json!({"sender_id":s.attacker.id(),
        "data":{"timestamp":now_ns().to_string(),"prices":[{"asset_id":s.btc.id(),"price":{"multiplier":"999999999999999","decimals":8}}]},"msg":""})).transact().await?;
    assert!(manipulated.is_failure());
    // NEP-141 refunds a rejected callback. The signed transaction succeeds but no value is credited.
    transfer(&s.attacker, &s.usdc, &s.credit, 1, json!({"kind":"yield","borrower":s.alice.id()})).await?;
    assert_eq!(view_string(&s.usdc, "ft_balance_of", json!({"account_id":s.attacker.id()})).await?, "1");
    assert_eq!(view_string(&s.credit, "debt", json!({"borrower":s.alice.id()})).await?, "0");
    let callback = s.attacker.call(s.credit.id(), "on_borrow").args_json(json!({"borrower":s.alice.id(),"amount":"1000000","nonce":1,"installment_id":null})).transact().await?;
    assert!(callback.is_failure());
    transfer(&s.alice, &s.btc, &s.credit, 100_000_000, json!({"kind":"collateral"})).await?;
    let double_credit = s.attacker.call(s.credit.id(), "ft_on_transfer").args_json(json!({"sender_id":s.alice.id(),"amount":"100000000","msg":"{\"kind\":\"collateral\"}"})).transact().await?;
    assert!(double_credit.is_failure());
    let stale = s.oracle.call(s.credit.id(), "oracle_on_call").args_json(json!({"sender_id":s.admin.id(),"data":{
        "timestamp":(now_ns()-91_000_000_000).to_string(),"prices":[{"asset_id":s.btc.id(),"price":{"multiplier":"7500000000000","decimals":8}}]},"msg":""})).transact().await?;
    assert!(stale.is_failure());
    let stale_borrow = s.alice.call(s.credit.id(), "borrow").args_json(json!({"amount":"1000000","recipient":s.alice.id()})).transact().await?;
    assert!(stale_borrow.is_failure());
    price(&s, 75_000).await?;
    let too_much = s.alice.call(s.credit.id(), "borrow").args_json(json!({"amount":"90000000","recipient":s.alice.id()})).transact().await?;
    assert!(too_much.is_failure());
    call_ok(&s.alice, &s.credit, "borrow", json!({"amount":"1000000","recipient":s.alice.id()})).await?;
    s._worker.fast_forward(100).await?;
    let stale_withdraw = s.alice.call(s.credit.id(), "withdraw").args_json(json!({"token":s.btc.id(),"amount":"1","recipient":s.alice.id()})).transact().await?;
    assert!(stale_withdraw.is_failure());
    assert_eq!(view_string(&s.credit, "collateral_of", json!({"borrower":s.alice.id(),"token":s.btc.id()})).await?, "100000000");
    Ok(())
}

#[tokio::test]
async fn liquidation_and_installment_schedule() -> anyhow::Result<()> {
    let s = setup().await?;
    transfer(&s.admin, &s.usdc, &s.credit, 100_000_000, json!({"kind":"pool"})).await?;
    transfer(&s.alice, &s.btc, &s.credit, 100_000_000, json!({"kind":"collateral"})).await?;
    price(&s, 75_000).await?;
    let ids: Vec<u64> = s.alice.call(s.credit.id(), "schedule_pay_in_3").args_json(json!({"total":"3000000","recipient":s.alice.id()})).transact().await?.json()?;
    assert_eq!(ids.len(), 3);
    call_ok(&s.liquidator, &s.credit, "pay_installment", json!({"id":ids[0]})).await?;
    let early = s.liquidator.call(s.credit.id(), "pay_installment").args_json(json!({"id":ids[1]})).transact().await?;
    assert!(early.is_failure());
    let healthy = s.liquidator.call(s.credit.id(), "liquidate").args_json(json!({"borrower":s.alice.id(),"token":s.btc.id(),"repay":"1000000"})).transact().await?;
    assert!(healthy.is_failure());
    transfer(&s.liquidator, &s.usdc, &s.credit, 20_000_000, json!({"kind":"liquidation_credit"})).await?;
    // A large draw is allowed at $75k/BTC, then a sharp price drop makes it unsafe.
    call_ok(&s.alice, &s.credit, "borrow", json!({"amount":"30000000","recipient":s.alice.id()})).await?;
    price(&s, 50).await?;
    let before: u128 = view_string(&s.credit, "debt", json!({"borrower":s.alice.id()})).await?.parse()?;
    call_ok(&s.liquidator, &s.credit, "liquidate", json!({"borrower":s.alice.id(),"token":s.btc.id(),"repay":"1000000"})).await?;
    let after: u128 = view_string(&s.credit, "debt", json!({"borrower":s.alice.id()})).await?.parse()?;
    assert!(before > after && before - after >= 999_999);
    assert!(view_string(&s.btc, "ft_balance_of", json!({"account_id":s.liquidator.id()})).await?.parse::<u128>()? > 0);
    Ok(())
}

#[tokio::test]
async fn signed_relayer_price_is_verified_on_chain() -> anyhow::Result<()> {
    let s = setup().await?;
    transfer(&s.admin, &s.usdc, &s.credit, 100_000_000, json!({"kind":"pool"})).await?;
    transfer(&s.alice, &s.btc, &s.credit, 100_000_000, json!({"kind":"collateral"})).await?;
    let ts = now_ns() - 3_000_000_000;
    // The contract's own view returns the exact message the relayer signs.
    let msg: String = s.credit.view("signed_price_message").args_json(json!({"token":s.btc.id(),"price_usd6":"75000000000","timestamp_ns":ts.to_string(),"source":SOURCE})).await?.json()?;
    assert_eq!(msg, format!("noren-price:v1|{}|{}|75000000000|{}|{}", s.credit.id(), s.btc.id(), ts, SOURCE));
    // A key that is not the relayer's is rejected.
    let wrong = SigningKey::from_bytes(&[9u8; 32]);
    let forged = s.attacker.call(s.credit.id(), "post_signed_price").args_json(signed_price(&wrong, &s.credit, &s.btc, 750_000_000_000_000, ts)).max_gas().transact().await?;
    assert!(forged.is_failure());
    // A genuine signature over a different price is rejected (tampered amount).
    let mut tampered = signed_price(&relayer(), &s.credit, &s.btc, 75_000_000_000, ts);
    tampered["price_usd6"] = json!("750000000000000");
    assert!(s.attacker.call(s.credit.id(), "post_signed_price").args_json(tampered).max_gas().transact().await?.is_failure());
    // A stale genuine signature is rejected.
    let old = signed_price(&relayer(), &s.credit, &s.btc, 75_000_000_000, now_ns() - 120_000_000_000);
    assert!(s.attacker.call(s.credit.id(), "post_signed_price").args_json(old).max_gas().transact().await?.is_failure());
    // Anyone may relay a genuine, fresh signature.
    call_ok(&s.attacker, &s.credit, "post_signed_price", signed_price(&relayer(), &s.credit, &s.btc, 75_000_000_000, ts)).await?;
    assert_eq!(view_string(&s.credit, "credit_limit", json!({"borrower":s.alice.id()})).await?, "37500000000");
    // Replaying an equal-or-older genuine signature cannot roll the price back.
    let replay = signed_price(&relayer(), &s.credit, &s.btc, 90_000_000_000, ts - 1_000_000_000);
    assert!(s.attacker.call(s.credit.id(), "post_signed_price").args_json(replay).max_gas().transact().await?.is_failure());
    let assets: Value = s.credit.view("assets").args_json(json!({})).await?.json()?;
    assert_eq!(assets[0]["price_usd6"], json!("75000000000"));
    assert_eq!(assets[0]["source"], json!(format!("relayer:{SOURCE}")));
    assert_eq!(assets[0]["price_fresh"], json!(true));
    // The position view reports everything the app shows.
    call_ok(&s.alice, &s.credit, "borrow", json!({"amount":"5000000","recipient":s.alice.id()})).await?;
    let p: Value = s.credit.view("position").args_json(json!({"borrower":s.alice.id()})).await?.json()?;
    assert_eq!(p["collateral_usd6"], json!("75000000000"));
    assert_eq!(p["credit_limit_usd6"], json!("37500000000"));
    assert!(p["debt_usd6"].as_str().unwrap().parse::<u128>()? >= 5_000_000);
    assert_eq!(p["prices_fresh"], json!(true));
    Ok(())
}

#[tokio::test]
async fn max_borrow_is_not_instantly_liquidatable_and_credit_is_withdrawable() -> anyhow::Result<()> {
    let s = setup().await?;
    transfer(&s.admin, &s.usdc, &s.credit, 100_000_000, json!({"kind":"pool"})).await?;
    transfer(&s.alice, &s.btc, &s.credit, 100_000, json!({"kind":"collateral"})).await?; // 0.001 BTC
    price(&s, 75_000).await?;
    // 0.001 BTC at $75k = $75; 50% LTV = $37.50 limit. Borrow all of it; one more unit is over the limit.
    assert!(s.alice.call(s.credit.id(), "borrow").args_json(json!({"amount":"37500001","recipient":s.alice.id()})).max_gas().transact().await?.is_failure());
    call_ok(&s.alice, &s.credit, "borrow", json!({"amount":"37500000","recipient":s.alice.id()})).await?;
    transfer(&s.liquidator, &s.usdc, &s.credit, 20_000_000, json!({"kind":"liquidation_credit"})).await?;
    s._worker.fast_forward(20).await?;
    price(&s, 75_000).await?;
    // Interest accrued, but the 10-point liquidation buffer keeps a max-LTV borrower safe.
    let early = s.liquidator.call(s.credit.id(), "liquidate").args_json(json!({"borrower":s.alice.id(),"token":s.btc.id(),"repay":"1000000"})).max_gas().transact().await?;
    assert!(early.is_failure());
    // Unused liquidation credit goes back to the liquidator in full.
    call_ok(&s.liquidator, &s.credit, "withdraw_credit", json!({"amount":"20000000"})).await?;
    assert_eq!(view_string(&s.usdc, "ft_balance_of", json!({"account_id":s.liquidator.id()})).await?, "20000000");
    assert_eq!(view_string(&s.credit, "liquidation_credit", json!({"account":s.liquidator.id()})).await?, "0");
    // More credit than deposited cannot be withdrawn.
    assert!(s.liquidator.call(s.credit.id(), "withdraw_credit").args_json(json!({"amount":"1"})).max_gas().transact().await?.is_failure());
    Ok(())
}

#[tokio::test]
async fn mixed_stocks_ltv_staleness_forgery_and_liquidation() -> anyhow::Result<()> {
    let s = setup().await?;
    let stock = s._worker.dev_create_account().await?.deploy(&std::fs::read(TOKEN_WASM)?).await?.into_result()?;
    call_ok(&s.admin,&stock,"new",json!({"owner":s.admin.id(),"symbol":"tTSLA (TEST, not shares)","decimals":8})).await?;
    for who in [s.alice.id(),s.credit.id(),s.liquidator.id()] { call_ok(&s.admin,&stock,"register",json!({"account_id":who})).await?; }
    call_ok(&s.admin,&stock,"mint",json!({"account_id":s.alice.id(),"amount":"100000000"})).await?;
    call_ok(&s.admin,&s.credit,"configure_asset",json!({"token":stock.id(),"decimals":8,"ltv_bps":4000})).await?;
    transfer(&s.admin,&s.usdc,&s.credit,100_000_000,json!({"kind":"pool"})).await?;
    transfer(&s.alice,&s.btc,&s.credit,100_000,json!({"kind":"collateral"})).await?; // .001 BTC = $50
    transfer(&s.alice,&stock,&s.credit,100_000_000,json!({"kind":"collateral"})).await?;
    price(&s,50_000).await?;
    let ts=now_ns()-2_000_000_000;
    let wrong=SigningKey::from_bytes(&[9;32]);
    assert!(s.attacker.call(s.credit.id(),"post_signed_price").args_json(signed_price(&wrong,&s.credit,&stock,100_000_000,ts)).max_gas().transact().await?.is_failure());
    call_ok(&s.attacker,&s.credit,"post_signed_price",signed_price(&relayer(),&s.credit,&stock,100_000_000,ts)).await?;
    let p:Value=s.credit.view("position").args_json(json!({"borrower":s.alice.id()})).await?.json()?;
    assert_eq!(p["credit_limit_usd6"],json!("65000000")); // BTC $50*.5 + TSLA $100*.4
    assert!(s.alice.call(s.credit.id(),"borrow").args_json(json!({"amount":"65000001","recipient":s.alice.id()})).max_gas().transact().await?.is_failure());
    call_ok(&s.alice,&s.credit,"borrow",json!({"amount":"60000000","recipient":s.alice.id()})).await?;
    // A genuine stale stock update is refused instead of being re-timestamped.
    assert!(s.attacker.call(s.credit.id(),"post_signed_price").args_json(signed_price(&relayer(),&s.credit,&stock,100_000_000,now_ns()-120_000_000_000)).max_gas().transact().await?.is_failure());
    call_ok(&s.attacker,&s.credit,"post_signed_price",signed_price(&relayer(),&s.credit,&stock,30_000_000,now_ns()-1_000_000_000)).await?;
    let p:Value=s.credit.view("position").args_json(json!({"borrower":s.alice.id()})).await?.json()?;
    assert!(p["health_bps"].as_str().unwrap().parse::<u128>()?<10_000); // $30 BTC threshold + $15 stock threshold < $60 debt
    transfer(&s.liquidator,&s.usdc,&s.credit,10_000_000,json!({"kind":"liquidation_credit"})).await?;
    call_ok(&s.liquidator,&s.credit,"liquidate",json!({"borrower":s.alice.id(),"token":stock.id(),"repay":"1000000"})).await?;
    assert!(view_string(&stock,"ft_balance_of",json!({"account_id":s.liquidator.id()})).await?.parse::<u128>()?>0);
    Ok(())
}
