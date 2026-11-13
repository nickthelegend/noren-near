import { describe,it,expect } from 'vitest';import { checkoutCall } from './checkout-calls';import{COLLATERALS}from'./data';
const p={id:'0x'+'a'.repeat(64),amount:'25000000',payout:'shop.testnet'},account='alice.testnet';
describe('native invoice calls',()=>{
 it('binds public USDC, credit and installment calls to the invoice',()=>{
  expect(checkoutCall('usdc',p,account).args.memo).toBe(`noren:${p.id}`);
  expect(checkoutCall('credit',p,account).args).toEqual({amount:p.amount,recipient:p.payout,invoice_id:p.id});
  expect(checkoutCall('schedule',p,account).methodName).toBe('schedule_pay_in_3');
  expect(checkoutCall('installment',p,account,{installment:0}).args.invoice_id).toBe(p.id);
 });
 it('rounds stock input up in integer units and refuses stale prices',()=>{
  const a={token:COLLATERALS.find(x=>x.stock)!.token,decimals:8,ltv_bps:4000,liq_bps:5000,price_usd6:'390620000',price_at_ns:String(BigInt(Date.now())*1_000_000n),price_fresh:true,source:'relayer:https://query1.finance.yahoo.com/'};
  const c=checkoutCall('stocks',p,account,{asset:a});expect(BigInt(String(c.args.amount))*BigInt(a.price_usd6)/100_000_000n).toBeGreaterThanOrEqual(25_000_000n);
  expect(()=>checkoutCall('stocks',p,account,{asset:{...a,price_fresh:false}})).toThrow('STALE');
 });
 it('rejects mainnet, malformed links and negative installment IDs',()=>{
  expect(()=>checkoutCall('credit',{...p,payout:'shop.near'},account)).toThrow('testnet');
  expect(()=>checkoutCall('usdc',{...p,id:'bad'},account)).toThrow('link');
  expect(()=>checkoutCall('installment',p,account,{installment:-1})).toThrow('installment');
 });
});

it('sells configured native test WBTC with an integer quote, never an arbitrary token',()=>{
 const asset={token:COLLATERALS[0].token,decimals:8,ltv_bps:5000,liq_bps:6000,price_usd6:'71000000000',price_at_ns:String(BigInt(Date.now())*1000000n),price_fresh:true,source:'relayer:https://api.exchange.coinbase.com/products/BTC-USD/ticker'};
 expect(checkoutCall('stocks',p,account,{asset}).receiverId).toBe(COLLATERALS[0].token);
 expect(()=>checkoutCall('stocks',p,account,{asset:{...asset,token:'unconfigured.testnet'}})).toThrow('configured');
});
