# Base Sepolia IP Management Backend

This backend service provides IP (Intellectual Property) management functionality on Base Sepolia using the ModredIP smart contract.

## Features

- **IP Registration**: Register IP assets on Base Sepolia using ModredIP contract
- **License Minting**: Mint licenses for IP assets with customizable terms
- **License Validation**: Enforces one license per IP asset (prevents duplicate licenses)
- **IPFS Integration**: Upload metadata to IPFS for decentralized storage
- **Yakoa Integration**: Submit registered IPs to Yakoa for monitoring
- **Nonce Management**: Automatic retry logic with exponential backoff for transaction reliability
- **Error Handling**: Comprehensive error handling with user-friendly messages

## Environment Variables

Create a `.env` file in the backend directory:

```env
WALLET_PRIVATE_KEY=your_private_key_here
RPC_PROVIDER_URL=https://sepolia.base.org
NFT_CONTRACT_ADDRESS=optional_nft_contract_address
```

## API Endpoints

### IP Registration
- **POST** `/api/register`
- **Body**:
  ```json
  {
    "ipHash": "ipfs://Qm...",
    "metadata": "{\"name\":\"IP Asset Name\",\"description\":\"...\",...}",
    "isEncrypted": false,
    "searContractAddress": "0x7CfdF0580C87d0c379c4a5cDbC46A036E8AF71E3",
    "skipContractCall": false
  }
  ```
- **Response**: Returns transaction hash, IP asset ID, block number, and explorer URL
- **Note**: Supports legacy `modredIpContractAddress` parameter for backward compatibility

### CRE workflow integration

- **POST** `/api/cre-events` – Append one CRE event payload (from the CRE EVM log trigger). Body: `eventName`, optional `contractAddress`, `blockNumber`, `txHash`, `logIndex`, `args`. Events are stored in **`backend/data/cre-events.jsonl`** (one JSON object per line; `receivedAt` added server-side). Used by the CRE workflow when it receives contract events.
- **GET** `/api/cre-events` – Return all stored events from `data/cre-events.jsonl` (for debugging).
- **POST** `/api/register-ip-yakoa` – Register an on-chain IP with Yakoa (same logic as `src/scripts/register-ip-to-yakoa.ts`). Used by the CRE workflow after register IP + mint license. Body: `contractAddress`, `tokenId`, `txHash`, `ipHash`, `metadata` (string or object), optional `blockNumber`, `isEncrypted`, `creatorId`. If `blockNumber` is omitted, the backend fetches it from the chain via the tx hash. Requires `YAKOA_API_KEY`, `YAKOA_SUBDOMAIN`, `YAKOA_NETWORK` in backend `.env`.

### Infringement (Yakoa)
- **GET** `/api/infringement/status/:contractAddress/:tokenId` – infringement status for one IP asset (same as frontend).
- **GET** `/api/infringement/status-all?contractAddress=0x...` – infringement status for **all IP assets** of the contract. Contract is optional if `MODRED_IP_CONTRACT_ADDRESS` is set in backend `.env` or `app/src/deployed_addresses.json` exists.

**Script:** From the backend directory, run `npm run check:infringements` to check all IP assets and print results to the console. Requires `YAKOA_API_KEY`, `YAKOA_SUBDOMAIN`, and `YAKOA_NETWORK` in backend `.env`.

### License Minting
- **POST** `/api/license/mint`
- **Body**:
  ```json
  {
    "tokenId": 1,
    "royaltyPercentage": 10,
    "duration": 86400,
    "commercialUse": true,
    "terms": "{\"transferable\":true,\"commercialAttribution\":true,...}",
    "searContractAddress": "0x7CfdF0580C87d0c379c4a5cDbC46A036E8AF71E3"
  }
  ```
- **Validation**: Automatically checks if a license already exists for the IP asset
- **Error**: Returns error if attempting to mint a second license for the same IP
- **Response**: Returns transaction hash, block number, and explorer URL

## Network Configuration

- **Network**: Base Sepolia
- **Chain ID**: 84532
- **RPC URL**: https://sepolia.base.org
- **Explorer**: https://sepolia.basescan.org
- **Native Token**: ETH

## Smart Contracts

- **Sear**: Main contract for IP registration and license management
- **ERC6551Registry**: Token-bound account registry
- **ERC6551Account**: Token-bound account implementation

## Installation

```bash
cd backend
yarn install
```

## Running the Server

```bash
yarn start
```

The server will start on port 5000 by default.

**Note**: The server uses `ts-node` to run TypeScript directly, so changes to source files are picked up automatically on restart.

## Transaction Reliability

The backend includes advanced automatic retry logic for blockchain transactions:
- **Nonce Management**: Let viem handle nonce automatically to avoid conflicts (no explicit nonce setting)
- **Retry Logic**: Automatically retries up to 3 times on nonce conflicts with exponential backoff
- **HTTP 410 Error Handling**: Detects and handles RPC limitation with `pending` blockTag
- **"Already Known" Recovery**: Detects when transactions were submitted but errors occurred, searches recent blocks for transaction hash
- **Error Handling**: Provides clear error messages for transaction failures
- **Race Condition Protection**: Handles concurrent transaction requests gracefully
- **Transaction Hash Recovery**: Searches last 20 blocks to find transaction hash when "already known" errors occur
- **Success Notification**: Returns success response even when transaction hash can't be retrieved (transaction was submitted)

## Key Features

1. **Network**: Base Sepolia (Chain ID: 84532)
2. **Token**: Using native ETH for transactions
3. **Contracts**: Sear contract for IP management
4. **License Validation**: Enforces one license per IP asset
5. **Transaction Reliability**: Automatic retry with intelligent nonce management
6. **Error Handling**: Comprehensive error messages and recovery
7. **RPC Error Recovery**: Handles HTTP 410 errors from RPC `pending` blockTag limitation
8. **Transaction Recovery**: Recovers transaction hashes from recent blocks when errors occur
9. **Success Guarantee**: Returns success even when transaction hash can't be retrieved (transaction was submitted)

## Error Handling Details

### Nonce Errors
- Detects "already known" and "nonce too low" errors
- Automatically retries with exponential backoff
- Searches recent blocks to recover transaction hash
- Returns success response if transaction was submitted

### HTTP 410 Errors (RPC Limitation)
- Some RPC endpoints don't support `blockTag: 'pending'` for `eth_getTransactionCount`
- Detects HTTP 410 errors related to pending blockTag
- Uses longer retry delays (2s, 4s, 6s) for RPC errors
- Automatically retries up to 3 times

### Transaction Hash Recovery
- When "already known" error occurs, searches last 20 blocks
- Matches transactions by: from address, to address, and function selector
- If hash found, waits for receipt and returns success
- If hash not found but error suggests submission, returns success with warning

## Recent Updates

- ✅ **CRE integration:** `POST /api/cre-events` (append events to `data/cre-events.jsonl`), `GET /api/cre-events` (read stored events), `POST /api/register-ip-yakoa` (register IP with Yakoa; used by CRE workflow after register + mint license; fetches block number from chain if omitted).
- ✅ Renamed from "ModredIP" to "Sear" throughout the codebase
- ✅ Added license validation (one license per IP)
- ✅ Improved nonce handling - removed explicit nonce setting, let viem handle automatically
- ✅ Enhanced error messages and user feedback
- ✅ Updated contract address (0x7CfdF0580C87d0c379c4a5cDbC46A036E8AF71E3)
- ✅ HTTP 410 error detection and handling for RPC `pending` blockTag limitation
- ✅ "Already known" transaction error detection and recovery
- ✅ Transaction hash recovery from recent blocks (searches last 20 blocks)
- ✅ Success response even when transaction hash can't be retrieved
- ✅ Enhanced retry logic with longer delays for RPC errors (2s, 4s, 6s vs 1s, 2s, 3s)
- ✅ Improved error detection checking error body, status codes, and nested cause chains 