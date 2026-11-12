// Node-only selection. Never expose PYTH_API_KEY to Vite, the browser, URLs or logs.
import { stockPrices } from '../packages/sdk/src/stocks.ts';
export const equityPrices = (symbols?: string[]) => stockPrices(fetch, { pythApiKey: process.env.PYTH_API_KEY, symbols });
