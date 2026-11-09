#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
ROOT="$PWD"

pnpm install --store-dir .pnpm-store

# The test token is a real NEP-141 contract deployed into each nearcore sandbox.
(cd packages/contract/test-token && cargo near build non-reproducible-wasm --no-abi)
(cd packages/contract && cargo near build non-reproducible-wasm --no-abi)

if [ -z "${NEAR_SANDBOX_BIN:-}" ]; then
  BIN="$ROOT/.near-build/near-sandbox-2.14.0-rc.4/near-sandbox"
  REUSE="/Volumes/Extreme SSD/Projects/near-qday-recovery/.tools/near-sandbox-2.14.0-rc.4/near-sandbox"
  if [ -x "$REUSE" ]; then BIN="$REUSE"; fi
  if [ ! -x "$BIN" ]; then
    case "$(uname -s)-$(uname -m)" in
      Darwin-arm64) PLATFORM=Darwin-arm64 ;;
      Linux-x86_64) PLATFORM=Linux-x86_64 ;;
      Linux-aarch64) PLATFORM=Linux-aarch64 ;;
      *) echo "Set NEAR_SANDBOX_BIN for this architecture" >&2; exit 1 ;;
    esac
    mkdir -p "$(dirname "$BIN")"
    curl -fsSL "https://s3-us-west-1.amazonaws.com/build.nearprotocol.com/nearcore/$PLATFORM/2.14.0-rc.4/near-sandbox.tar.gz" |
      tar -xz -C "$(dirname "$BIN")" --strip-components=1
  fi
  export NEAR_SANDBOX_BIN="$BIN"
fi

(cd packages/contract && cargo test --test sandbox)
pnpm --filter @noren/near-sdk build
pnpm --filter @noren/near-sdk test
pnpm --filter @noren/near-mcp build
NOREN_LIVE_CONTRACT=credit.noren-near-mw9h22el.testnet NOREN_LIVE_ACCOUNT=bob.noren-near-mw9h22el.testnet pnpm --filter @noren/near-mcp test
pnpm --filter @noren/web build > .near-build/web-build.log 2>&1
pnpm near:browser
pnpm test
