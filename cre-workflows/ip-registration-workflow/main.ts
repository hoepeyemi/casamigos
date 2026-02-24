/**
 * CRE Workflow: IP Registration (orchestration layer)
 *
 * Cron trigger flow (step by step):
 *   1. Register IP asset (on-chain via ModredIPCREConsumer)
 *   2. Mint license for the IP asset (on-chain)
 *   3. Register the IP for infringement monitoring (backend → Yakoa, same logic as register-ip-to-yakoa.ts)
 *
 * Also: EVM log trigger → decode events → POST to backend cre-events.jsonl.
 */

import {
  CronCapability,
  EVMClient,
  HTTPClient,
  handler,
  Runner,
  getNetwork,
  hexToBase64,
  bytesToHex,
  consensusMedianAggregation,
  encodeCallMsg,
  LAST_FINALIZED_BLOCK_NUMBER,
  type NodeRuntime,
  type Runtime,
} from "@chainlink/cre-sdk";
import {
  encodeAbiParameters,
  parseAbiParameters,
  encodeFunctionData,
  decodeFunctionResult,
  parseAbi,
  decodeEventLog,
  keccak256,
  toBytes,
  type Address,
  zeroAddress,
} from "viem";

const INSTRUCTION_REGISTER_IP = 0;
const INSTRUCTION_MINT_LICENSE = 1;

const MODRED_IP_ABI = parseAbi(["function nextTokenId() view returns (uint256)"]);

// Events we listen to (ModredIP + ModredIPCREConsumer). Topic0 = keccak256(eventSignature).
const MODRED_IP_EVENTS_ABI = parseAbi([
  "event IPRegistered(uint256 indexed tokenId, address indexed owner, string ipHash)",
  "event LicenseMinted(uint256 indexed licenseId, uint256 indexed tokenId, address indexed licensee)",
  "event RevenuePaid(uint256 indexed tokenId, uint256 amount)",
  "event RoyaltyClaimed(uint256 indexed tokenId, address indexed claimant, uint256 amount)",
  "event DisputeRaised(uint256 indexed disputeId, uint256 indexed tokenId, address indexed disputer)",
  "event DisputeResolved(uint256 indexed disputeId, uint256 indexed tokenId, bool resolved)",
  "event IPTransferred(uint256 indexed tokenId, address indexed from, address indexed to)",
  "event IPRegisteredViaCRE(address indexed beneficiary, uint256 tokenId, string ipHash)",
  "event LicenseMintedViaCRE(uint256 indexed tokenId, address indexed licensee, uint256 licenseId)",
]);

function eventTopic0(signature: string): `0x${string}` {
  return keccak256(toBytes(signature));
}

type EvmConfig = {
  chainName: string;
  modredIPAddress?: string;
  consumerAddress: string;
  gasLimit: string;
};

type DemoRegistration = {
  beneficiary: string;
  ipHash: string;
  metadata: string;
  isEncrypted: boolean;
};

type DemoLicense = {
  royaltyBps: number;
  durationSec: number;
  commercialUse: boolean;
  terms: string;
};

type Config = {
  schedule: string;
  apiUrl: string;
  evms: EvmConfig[];
  demoRegistration?: DemoRegistration;
  demoLicense?: DemoLicense;
};

type WorkflowResult = {
  externalApiFetched: boolean;
  beneficiary: string;
  tokenId?: number;
  licenseId?: number;
  registerTxHash?: string;
  licenseTxHash?: string;
  yakoaRegistered?: boolean;
  yakoaError?: string;
  error?: string;
};

const onCronTrigger = (runtime: Runtime<Config>): WorkflowResult => {
  const evmConfig = runtime.config.evms[0];
  if (!evmConfig?.consumerAddress || evmConfig.consumerAddress.startsWith("REPLACE_")) {
    runtime.log("Skipping onchain write: set consumerAddress in config.staging.json");
    return {
      externalApiFetched: false,
      beneficiary: "",
      error: "consumerAddress not configured",
    };
  }

  const network = getNetwork({
    chainFamily: "evm",
    chainSelectorName: evmConfig.chainName,
    isTestnet: true,
  });
  if (!network) {
    throw new Error(`Unknown chain: ${evmConfig.chainName}`);
  }

  // Optional: external API integration (CRE requirement: blockchain + external data source)
  runtime.log(`Fetching external API: ${runtime.config.apiUrl}`);
  const apiStatus = runtime.runInNodeMode(
    (nodeRuntime: NodeRuntime<Config>) => {
      const http = new HTTPClient();
      const resp = http.sendRequest(nodeRuntime, {
        url: nodeRuntime.config.apiUrl,
        method: "GET",
      }).result();
      return resp.statusCode;
    },
    consensusMedianAggregation<number>()
  )().result();
  runtime.log(`External API response status: ${apiStatus}`);

  const demo = runtime.config.demoRegistration;
  if (!demo?.beneficiary || !demo?.ipHash) {
    return {
      externalApiFetched: true,
      beneficiary: "",
      error: "demoRegistration.beneficiary and ipHash required in config",
    };
  }

  const beneficiary = demo.beneficiary as `0x${string}`;
  const evmClient = new EVMClient(network.chainSelector.selector);

  // Step 1: Register IP asset (on-chain)
  // EVM read nextTokenId so we know the tokenId after registration (for license + Yakoa)
  let nextTokenIdBigInt: bigint | null = null;
  const modredIPAddress = evmConfig.modredIPAddress;
  if (modredIPAddress) {
    try {
      const callData = encodeFunctionData({
        abi: MODRED_IP_ABI,
        functionName: "nextTokenId",
        args: [],
      });
      const contractCall = evmClient
        .callContract(runtime, {
          call: encodeCallMsg({
            from: zeroAddress,
            to: modredIPAddress as Address,
            data: callData,
          }),
          blockNumber: LAST_FINALIZED_BLOCK_NUMBER,
        })
        .result();
      nextTokenIdBigInt = decodeFunctionResult({
        abi: MODRED_IP_ABI,
        functionName: "nextTokenId",
        data: bytesToHex(contractCall.data),
      }) as bigint;
      runtime.log(`Read nextTokenId: ${String(nextTokenIdBigInt)}`);
    } catch (e) {
      runtime.log(`EVM read nextTokenId skipped: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  const registerParams = encodeAbiParameters(
    parseAbiParameters("address beneficiary, string ipHash, string metadata, bool isEncrypted"),
    [beneficiary, demo.ipHash, demo.metadata, demo.isEncrypted]
  );
  const registerReportData = encodeAbiParameters(
    parseAbiParameters("uint8 instructionType, bytes params"),
    [INSTRUCTION_REGISTER_IP, registerParams]
  );
  const reportResponse1 = runtime
    .report({
      encodedPayload: hexToBase64(registerReportData as `0x${string}`),
      encoderName: "evm",
      signingAlgo: "ecdsa",
      hashingAlgo: "keccak256",
    })
    .result();
  const writeResult1 = evmClient
    .writeReport(runtime, {
      receiver: evmConfig.consumerAddress as `0x${string}`,
      report: reportResponse1,
      gasConfig: { gasLimit: evmConfig.gasLimit },
    })
    .result();
  const registerTxHash = writeResult1.txHash ? bytesToHex(writeResult1.txHash) : null;
  runtime.log(`Step 1 – Register IP tx: ${registerTxHash ?? "(no tx in simulation)"}`);

  const result: WorkflowResult = {
    externalApiFetched: true,
    beneficiary: demo.beneficiary,
  };
  if (registerTxHash != null) result.registerTxHash = registerTxHash;

  // Step 2: Mint license for the IP asset (on-chain)
  const license = runtime.config.demoLicense;
  const tokenIdForLicense = nextTokenIdBigInt != null ? Number(nextTokenIdBigInt) : null;
  if (license && tokenIdForLicense != null) {
    const licenseParams = encodeAbiParameters(
      parseAbiParameters("uint256 tokenId, address licensee, uint256 royaltyPercentage, uint256 duration, bool commercialUse, string terms"),
      [
        BigInt(tokenIdForLicense),
        beneficiary,
        BigInt(license.royaltyBps),
        BigInt(license.durationSec),
        license.commercialUse,
        license.terms,
      ]
    );
    const licenseReportData = encodeAbiParameters(
      parseAbiParameters("uint8 instructionType, bytes params"),
      [INSTRUCTION_MINT_LICENSE, licenseParams]
    );
    const reportResponse2 = runtime
      .report({
        encodedPayload: hexToBase64(licenseReportData as `0x${string}`),
        encoderName: "evm",
        signingAlgo: "ecdsa",
        hashingAlgo: "keccak256",
      })
      .result();
    const writeResult2 = evmClient
      .writeReport(runtime, {
        receiver: evmConfig.consumerAddress as `0x${string}`,
        report: reportResponse2,
        gasConfig: { gasLimit: evmConfig.gasLimit },
      })
      .result();
    const licenseTxHash = writeResult2.txHash ? bytesToHex(writeResult2.txHash) : null;
    runtime.log(`Step 2 – Mint license tx: ${licenseTxHash ?? "(no tx in simulation)"}`);
    result.tokenId = tokenIdForLicense;
    if (licenseTxHash != null) result.licenseTxHash = licenseTxHash;
  }

  // Step 3: Register IP for infringement (backend → Yakoa, same logic as register-ip-to-yakoa.ts)
  const apiUrl = runtime.config.apiUrl?.replace(/\/$/, "") ?? "";
  const tokenIdForYakoa = nextTokenIdBigInt != null ? Number(nextTokenIdBigInt) : null;
  const contractForYakoa = modredIPAddress ?? evmConfig.consumerAddress;
  if (
    apiUrl &&
    registerTxHash &&
    tokenIdForYakoa != null &&
    contractForYakoa &&
    !contractForYakoa.startsWith("REPLACE_")
  ) {
    const yakoaPayload = {
      contractAddress: contractForYakoa.toLowerCase(),
      tokenId: tokenIdForYakoa,
      txHash: registerTxHash,
      ipHash: demo.ipHash,
      metadata: demo.metadata,
      isEncrypted: demo.isEncrypted,
      creatorId: demo.beneficiary,
    };
    try {
      const yakoaStatus = runtime
        .runInNodeMode(
          (nodeRuntime: NodeRuntime<Config>) => {
            const http = new HTTPClient();
            const bodyBase64 =
              typeof Buffer !== "undefined"
                ? Buffer.from(JSON.stringify(yakoaPayload), "utf-8").toString("base64")
                : btoa(unescape(encodeURIComponent(JSON.stringify(yakoaPayload))));
            const resp = http.sendRequest(nodeRuntime, {
              url: `${nodeRuntime.config.apiUrl.replace(/\/$/, "")}/api/register-ip-yakoa`,
              method: "POST",
              body: bodyBase64,
              headers: { "Content-Type": "application/json" },
            }).result();
            return resp.statusCode;
          },
          consensusMedianAggregation<number>()
        )()
        .result();
      if (yakoaStatus >= 200 && yakoaStatus < 300) {
        runtime.log(`Step 3 – IP registered for infringement (Yakoa): HTTP ${yakoaStatus}`);
        result.yakoaRegistered = true;
      } else {
        runtime.log(`Step 3 – Yakoa registration returned HTTP ${yakoaStatus}`);
        result.yakoaError = `HTTP ${yakoaStatus}`;
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      runtime.log(`Step 3 – Yakoa registration failed: ${msg}`);
      result.yakoaError = msg;
    }
  } else {
    if (!apiUrl) runtime.log("Step 3 – Skipped: apiUrl not set");
    else if (!registerTxHash) runtime.log("Step 3 – Skipped: no register tx hash");
    else if (tokenIdForYakoa == null) runtime.log("Step 3 – Skipped: tokenId unknown");
    else runtime.log("Step 3 – Skipped: contract address not configured");
  }

  return result;
};

// CRE log trigger payload: matches SDK Log (address, topics, txHash; optional data, blockNumber, index).
// SDK may use BigInt for blockNumber; we accept unknown for compatibility.
type EVMLogPayload = {
  address: Uint8Array;
  topics: Uint8Array[];
  txHash: Uint8Array;
  data?: Uint8Array;
  blockNumber?: unknown;
  index?: number;
};

const onLogTrigger = (runtime: Runtime<Config>, log: EVMLogPayload): string => {
  const apiUrl = runtime.config.apiUrl?.replace(/\/$/, "") ?? "";
  if (!apiUrl) {
    runtime.log("Skipping event store: apiUrl not set");
    return "skip";
  }
  try {
    const addressHex = bytesToHex(log.address) as Address;
    const topicsHex = log.topics.map((t) => bytesToHex(t)) as [`0x${string}`, ...`0x${string}`[]];
    const dataHex = "data" in log && log.data ? bytesToHex((log as { data: Uint8Array }).data) : "0x";
    const decoded = decodeEventLog({
      abi: MODRED_IP_EVENTS_ABI,
      topics: topicsHex,
      data: dataHex as `0x${string}`,
    });
    const args =
      decoded.args && typeof decoded.args === "object" && !Array.isArray(decoded.args)
        ? Object.fromEntries(
            Object.entries(decoded.args).map(([k, v]) => [k, typeof v === "bigint" ? String(v) : v])
          )
        : {};
    const payload = {
      eventName: decoded.eventName,
      contractAddress: addressHex,
      blockNumber: log.blockNumber != null ? Number(log.blockNumber) : undefined,
      txHash: bytesToHex(log.txHash),
      logIndex: log.index,
      args,
    };
    const statusCode = runtime
      .runInNodeMode(
        (nodeRuntime: NodeRuntime<Config>) => {
          const http = new HTTPClient();
          const bodyBase64 =
            typeof Buffer !== "undefined"
              ? Buffer.from(JSON.stringify(payload), "utf-8").toString("base64")
              : btoa(unescape(encodeURIComponent(JSON.stringify(payload))));
          const resp = http.sendRequest(nodeRuntime, {
            url: `${nodeRuntime.config.apiUrl.replace(/\/$/, "")}/api/cre-events`,
            method: "POST",
            body: bodyBase64,
            headers: { "Content-Type": "application/json" },
          }).result();
          return resp.statusCode;
        },
        consensusMedianAggregation<number>()
      )()
      .result();
    runtime.log(`Event ${decoded.eventName} stored (HTTP ${statusCode})`);
    return "ok";
  } catch (e) {
    runtime.log(`Event decode/store failed: ${e instanceof Error ? e.message : String(e)}`);
    return "error";
  }
};

const initWorkflow = (config: Config) => {
  const cron = new CronCapability();
  const evmConfig = config.evms?.[0];
  const modredIP = evmConfig?.modredIPAddress;
  const consumer = evmConfig?.consumerAddress;
  const network =
    evmConfig?.chainName &&
    getNetwork({ chainFamily: "evm", chainSelectorName: evmConfig.chainName, isTestnet: true });
  const topic0Hashes = [
    eventTopic0("IPRegistered(uint256,address,string)"),
    eventTopic0("LicenseMinted(uint256,uint256,address)"),
    eventTopic0("RevenuePaid(uint256,uint256)"),
    eventTopic0("RoyaltyClaimed(uint256,address,uint256)"),
    eventTopic0("DisputeRaised(uint256,uint256,address)"),
    eventTopic0("DisputeResolved(uint256,uint256,bool)"),
    eventTopic0("IPTransferred(uint256,address,address)"),
    eventTopic0("IPRegisteredViaCRE(address,uint256,string)"),
    eventTopic0("LicenseMintedViaCRE(uint256,address,uint256)"),
  ];
  const addresses: string[] = [];
  if (modredIP && !modredIP.startsWith("REPLACE_")) addresses.push(hexToBase64(modredIP as `0x${string}`));
  if (consumer && !consumer.startsWith("REPLACE_")) addresses.push(hexToBase64(consumer as `0x${string}`));
  const handlers: any[] = [handler(cron.trigger({ schedule: config.schedule }), onCronTrigger)];
  if (network && addresses.length > 0) {
    const evmClient = new EVMClient(network.chainSelector.selector);
    const topic0Base64 = topic0Hashes.map((h) => hexToBase64(h));
    handlers.push(
      handler(
        evmClient.logTrigger({
          addresses,
          topics: [{ values: topic0Base64 }],
        }),
        onLogTrigger
      )
    );
  }
  return handlers;
};

export async function main() {
  const runner = await Runner.newRunner<Config>();
  await runner.run(initWorkflow);
}
