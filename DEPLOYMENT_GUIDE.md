# Contract Deployment Guide

## Current Contract Status

The application is currently using the V2 contract:
- **ModredIP**: `0x7CfdF0580C87d0c379c4a5cDbC46A036E8AF71E3`
- **Contract Key**: `ModredIPModule#ModredIP` (maintained for compatibility)
- **Status**: ✅ Active and verified to have `registerIP` function

**Note**: The contract key name "ModredIPModule#ModredIP" is maintained for backward compatibility, but the application is branded as "Sear".

## Option 2: Deploy a New Contract

### Prerequisites

1. Install dependencies:
   ```bash
   cd sear
   yarn install
   ```

2. Set up environment variable:
   Create a `.env` file or set:
   ```
   DEPLOYER_PRIVATE_KEY=your_private_key_here
   ```

### Deploy to Base Sepolia

1. **Deploy using Hardhat Ignition:**
   ```bash
   npx hardhat ignition deploy ignition/modules/ModredIP.ts --network baseSepolia
   ```

2. **After deployment**, update `app/src/deployed_addresses.json`:
   ```json
   {
     "ModredIPModule#ModredIP": "NEW_DEPLOYED_ADDRESS_HERE",
     ...
   }
   ```
   
   **Note**: The key "ModredIPModule#ModredIP" is maintained for compatibility, but the application name is "Sear".

3. **Verify the contract** (optional):
   ```bash
   npx hardhat verify --network baseSepolia DEPLOYED_ADDRESS "REGISTRY_ADDRESS" "ACCOUNT_IMPL_ADDRESS" 84532 "PLATFORM_FEE_COLLECTOR"
   ```

### Deployment Steps

1. Make sure you have ETH (testnet) in your deployer wallet for gas fees on Base Sepolia
2. Run the deployment command above
3. Copy the deployed contract address from the output
4. Update `deployed_addresses.json` with the new address
5. Restart your backend and frontend

## Option 3: Use Testing Mode (Temporary)

If you just want to test IPFS uploads without contract registration:

1. In `App.tsx` line ~1157, change:
   ```typescript
   skipContractCall: true
   ```

2. Or set environment variable in backend:
   ```
   SKIP_CONTRACT_CALL=true
   ```

## Verifying Contract Functions

To check if a contract has the `registerIP` function:

1. Visit: https://sepolia.basescan.org/address/CONTRACT_ADDRESS
2. Go to the "Contract" tab
3. Check the "Read Contract" or "Write Contract" section
4. Look for `registerIP` function

## Contract Source

The contract source is at: `searalt/contracts/ModredIP.sol`

### Key Functions

**IP Registration:**
```solidity
function registerIP(
    string memory ipHash,
    string memory metadata,
    bool isEncrypted
) public returns (uint256)
```

**License Minting:**
```solidity
function mintLicense(
    uint256 tokenId,
    uint256 royaltyPercentage,
    uint256 duration,
    bool commercialUse,
    string memory terms
) public returns (uint256)
```

**Arbitrator Management:**
```solidity
function registerArbitrator() public payable
function unstake() public nonReentrant
```

## Contract Features

- ✅ IP Asset Registration with IPFS metadata
- ✅ License Management (one license per IP enforced)
- ✅ Revenue Distribution and Royalty Claims
- ✅ Dispute Resolution with Arbitration System
- ✅ Arbitrator Registration and Unstaking
- ✅ Reputation System for Arbitrators

## Transaction Reliability

The backend includes advanced transaction reliability features:

### Nonce Management
- **Automatic Handling**: Viem automatically manages nonce (no explicit nonce setting)
- **Retry Logic**: Automatically retries up to 3 times on nonce conflicts
- **Exponential Backoff**: Waits 1s, 2s, 3s between retries (2s, 4s, 6s for RPC errors)

### Error Recovery
- **"Already Known" Detection**: Detects when transactions were submitted but errors occurred
- **Transaction Hash Recovery**: Searches last 20 blocks to find transaction hash
- **HTTP 410 Handling**: Handles RPC limitation with `pending` blockTag
- **Success Guarantee**: Returns success even when transaction hash can't be retrieved

### RPC Notes
- **Pending BlockTag**: Some RPC endpoints don't support `blockTag: 'pending'` for `eth_getTransactionCount`
- **Error Detection**: Automatically detects HTTP 410 errors related to pending blockTag
- **Automatic Recovery**: Retries with longer delays to allow RPC endpoint to recover