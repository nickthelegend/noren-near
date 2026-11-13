import { CONTRACT, RECORD, COLLATERALS, type AssetView } from './data';
import { accountValid, tokenUnits, type Call } from './credit-calls';
export type CheckoutMethod='usdc'|'stocks'|'credit'|'schedule'|'installment';
export type Payment={id:string;amount:string;payout:string};
export function checkoutCall(method:CheckoutMethod,p:Payment,account:string,options:{asset?:AssetView;installment?:number}={}):Call{
 if(!/^0x[0-9a-f]{64}$/.test(p.id))throw Error('Check the payment link.');
 if(![account,p.payout].every(x=>accountValid(x)&&x.endsWith('.testnet')))throw Error('Check the NEAR testnet payout account.');
 if(!/^\d+$/.test(p.amount)||BigInt(p.amount)<=0n||BigInt(p.amount)>2n**128n-1n)throw Error('Enter a positive payment amount.');
 const base={receiverId:CONTRACT,gas:'80000000000000',deposit:'0'};
 if(method==='usdc')return{...base,receiverId:RECORD.accounts.tusdc,methodName:'ft_transfer',args:{receiver_id:p.payout,amount:p.amount,memo:`noren:${p.id}`},deposit:'1'};
 if(method==='credit')return{...base,methodName:'borrow',args:{amount:p.amount,recipient:p.payout,invoice_id:p.id}};
 if(method==='schedule')return{...base,gas:'30000000000000',methodName:'schedule_pay_in_3',args:{total:p.amount,recipient:p.payout,invoice_id:p.id}};
 if(method==='installment'){
  if(!Number.isSafeInteger(options.installment)||options.installment!<0)throw Error('Check the installment.');
  return{...base,methodName:'pay_installment',args:{id:options.installment,invoice_id:p.id}};
 }
 const asset=options.asset;
 if(!asset||!COLLATERALS.some(x=>x.token===asset.token))throw Error('Only configured test stocks or test WBTC can be sold here.');
 const age=Date.now()-Number(BigInt(asset.price_at_ns)/1_000_000n);
 if(!asset.price_fresh||age<0||age>90000||BigInt(asset.price_usd6)<=0n)throw Error('ERR_STALE_PRICE');
 const quantity=(BigInt(p.amount)*10n**BigInt(asset.decimals)+BigInt(asset.price_usd6)-1n)/BigInt(asset.price_usd6);
 return{...base,receiverId:asset.token,methodName:'ft_transfer_call',args:{receiver_id:CONTRACT,amount:String(quantity),msg:JSON.stringify({kind:'stock_pay',recipient:p.payout,invoice_id:p.id,min_usdc:p.amount})},deposit:'1'};
}
