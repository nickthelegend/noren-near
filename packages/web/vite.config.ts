import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

// Public VITE_* configuration comes from the checkout or shared worktree environment:
// this checkout's .env, else the main checkout's when this is a git worktree. Only VITE_-prefixed values reach the app.
const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
function envDir() {
  if (existsSync(resolve(root, ".env"))) return root;
  try { return resolve(execFileSync("git", ["rev-parse", "--path-format=absolute", "--git-common-dir"], { cwd: root, encoding: "utf8" }).trim(), ".."); } catch { return root; }
}

export default defineConfig({
  plugins: [react(), {
    name: "near-public-assets",
    generateBundle() {
      // Keep inherited screenshots, proving artifacts and chain logos out of this entry.
      for (const fileName of ["favicon.png", "art/mark.png", "logos/usdc.svg", "logos/eth.svg"]) {
        this.emitFile({ type: "asset", fileName, source: readFileSync(resolve(root, "packages/web/public", fileName)) });
      }
      // The NEAR edition's 3D objects (docs/ART-3D.md).
      for (const name of readdirSync(resolve(root, "packages/web/public/art/3d")).filter((f) => f.endsWith(".webp"))) {
        this.emitFile({ type: "asset", fileName: `art/3d/${name}`, source: readFileSync(resolve(root, "packages/web/public/art/3d", name)) });
      }
    },
  }],
  envDir: envDir(),
  resolve: { dedupe: ["react", "react-dom"] },
  define: { "process.env": {}, global: "globalThis" },
  optimizeDeps: { esbuildOptions: { target: "es2022" } },
  build: { copyPublicDir: false, target: "es2022", chunkSizeWarningLimit: 4000 },
  server: { port: 5190, strictPort: true },
});
