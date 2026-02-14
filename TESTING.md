# Testing the Contracts & CRE Workflow

You can test (1) the **smart contracts** locally or on Base Sepolia, and (2) the **CRE workflow** via simulation and optional onchain broadcast.

---

## 1. Test the smart contracts

### Option A: Contract feature script (same features as frontend, on Base Sepolia)

From the project root, one wallet runs through the main contract flows (register IP, mint license, pay revenue, claim royalties, register arbitrator, etc.):

```bash
# Set a wallet that has Base Sepolia ETH (for gas and small value for payRevenue/registerArbitrator)
$env:TEST_PRIVATE_KEY = "your_private_key_hex"   # PowerShell
# export TEST_PRIVATE_KEY=your_private_key_hex  # Bash

npm run test:contract-features
```

See `scripts/test-contract-features/README.md` for details and optional DISPUTER_PRIVATE_KEY / ARBITRATOR_PRIVATE_KEY for dispute flows.

### Option B: Local Hardhat tests (no chain)

From the project root:

```bash
# Set a dummy key if Hardhat config requires it (tests use local network)
$env:DEPLOYER_PRIVATE_KEY = "0000000000000000000000000000000000000000000000000000000000000001"   # PowerShell
# export DEPLOYER_PRIVATE_KEY=0000000000000000000000000000000000000000000000000000000000000001  # Bash

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

The workflow calls an external API then sends a report to **ModredIPCREConsumer** on Base Sepolia to register an IP for `demoRegistration.beneficiary`.

### Prerequisites

- **Bun** 1.2.21+  
- **CRE CLI** installed and **logged in** (`cre login`)
- **Consumer address** in workflow config (already set to `0x7cd99Ccd031664C36Ae073052eD5e8af009a2818`)

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

The workflow will submit a signed report to the Forwarder; the Forwarder will call your **ModredIPCREConsumer** at `0x7cd99Ccd031664C36Ae073052eD5e8af009a2818`, which will call **ModredIP.registerIPFor(beneficiary, ...)**. Check the new NFT for `beneficiary` on Base Sepolia (e.g. on Basescan).

---

## Quick reference

| What | Command / step |
|------|-----------------|
| Contract unit tests | `npx hardhat test` (set `DEPLOYER_PRIVATE_KEY` if config complains) |
| Contract via app | Start backend + frontend, connect wallet to Base Sepolia, use UI |
| CRE workflow (dry run) | `cd cre-workflows && cre workflow simulate ip-registration-workflow --target staging-settings` |
| CRE workflow (onchain) | Add `cre-workflows/.env` with `CRE_ETH_PRIVATE_KEY`, set `demoRegistration.beneficiary`, then add `--broadcast` to the simulate command |
