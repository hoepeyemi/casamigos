# CRE Workflows – Casamigos IP Tokenization

This folder is a **Chainlink CRE (Runtime Environment)** project. The workflow acts as an **orchestration layer** that:

1. **Integrates one blockchain (Base Sepolia) with an external API** – fetches from a public API (e.g. GitHub), then writes to the ModredIP consumer contract.
2. **Uses CRE as the orchestration layer** – cron trigger → HTTP capability (external API) → EVM write (onchain).

So it satisfies the requirement: *"Integrate at least one blockchain with an external API, system, data source, LLM, or AI agent"* and *"CRE Workflow used as orchestration layer"*.

## Prerequisites

- **Bun** 1.2.21+ ([install](https://bun.sh))
- **CRE CLI** ([install](https://docs.chain.link/cre/getting-started/cli-installation/macos-linux))
- **CRE account** and `cre login`
- **Base Sepolia** consumer: deploy `ModredIPCREConsumer`, set it on `ModredIP.setCREProxy(consumer)`, and put the consumer address in the workflow config.

## Setup

1. **From repo root, go to the workflow directory:**
   ```bash
   cd cre-workflows/ip-registration-workflow
   ```

2. **Install dependencies (Bun):**
   ```bash
   bun install
   ```

3. **Configure consumer address**  
   Edit `config.staging.json` (and `config.production.json` if needed):
   - Set `evms[0].consumerAddress` to your **ModredIPCREConsumer** address.
   - Optionally set `demoRegistration.beneficiary` to the address that should receive the demo IP NFT (must be valid for simulation/deploy).

4. **Secrets (for simulation with onchain write)**  
   In `cre-workflows/.env` (create from `cre-workflows/.env.example` if present):
   ```bash
   CRE_ETH_PRIVATE_KEY=your_base_sepolia_private_key_hex
   ```
   Use an account with Base Sepolia ETH (for gas when the workflow writes onchain).

## Run simulation (CRE CLI)

From the **CRE project root** (`cre-workflows/`, not inside `ip-registration-workflow/`):

```bash
cd cre-workflows
cre workflow simulate ip-registration-workflow --target staging-settings
```

With a deployed consumer and valid config, use `--broadcast` to send the transaction to Base Sepolia:

```bash
cre workflow simulate ip-registration-workflow --target staging-settings --broadcast
```

This demonstrates:

- **External API**: workflow calls `apiUrl` (Yakoa backend: `http://localhost:5000/api/yakoa` when backend is running locally; use your deployed backend URL for production).
- **Blockchain**: workflow reads `nextTokenId` from ModredIP, then submits two signed reports to **ModredIPCREConsumer**: (1) register IP for `demoRegistration.beneficiary`, (2) mint license for that token (using `demoLicense` in config).
- **Yakoa**: after the register IP tx, the workflow POSTs to the backend **POST /api/yakoa/register** so the new IP asset is registered with Yakoa for infringement monitoring (backend must be running and reachable at `apiUrl`).

### CRE workflow vs `yarn test:contract-features`

The CRE workflow mirrors the **onchain parts** that the consumer supports:

| Step | CRE workflow | yarn test:contract-features |
|------|---------------------------|-----------------------------|
| Register IP | ✅ Report 1 → `registerIPFor` | ✅ `registerIP` |
| Mint license | ✅ Report 2 → `mintLicenseByProxy` | ✅ `mintLicense` |
| Pay revenue | ❌ (no proxy) | ✅ `payRevenue` |
| Claim royalties | ❌ (no proxy) | ✅ `claimRoyalties` |
| Register arbitrator | ❌ (no proxy) | ✅ `registerArbitrator` |
| Disputes | ❌ (different signer) | ✅ optional |
| Yakoa / infringement | ❌ (backend script) | ✅ at end |

For **payRevenue**, **claimRoyalties**, **registerArbitrator**, **disputes**, and **Yakoa infringement**, run `yarn test:contract-features` from the repo root (or use the app/backend). The CRE workflow needs `evms[0].modredIPAddress` (for EVM read of `nextTokenId`) and `demoLicense` (royaltyBps, durationSec, commercialUse, terms) in config for the register + mint-license flow.

## How to test the CRE integration (step-by-step)

1. **Ensure contracts are deployed and wired**
   - **ModredIP** and **ModredIPCREConsumer** must be deployed on Base Sepolia (e.g. via `npx hardhat ignition deploy ... --network baseSepolia` or your full-stack deploy).
   - **ModredIP** must have the consumer set as CRE proxy: `ModredIP.setCREProxy(ModredIPCREConsumerAddress)` (owner only). See `CRE_INTEGRATION.md` and `ignition/modules/ModredIPCREConsumer.ts`.
   - Consumer address is in `app/src/deployed_addresses.json` as `ModredIPModule#ModredIPCREConsumer`; use that in the workflow config.

2. **Install CRE CLI and log in**
   - Install: [CRE CLI](https://docs.chain.link/cre/getting-started/cli-installation/macos-linux).
   - Run `cre login` and complete the login flow.

3. **Configure the workflow**
   - In `cre-workflows/ip-registration-workflow/config.staging.json`:
     - `evms[0].consumerAddress`: your **ModredIPCREConsumer** address (e.g. from `deployed_addresses.json`).
     - `demoRegistration.beneficiary`: an address that will receive the demo IP NFT (use your own wallet or a test address).
   - Optional: set `demoRegistration.ipHash` and `demoRegistration.metadata` to custom values.

4. **Secrets for onchain write**
   - In `cre-workflows/.env` (create the file if it doesn’t exist):
     - `CRE_ETH_PRIVATE_KEY=<hex_private_key>` for an account with Base Sepolia ETH (used when running with `--broadcast`).

5. **Run a dry-run (no chain write)**
   - For the workflow to reach the Yakoa backend API (`apiUrl`), start the backend first: `cd backend && npm start` (or set `apiUrl` in config to your deployed backend URL).
   - From repo root:
     ```bash
     cd cre-workflows
     cre workflow simulate ip-registration-workflow --target staging-settings
     ```
   - You should see the workflow call the Yakoa backend and build the report. It will **not** send a transaction unless you add `--broadcast`.

6. **Run with broadcast (real onchain registration)**
   - From `cre-workflows/`:
     ```bash
     cre workflow simulate ip-registration-workflow --target staging-settings --broadcast
     ```
   - The workflow will submit a signed report to **ModredIPCREConsumer**; the consumer will call **ModredIP.registerIPFor(beneficiary, ipHash, metadata, isEncrypted)**. Check the logs for the transaction hash.

7. **Verify on-chain**
   - On [Basescan (Base Sepolia)](https://sepolia.basescan.org/), look up the ModredIP contract and confirm a new IP was registered (e.g. check `nextTokenId` or events).
   - Optionally call `ModredIP.getIPAsset(tokenId)` for the new token and confirm `beneficiary` is the owner.

If simulation fails with "consumerAddress not configured", set `evms[0].consumerAddress` in `config.staging.json`. If broadcast fails, ensure `CRE_ETH_PRIVATE_KEY` is set and the account has Base Sepolia ETH. If you see **"invalid chain ID"** on WriteReport, use the official Base Sepolia RPC in `project.yaml` (`url: https://sepolia.base.org`) so the write capability sees chain ID 84532. **Note:** The log "Read nextTokenId: 9" means the *next* token to be created will be ID 9 (eight tokens already exist). No new token is created until the write succeeds; if WriteReport fails, nothing is minted. If you see **"nonce too low"** on the second WriteReport (mint license), run the workflow twice: first run creates the IP (register only); second run you can mint a license for that token (or run register + mint again; the delay between txs may resolve). The CRE runtime does not support `setTimeout`, so we cannot wait in-process between the two writes.

## Workflow behavior

- **Trigger:** Cron (schedule in `config.staging.json` / `config.production.json`).
- **Steps:**
  1. HTTP GET to `config.apiUrl` (Yakoa backend; consensus over DON).
  2. Build report: `instructionType = 0` (register IP) with `demoRegistration` (beneficiary, ipHash, metadata, isEncrypted).
  3. `runtime.report()` → `evmClient.writeReport()` to `consumerAddress`.
- **Result:** ModredIPCREConsumer receives the report and calls `ModredIP.registerIPFor(beneficiary, ipHash, metadata, isEncrypted)`.

## Deploying to CRE network

After simulation works:

1. Use production target and your CRE project/deploy flow (see [Chainlink CRE deployment docs](https://docs.chain.link/cre/)).
2. Ensure `config.production.json` has the correct `consumerAddress` and `chainName` for your chain.

## Alignment with program requirements

| Requirement | How it’s met |
|-------------|----------------|
| CRE Workflow as orchestration layer | This workflow orchestrates external API + onchain write. |
| Integrate at least one blockchain with external API/data source | Base Sepolia (EVM) + HTTP GET to public API (e.g. GitHub). |
| Demonstrate simulation or live deployment | Run `cre workflow simulate ...` (and optionally `--broadcast`); deploy to CRE when ready. |
| DeFi / Tokenization scope | IP asset tokenization and lifecycle (registration, licensing) via ModredIP. |
