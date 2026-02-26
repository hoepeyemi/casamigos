# Testing the Contracts & CRE Workflow

You can test (1) the **smart contracts** locally or on Base Sepolia, and (2) the **CRE workflow** via simulation and optional onchain broadcast.

---

## 1. Test the smart contracts

### Option A: Contract feature script (same features as frontend, on Base Sepolia)

From the project root, one wallet runs through the main contract flows (register IP, mint license, pay revenue, claim royalties, register arbitrator, etc.):

**Using a `.env` file (recommended):** copy `.env.example` to `.env` in the project root, or create `.env` with:

```
# Required: wallet with Base Sepolia ETH (for gas and small value for payRevenue/registerArbitrator)
TEST_PRIVATE_KEY=your_private_key_hex_without_0x

# Optional: override RPC
# RPC_URL=https://sepolia.base.org

# Optional: IP asset (like frontend – IPFS link and metadata)
# TEST_IP_HASH=ipfs://QmYourImageCID
# TEST_IP_METADATA={"name":"My IP","description":"..."}
# (If TEST_IP_METADATA has no "image", the script injects one from TEST_IP_HASH so Base explorer shows the asset image.)
# TEST_IP_ENCRYPTED=false

# Optional: license (royalty in basis points 10000=100%, duration in seconds)
# TEST_LICENSE_ROYALTY_BPS=1000
# TEST_LICENSE_DURATION_SECONDS=2592000
# TEST_LICENSE_COMMERCIAL=true
# TEST_LICENSE_TERMS=your terms

# Optional: payRevenue amount in ETH
# TEST_PAY_REVENUE_ETH=0.001

# Optional: for dispute/arbitration steps (second and third wallets)
# DISPUTER_PRIVATE_KEY=...
# ARBITRATOR_PRIVATE_KEY=...
```

Then run:

```bash
npm run test:contract-features
```

The script loads `.env` from the project root automatically. You can also set env vars in the shell instead:

```bash
$env:TEST_PRIVATE_KEY = "your_private_key_hex"   # PowerShell
export TEST_PRIVATE_KEY=your_private_key_hex    # Bash
npm run test:contract-features
```

See `scripts/test-contract-features/README.md` for details.

**Infringement check:** When you run `npm run test:contract-features`, at the end the script runs an **infringement check on all IP assets** (same as the frontend: contract token IDs → Yakoa API for each). It uses the backend script `backend/scripts/check-all-infringements.ts`. Ensure **backend/.env** has `YAKOA_API_KEY`, `YAKOA_SUBDOMAIN`, and `YAKOA_NETWORK` (see backend README). To skip this step, set `RUN_INFRINGEMENT_CHECK=false`.

### Option B: Local Hardhat tests (no chain)

From the project root you can set `DEPLOYER_PRIVATE_KEY` in the same root `.env` (dummy key is fine; tests use local network):

```
DEPLOYER_PRIVATE_KEY=0000000000000000000000000000000000000000000000000000000000000001
```

Then run:

```bash
npx hardhat test
```

Runs `test/ModredIP.ts` and `test/Marketpulse.ts` on an in-memory Hardhat network (no Base Sepolia needed).

### Option C: Test on Base Sepolia via the app

1. **Backend:** From `backend/`, set `WALLET_PRIVATE_KEY` (and optional `RPC_PROVIDER_URL`) in `.env`, then:
   ```bash
   cd backend && yarn start
   ```
2. **Frontend:** From `app/`, run the dev server and open the app.
3. **Connect wallet** to Base Sepolia and use the UI to:
   - Register an IP asset
   - Mint a license (as IP owner)
   - Pay revenue, claim royalties, etc.

Contract addresses are read from `app/src/deployed_addresses.json` (already set to your FullStack deployment).

---

## 2. Test the CRE workflow

The workflow calls an external API then sends a report to **ModredIPCREConsumer** on Base Sepolia to register an IP for `demoRegistration.beneficiary`. For a full step-by-step (contracts, config, verify on-chain), see **cre-workflows/README.md** → section **How to test the CRE integration**.

### Prerequisites

- **Bun** 1.2.21+  
- **CRE CLI** installed and **logged in** (`cre login`)
- **Consumer address** in workflow config (already set to `0x7745346B3e296e58Fd4A5D4E802144f1Facea8a0`)

### Simulation only (no onchain tx)

From the repo root:

```bash
cd cre-workflows/ip-registration-workflow
bun install
cd ..
cd cre-workflows
cre workflow simulate ip-registration-workflow --target staging-settings
```

This compiles the workflow, runs the cron trigger once, fetches the external API, and runs the logic. It will **not** send a transaction unless you use `--broadcast`.

### Simulation + onchain write (Base Sepolia)

To have the workflow actually call the consumer and register an IP on Base Sepolia:

1. Create **`cre-workflows/.env`** with a Base Sepolia account that has ETH for gas:
   ```
   CRE_ETH_PRIVATE_KEY=your_private_key_hex_without_0x
   ```

2. Set **`demoRegistration.beneficiary`** in **`cre-workflows/ip-registration-workflow/config.staging.json`** to the address that should receive the demo IP NFT (e.g. your wallet).

3. Run with **`--broadcast`**:
   ```bash
   cd cre-workflows
   cre workflow simulate ip-registration-workflow --target staging-settings --broadcast
   ```

The workflow will submit a signed report to the Forwarder; the Forwarder will call your **ModredIPCREConsumer** at `0x7745346B3e296e58Fd4A5D4E802144f1Facea8a0`, which will call **ModredIP.registerIPFor(beneficiary, ...)**. Check the new NFT for `beneficiary` on Base Sepolia (e.g. on Basescan).

---

## Quick reference

| What | Command / step |
|------|-----------------|
| Contract unit tests | `npx hardhat test` (set `DEPLOYER_PRIVATE_KEY` if config complains) |
| Contract via app | Start backend + frontend, connect wallet to Base Sepolia, use UI |
| CRE workflow (dry run) | `cd cre-workflows && cre workflow simulate ip-registration-workflow --target staging-settings` |
| CRE workflow (onchain) | Add `cre-workflows/.env` with `CRE_ETH_PRIVATE_KEY`, set `demoRegistration.beneficiary`, then add `--broadcast` to the simulate command |
| Infringement check (all IP assets) | From root: `npm run test:contract-features` (runs it at end), or from backend: `cd backend && npm run check:infringements` |
| Infringement API (all) | `GET /api/infringement/status-all?contractAddress=0x...` (contract optional if `MODRED_IP_CONTRACT_ADDRESS` or app deployed_addresses.json is set) |
