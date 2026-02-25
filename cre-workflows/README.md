# CRE Workflows – Casamigos IP Tokenization

This folder is a **Chainlink CRE (Runtime Environment)** project. The workflow acts as an **orchestration layer** that:

1. **Integrates one blockchain (Base Sepolia) with an external API** – fetches from the backend API, then writes to the ModredIP consumer contract and registers IP with Yakoa for infringement monitoring.
2. **Uses CRE as the orchestration layer** – cron trigger (3 steps: register IP → mint license → register for infringement) and EVM log trigger (store contract events to a file).
3. **Stores contract events** – EVM log trigger decodes (or stores raw) ModredIP/Consumer events and POSTs them to the backend; they are appended to **`backend/data/cre-events.jsonl`** (one JSON line per event; `eventName` is the transaction hash).

This satisfies: *"Integrate at least one blockchain with an external API, system, data source, LLM, or AI agent"* and *"CRE Workflow used as orchestration layer"*.

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

**Trigger options:**

- **1 – cron-trigger**: Runs the 3-step flow: (1) Register IP on-chain, (2) Mint license on-chain, (3) POST to `apiUrl/api/register-ip-yakoa` to register the IP with Yakoa for infringement. Requires backend running at `apiUrl` (e.g. `http://localhost:5000`).
- **2 – evm LogTrigger**: Simulates an EVM log event. You provide a transaction hash and event index; the workflow decodes (or stores as Unknown) and POSTs to `apiUrl/api/cre-events`. Events are stored in **`backend/data/cre-events.jsonl`**; each event uses the **transaction hash** as `eventName`.

To avoid interactive prompt (e.g. in CI), pipe the choice: `echo 1 | cre workflow simulate ...` or `echo 2 | cre workflow simulate ...`.

### CRE workflow vs `yarn test:contract-features`

The CRE workflow mirrors the **onchain parts** that the consumer supports:

| Step | CRE workflow | yarn test:contract-features |
|------|---------------------------|-----------------------------|
| Register IP | ✅ Step 1 → Report 1 → `registerIPFor` | ✅ `registerIP` |
| Mint license | ✅ Step 2 → Report 2 → `mintLicenseByProxy` | ✅ `mintLicense` |
| Yakoa / infringement | ✅ Step 3 → POST `/api/register-ip-yakoa` (same logic as `register-ip-to-yakoa.ts`) | ✅ at end |
| Pay revenue | ❌ (no proxy) | ✅ `payRevenue` |
| Claim royalties | ❌ (no proxy) | ✅ `claimRoyalties` |
| Register arbitrator | ❌ (no proxy) | ✅ `registerArbitrator` |
| Disputes | ❌ (different signer) | ✅ optional |
| Event storage | ✅ EVM log trigger → POST `/api/cre-events` → `backend/data/cre-events.jsonl` | N/A |

For **payRevenue**, **claimRoyalties**, **registerArbitrator**, and **disputes**, run `yarn test:contract-features` or use the app/backend. The CRE workflow needs `evms[0].modredIPAddress`, `evms[0].consumerAddress`, `apiUrl`, and `demoLicense` in config. Backend must expose `POST /api/register-ip-yakoa` and `POST /api/cre-events` (see [CRE_INTEGRATION.md](../CRE_INTEGRATION.md)).

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

### Cron trigger

- **Schedule:** From `config.staging.json` / `config.production.json` (e.g. `*/30 * * * * *`).
- **Steps:**
  1. **External API:** HTTP GET to `config.apiUrl` (CRE requirement: external data source).
  2. **Step 1 – Register IP:** Build report `instructionType = 0` with `demoRegistration` → `evmClient.writeReport()` to `consumerAddress` → ModredIPCREConsumer calls `ModredIP.registerIPFor`.
  3. **Step 2 – Mint license:** Build report `instructionType = 1` with `demoLicense` and the new token id → `writeReport()` → consumer calls `ModredIP.mintLicenseByProxy`.
  4. **Step 3 – Infringement:** POST to `apiUrl + '/api/register-ip-yakoa'` with contractAddress, tokenId, register tx hash, ipHash, metadata, etc. Backend registers the IP with Yakoa (same logic as `backend/src/scripts/register-ip-to-yakoa.ts`).

### EVM log trigger

- **Filter:** ModredIP and ModredIPCREConsumer addresses; topic0 hashes for IPRegistered, LicenseMinted, RevenuePaid, RoyaltyClaimed, DisputeRaised, DisputeResolved, IPTransferred, IPRegisteredViaCRE, LicenseMintedViaCRE.
- **On log:** Decode with ABI if possible; otherwise store as Unknown with raw `eventSignature`, `topics`, `data`. Every stored event uses the **transaction hash** as `eventName`.
- **Storage:** POST payload to `apiUrl + '/api/cre-events'`; backend appends to **`backend/data/cre-events.jsonl`** (one JSON line per event). GET `/api/cre-events` returns all stored events.

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
