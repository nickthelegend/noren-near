import { McpServer } from "@modelcontextprotocol/server";
import { serveStdio } from "@modelcontextprotocol/server/stdio";
import * as z from "zod/v4";
import { creditStatus, harvestPreview, quoteDeposit, quoteSpend } from "./tools.js";

function result(value: unknown) { return { content: [{ type: "text" as const, text: JSON.stringify(value) }] }; }
function failure(error: unknown) { return { isError: true, content: [{ type: "text" as const, text: error instanceof Error ? error.message : String(error) }] }; }
function createServer() {
  const server = new McpServer({ name: "noren-near", version: "0.1.0" });
  server.registerTool("credit_status", { description: "Read a real Noren testnet credit position", inputSchema: z.object({ account: z.string() }) },
    async ({ account }) => { try { return result(await creditStatus(account)); } catch (e) { return failure(e); } });
  server.registerTool("quote_deposit", { description: "Get a live dry 1Click quote to a borrower Intents account; does not credit collateral", inputSchema: z.object({
    originAsset: z.string(), destinationAsset: z.string(), amount: z.string(), nearAccount: z.string(), originRefund: z.string()
  }) }, async (input) => { try { return result(await quoteDeposit(input)); } catch (e) { return failure(e); } });
  server.registerTool("quote_spend", { description: "Get a live dry 1Click merchant quote; no payment is made", inputSchema: z.object({
    originAsset: z.string(), destinationAsset: z.string(), amount: z.string(), merchant: z.string(), borrower: z.string(), confidential: z.boolean().optional()
  }) }, async (input) => { try { return result(await quoteSpend(input)); } catch (e) { return failure(e); } });
  server.registerTool("harvest_preview", { description: "Project a debt-free date using a live Rhea supply rate; projected yield is not yet earned by Noren", inputSchema: z.object({
    account: z.string(), token: z.string()
  }) }, async (input) => { try { return result(await harvestPreview(input)); } catch (e) { return failure(e); } });
  return server;
}
void serveStdio(createServer);
