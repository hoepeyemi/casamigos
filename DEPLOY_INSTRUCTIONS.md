# Contract Redeployment Instructions

## Prerequisites

1. **Set your deployer private key** (the wallet that will deploy the contract):
   
   **PowerShell:**
   ```powershell
   $env:DEPLOYER_PRIVATE_KEY = "your_private_key_without_0x_prefix"
   ```
   
   **Or create a `.env` file** in the `searalt` directory:
   ```
   DEPLOYER_PRIVATE_KEY=your_private_key_without_0x_prefix
   ```

2. **Ensure you have ETH (testnet)** in your deployer wallet for gas fees on Base Sepolia. Get free testnet ETH from a [Base Sepolia faucet](https://www.coinbase.com/faucets/base-ethereum-goerli-faucet) or [Alchemy Base Sepolia Faucet](https://www.alchemy.com/faucets/base-sepolia).

## Step 2: Deploy the Contract

From the project root run:

**PowerShell:**
```powershell
npx hardhat ignition deploy ignition/modules/ModredIP.ts --network baseSepolia
```

**Or use the deployment script:**
```powershell
.\deploy.ps1
```

## Deploy all contracts (including CRE consumer)

To deploy **everything in one go** (ERC6551Registry, ERC6551Account, ModredIP, **ModredIPCREConsumer**, and wire `ModredIP.setCREProxy(consumer)`):

**PowerShell:**
```powershell
.\deploy-full.ps1
```

**With CRE Forwarder address** (get it from [Chainlink Forwarder Directory](https://docs.chain.link/cre/guides/workflow/using-evm-client/forwarder-directory)):
```powershell
$env:CRE_FORWARDER_ADDRESS = "0x..."; .\deploy-full.ps1
```

**Bash:**
```bash
./deploy-full.sh
# or with forwarder:
CRE_FORWARDER_ADDRESS=0x... ./deploy-full.sh
```

**Note:** You do **not** deploy CRE’s Forwarder (KeystoneForwarder/MockForwarder)—Chainlink hosts it. You only need its address. If you omit `CRE_FORWARDER_ADDRESS`, the consumer is deployed with `0x0` and you can set the real forwarder later: `consumer.setForwarderAddress(forwarderAddress)`.

After full-stack deploy, the CLI prints addresses for `FullStackModule#modredIP` and `FullStackModule#consumer`. Put the **ModredIP** address in `app/src/deployed_addresses.json` as `"ModredIPModule#ModredIP"` (so the app keeps working). Add the consumer address there too if your app or CRE workflow needs it.

## Step 3: Update Contract Address

After deployment, you'll see output like:
```
✅ ModredIPModule#ModredIP deployed to: 0x...
```

1. **Copy the deployed contract address**

2. **Update `app/src/deployed_addresses.json`:**
   ```json
   {
     "ModredIPModule#ModredIP": "NEW_DEPLOYED_ADDRESS_HERE"
   }
   ```

3. **Also update `ignition/deployments/chain-84532/deployed_addresses.json`** (optional, created after first deploy to Base Sepolia)

## Step 4: Restart Services

1. **Restart your backend server** (if running)
2. **Refresh your frontend** (or restart the dev server)

## Verification

After deployment, verify the contract has the `unstake` function:

1. Visit: https://sepolia.basescan.org/address/YOUR_NEW_CONTRACT_ADDRESS
2. Go to the "Contract" tab
3. Check for the `unstake` function in the "Write Contract" section

## Troubleshooting

### "already known" Error

If you get an `already known` error during deployment, it means there's a pending transaction with the same nonce. Solutions:

1. **Wait for pending transactions to confirm:**
   - Check your deployer address on the explorer: https://sepolia.basescan.org/address/YOUR_DEPLOYER_ADDRESS
   - Wait for any pending transactions to be confirmed (usually 1-2 minutes)
   - Then try deploying again

2. **Check nonce status:**
   ```powershell
   node check-nonce.js
   ```
   This will show if you have pending transactions.

3. **Wait and retry:**
   - Wait 2-3 minutes
   - Run the deployment command again

**Note**: The backend now includes automatic retry logic that handles "already known" errors. If you see this error in the backend logs, the system will automatically retry the transaction.

### HTTP 410 Error (RPC Limitation)

If you encounter HTTP 410 errors related to `pending` blockTag:

- **Cause**: Some RPC endpoints don't support `blockTag: 'pending'` for `eth_getTransactionCount`
- **Solution**: The backend automatically detects and handles these errors
- **Retry**: The system will automatically retry with longer delays (2s, 4s, 6s)
- **Recovery**: Transaction hash recovery from recent blocks if available

### Other Issues

- **"Missing env var DEPLOYER_PRIVATE_KEY"**: Make sure you set the environment variable before running the deploy command
- **"Insufficient funds"**: Make sure your deployer wallet has ETH on Base Sepolia for gas (use a faucet if needed)
- **Network errors**: Check your internet connection and that the Base Sepolia RPC (https://sepolia.base.org) is accessible

## What Changed

The new contract includes:
- `unstake()` function - allows arbitrators to withdraw their stake
- `ArbitratorUnstaked` event - emitted when an arbitrator unstakes
- Safety check - prevents unstaking if assigned to active disputes

