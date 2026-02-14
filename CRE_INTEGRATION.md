# Chainlink CRE (Runtime Environment) Integration

The ModredIP contracts are wired to work with **Chainlink CRE**: workflows can register IP assets and mint licenses via signed reports, with verification handled by the Chainlink KeystoneForwarder.

## Architecture

- **ModredIP**: Core IP contract. New CRE-only entrypoints:
  - `registerIPFor(beneficiary, ipHash, metadata, isEncrypted)` – only callable by the CRE proxy.
  - `mintLicenseByProxy(tokenId, licensee, royaltyPercentage, duration, commercialUse, terms)` – only callable by the CRE proxy.
  - `setCREProxy(address)` – owner sets the trusted CRE consumer address.
- **ModredIPCREConsumer**: Implements the CRE `IReceiver` interface (via `ReceiverTemplate`). Receives reports from the Forwarder, decodes the instruction, and calls ModredIP.

Flow: **CRE Workflow** → signs report → **KeystoneForwarder** (validates) → **ModredIPCREConsumer.onReport()** → **ModredIP** (`registerIPFor` or `mintLicenseByProxy`).

## Report Format

Reports are `abi.encode(uint8 instructionType, bytes params)`:

| instructionType | Params (abi.encode) | Effect |
|------------------|---------------------|--------|
| `0` | `(address beneficiary, string ipHash, string metadata, bool isEncrypted)` | Registers IP and mints NFT to `beneficiary`. |
| `1` | `(uint256 tokenId, address licensee, uint256 royaltyPercentage, uint256 duration, bool commercialUse, string terms)` | Mints a license for `tokenId` to `licensee` on behalf of the current IP owner. |

## Deployment

### 1. Deploy ModredIP (if needed)

```bash
npx hardhat ignition deploy ignition/modules/ModredIP.ts --network baseSepolia
```

### 2. Deploy ModredIPCREConsumer

The default **Forwarder** address for Base Sepolia is set in `ignition/constants.ts` (`0x15fc6ae953e024d975e77382eeec56a9101f9f88`). Override with `CRE_FORWARDER_ADDRESS` or see the [CRE Forwarder Directory](https://docs.chain.link/cre/guides/workflow/using-evm-client/forwarder-directory).

```bash
# Optional: override forwarder
export CRE_FORWARDER_ADDRESS=0x...

npx hardhat ignition deploy ignition/modules/ModredIPCREConsumer.ts \
  --network baseSepolia \
  --parameters '{"ModredIPCREConsumerModule":{"modredIPAddress":"0xYOUR_MODRED_IP_ADDRESS","forwarderAddress":"'${CRE_FORWARDER_ADDRESS:-0x15fc6ae953e024d975e77382eeec56a9101f9f88}'"}}'
```

Or use the full-stack deploy (see DEPLOY_INSTRUCTIONS.md), which deploys the consumer with the default forwarder.

### 3. Set CRE proxy on ModredIP

So that only the consumer can call CRE-only functions:

```bash
# From ModredIP owner
cast send <ModredIP_ADDRESS> "setCREProxy(address)" <ModredIPCREConsumer_ADDRESS> --private-key $OWNER_KEY
```

Or call `modredIP.setCREProxy(consumerAddress)` from your deploy script.

## CRE Workflow Example (TypeScript)

```typescript
import { cre } from "@chainlink/cre-sdk";
import { encodeAbiParameters, parseAbiParameters } from "viem";

// Register IP via CRE
const instructionType = 0;
const params = encodeAbiParameters(
  parseAbiParameters("address beneficiary, string ipHash, string metadata, bool isEncrypted"),
  [beneficiaryAddress, ipHash, metadata, isEncrypted]
);
const reportData = encodeAbiParameters(
  parseAbiParameters("uint8 instructionType, bytes params"),
  [instructionType, params]
);

const reportResponse = runtime.report({
  encodedPayload: hexToBase64(reportData),
  encoderName: "evm",
  signingAlgo: "ecdsa",
  hashingAlgo: "keccak256",
}).result();

const resp = evmClient.writeReport(runtime, {
  receiver: modredIPCREConsumerAddress, // your ModredIPCREConsumer address
  report: reportResponse,
  gasConfig: { gasLimit: "500000" },
}).result();
```

## Security

- **ModredIPCREConsumer** inherits **ReceiverTemplate**: only the configured Forwarder can call `onReport`.
- Optionally restrict reports by workflow ID, workflow owner, or workflow name via the template setters (`setExpectedWorkflowId`, `setExpectedAuthor`, `setExpectedWorkflowName`).
- **ModredIP** only accepts `registerIPFor` and `mintLicenseByProxy` from the address set with `setCREProxy` (the consumer).

## References

- [CRE: Building Consumer Contracts](https://docs.chain.link/cre/guides/workflow/using-evm-client/onchain-write/building-consumer-contracts)
- [CRE Forwarder Directory](https://docs.chain.link/cre/guides/workflow/using-evm-client/forwarder-directory)
- [CRE Onchain Write (Go)](https://docs.chain.link/cre/guides/workflow/using-evm-client/onchain-write/overview-go)
