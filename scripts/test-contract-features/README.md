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
   # Optional:
   # RPC_URL=https://sepolia.base.org
   # DISPUTER_PRIVATE_KEY=...
   # ARBITRATOR_PRIVATE_KEY=...
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
- **registerIP** – register a test IP asset
- **getIPAsset** – read it back
- **mintLicense** – mint a license for that IP (same account as licensee)
- **getLicense** – read it back
- **payRevenue** – send 0.001 ETH to the IP
- **getRoyaltyInfo** – read royalty info
- **claimRoyalties** – claim royalties for the account
- **registerArbitrator** – register as arbitrator (if not already)
- **getAllArbitrators** / **getActiveArbitratorsCount** – read arbitrator state

So in one run you cover the main flows that the frontend uses: register IP → mint license → pay revenue → claim royalties, plus arbitrator registration and reads.

## Optional: dispute and arbitration

To test **raiseDispute**, **assignArbitrators**, **submitArbitrationDecision**, **resolveDisputeWithoutArbitrators**, etc., you need at least two wallets (e.g. owner vs disputer, and optionally arbitrators). You can:

- Set **DISPUTER_PRIVATE_KEY** and **ARBITRATOR_PRIVATE_KEY** and extend `run-all.ts` to use them in a second/third wallet client, or
- Add separate small scripts (e.g. `run-dispute.ts`) that use multiple keys and call the dispute/arbitration functions in sequence.

The current `run-all.ts` skips the dispute step and logs a note if you want to add it.
