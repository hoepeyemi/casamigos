# CRE Integration vs. Program Scope & Requirements

## Program focus: DeFi & Tokenization

- **DeFi**: New ideas in DeFi, stablecoins, onchain finance.
- **Tokenization**: RWAs onchain; example ideas:
  - Stablecoin issuance
  - **Tokenized asset servicing and lifecycle management**
  - Custom Proof of Reserve Data Feed

## Requirement: CRE workflow as orchestration layer

> Build, simulate, or deploy a **CRE Workflow** that’s used as an **orchestration layer** within your project. The workflow should: **Integrate at least one blockchain with an external API, system, data source, LLM, or AI agent** and demonstrate a **successful simulation (via the CRE CLI)** or a **live deployment on the CRE network**.

---

## Current state: what we have vs what’s needed

### What we have (onchain only)

| Item | Status |
|------|--------|
| **ModredIP** CRE entrypoints | ✅ `registerIPFor`, `mintLicenseByProxy`, `setCREProxy` |
| **ModredIPCREConsumer** (IReceiver) | ✅ Receives reports, decodes instructions, calls ModredIP |
| **Report format** | ✅ Documented; instruction types 0 (register IP) and 1 (mint license) |
| **CRE workflow code** | ❌ **Missing** – no TypeScript/Go workflow that runs on CRE |
| **External integration in a workflow** | ❌ **Missing** – no workflow that combines blockchain + API/LLM/AI |
| **Simulation or deployment** | ❌ **Missing** – nothing to run with CRE CLI or on CRE network |

So: we have the **consumer side** (contracts that receive CRE reports) but not the **orchestration side** (the actual workflow that uses triggers, external data, and writes onchain).

### Fit with DeFi & tokenization

- **Tokenized asset servicing / lifecycle**: Casamigos is **IP asset tokenization** (IP → NFT, licenses, royalties, disputes). That is “tokenization” and “asset servicing” (registration, licensing, revenue) in the broad sense used in the examples.
- **Stablecoins / PoR**: We do not do stablecoin issuance or Proof of Reserve; that’s a different track.
- **Conclusion**: The project fits under **tokenization + tokenized asset lifecycle**; it does not fit the stablecoin/PoR examples directly.

---

## Gaps to meet the stated requirements

1. **Implement a real CRE workflow**  
   A TypeScript (or Go) workflow that:
   - Uses CRE triggers (e.g. HTTP and/or cron).
   - Runs as the **orchestration layer** (coordinates external data + chain).

2. **Blockchain + external integration**  
   The workflow must **integrate at least one blockchain with** one of:
   - External API  
   - System  
   - Data source  
   - LLM or AI agent  

   So the workflow should do something like: **call external API (or LLM) → then write to chain** (e.g. register IP or mint license via our consumer).

3. **Demonstrate simulation or deployment**  
   - **Simulation**: Run the workflow with `cre workflow simulate ...` (CRE CLI).  
   - **Deployment**: Deploy and run the same workflow on the CRE network.

---

## Recommendation

- **Keep** the current CRE integration (ModredIP + ModredIPCREConsumer + report format): it is the correct **onchain** side for CRE.
- **Add** a **concrete CRE workflow** that:
  - Uses an **HTTP trigger** (and optionally cron) so it acts as the orchestration layer.
  - Calls an **external API** (e.g. IPFS gateway or content/rights API) to validate or fetch data.
  - Optionally uses an **LLM** (e.g. for license terms or metadata) to strengthen “external integration.”
  - Encodes a report and calls **evmClient.writeReport** to **ModredIPCREConsumer** (blockchain integration).
  - Is **runnable and simulatable** with the CRE CLI.

With that in place, the integration would:

- Use CRE as the **orchestration layer**.
- **Integrate at least one blockchain with an external API (and optionally LLM)**.
- Support **simulation (CRE CLI)** and **live deployment** on the CRE network.
- Align with the **tokenization / tokenized asset servicing** part of the program scope (IP assets and their lifecycle).

**Done:** A concrete workflow was added under **`cre-workflows/`**: cron → external API (e.g. GitHub) → writeReport to ModredIPCREConsumer. See `cre-workflows/README.md`. Run: `cre workflow simulate ip-registration-workflow --target staging-settings` (use `--broadcast` to send the tx).
