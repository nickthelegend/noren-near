import {lazy,Suspense,useEffect,useState} from "react";
import {NearLanding} from "./near/NearLanding";
import {NearCredit} from "./near/NearCredit";
const Edition=lazy(()=>import('./edition/EditionRoot').then(m=>({default:m.EditionRoot})));
const Shop=lazy(()=>import('./shop/App').then(m=>({default:m.App})));
/** One NEAR edition: original merchant/shop/app surfaces plus the preserved native credit reader. */
export function App(){
 const[hash,setHash]=useState(()=>location.hash);
 useEffect(()=>{const sync=()=>setHash(location.hash);addEventListener('hashchange',sync);return()=>removeEventListener('hashchange',sync)},[]);
 if(location.pathname.startsWith('/shop'))return <Suspense fallback={<div className="boot" aria-busy="true"/>}><Shop/></Suspense>;
 if(hash==='#/near')return <NearLanding/>;
 if(/^#\/near\/app(?:\/(?:pay|melt))?$/.test(hash))return <NearCredit/>;
 return <Suspense fallback={<div className="boot" aria-busy="true"/>}><Edition/></Suspense>;
}
