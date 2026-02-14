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

- **External API**: workflow calls `apiUrl` (e.g. GitHub API) via CRE HTTP capability.
- **Blockchain**: workflow submits a signed report to **ModredIPCREConsumer** on Base Sepolia (register IP for `demoRegistration.beneficiary`).

## Workflow behavior

- **Trigger:** Cron (schedule in `config.staging.json` / `config.production.json`).
- **Steps:**
  1. HTTP GET to `config.apiUrl` (external API; consensus over DON).
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
