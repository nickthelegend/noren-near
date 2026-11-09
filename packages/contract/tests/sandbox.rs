//! Signed transactions against a real nearcore sandbox. Token transfers use a deployed NEP-141 contract.
use near_workspaces::{network::Sandbox, types::NearToken, Account, Contract, Worker};
use serde_json::{json, Value};

const CREDIT_WASM: &str = concat!(env!("CARGO_MANIFEST_DIR"), "/target/near/noren_credit.wasm");
const TOKEN_WASM: &str = concat!(env!("CARGO_MANIFEST_DIR"), "/test-token/target/near/noren_test_token.wasm");
const YOCTO: NearToken = NearToken::from_yoctonear(1);

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
        "yield_source":yield_source.id(),"usdc":usdc.id(),"apr_bps":1000})).await?;
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
