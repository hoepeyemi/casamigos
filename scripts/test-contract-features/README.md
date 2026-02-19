# Contract feature test scripts

These scripts exercise **the same contract features the frontend uses**, so you can verify behavior without the UI.

## Setup

1. **Deployed contract**  
   Address is read from `app/src/deployed_addresses.json` (`ModredIPModule#ModredIP`).

2. **Wallet with Base Sepolia ETH**  
   Set `TEST_PRIVATE_KEY` (hex, with or without `0x`) to a key that has testnet ETH for gas and optional value (e.g. payRevenue, registerArbitrator).

   **Recommended:** put it in a **`.env`** file in the **project root** (the script loads it automatically):

   ```
   TEST_PRIVATE_KEY=your_private_key_hex_without_0x
   # Optional: your IPFS link and metadata (like the frontend)
   # TEST_IP_HASH=ipfs://QmYourImageCID
   # TEST_IP_METADATA={"name":"My IP","description":"..."}
   # TEST_IP_ENCRYPTED=false
   # Optional: license (royalty basis points, duration seconds, commercial, terms)
   # TEST_LICENSE_ROYALTY_BPS=1000
   # TEST_LICENSE_DURATION_SECONDS=2592000
   # TEST_LICENSE_COMMERCIAL=true
   # TEST_LICENSE_TERMS=your terms
   # Optional: payRevenue amount in ETH
   # TEST_PAY_REVENUE_ETH=0.001
   # RPC_URL=...
   # DISPUTER_PRIVATE_KEY=... ARBITRATOR_PRIVATE_KEY=...
   ```

   Or set in the shell:

   ```bash
   # PowerShell
   $env:TEST_PRIVATE_KEY = "your_private_key_hex"

   # Bash
   export TEST_PRIVATE_KEY=your_private_key_hex
   ```

3. **Optional: RPC**  
   Default RPC is `https://sepolia.base.org`. Override with `RPC_URL` in `.env` or the environment if needed.

## Run all features

From the **project root**:

```bash
npm run test:contract-features
```

Or:

```bash
npx ts-node scripts/test-contract-features/run-all.ts
```

This will:

- **Read** nextTokenId, nextLicenseId, MIN_ARBITRATOR_STAKE
- **registerIP** – register an IP asset (uses `TEST_IP_HASH`, `TEST_IP_METADATA`, `TEST_IP_ENCRYPTED` from `.env`, or defaults)
- **getIPAsset** – read it back
- **mintLicense** – mint a license for that IP (uses `TEST_LICENSE_*` from `.env`, or defaults)
- **getLicense** – read it back
- **payRevenue** – send ETH to the IP (amount from `TEST_PAY_REVENUE_ETH`, default 0.001)
- **getRoyaltyInfo** – read royalty info
- **claimRoyalties** – claim royalties for the account
- **registerArbitrator** – register as arbitrator (if not already)
- **getAllArbitrators** / **getActiveArbitratorsCount** – read arbitrator state

You can put a **real IPFS image link** (e.g. from Pinata or any IPFS gateway) in `TEST_IP_HASH` and custom metadata in `TEST_IP_METADATA` so the registered IP matches what you’d create in the frontend. Same for license terms and royalty.

## Optional: dispute and arbitration

To test **raiseDispute**, **assignArbitrators**, **submitArbitrationDecision**, **resolveDisputeWithoutArbitrators**, etc., you need at least two wallets (e.g. owner vs disputer, and optionally arbitrators). You can:

- Set **DISPUTER_PRIVATE_KEY** and **ARBITRATOR_PRIVATE_KEY** and extend `run-all.ts` to use them in a second/third wallet client, or
- Add separate small scripts (e.g. `run-dispute.ts`) that use multiple keys and call the dispute/arbitration functions in sequence.

The current `run-all.ts` skips the dispute step and logs a note if you want to add it.

## Infringement check (all IP assets)

At the end of each run, the script invokes the backend infringement check for **all IP assets** (same flow as the frontend: read token IDs from the contract, then call Yakoa for each). Ensure **backend/.env** has `YAKOA_API_KEY`, `YAKOA_SUBDOMAIN`, and `YAKOA_NETWORK`. To skip, set `RUN_INFRINGEMENT_CHECK=false`. You can also run the check alone from the backend: `cd backend && npm run check:infringements`.
