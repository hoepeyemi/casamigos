/**
 * CRE Workflow: IP Registration (orchestration layer)
 *
 * Demonstrates:
 * - Blockchain (Base Sepolia) + External API integration (required by program)
 * - Cron trigger → fetch from external API → encode report → write to ModredIPCREConsumer
 *
 * Flow: Trigger → HTTP GET to external API (e.g. GitHub) → build report from config/API →
 *       runtime.report() → evmClient.writeReport() to consumer contract.
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
  type Runtime, sendErrorResponse,
} from "@chainlink/cre-sdk";
import { encodeAbiParameters, parseAbiParameters, encodeFunctionData, decodeFunctionResult, parseAbi, type Address, zeroAddress } from "viem";

const INSTRUCTION_REGISTER_IP = 0;
const INSTRUCTION_MINT_LICENSE = 1;

const MODRED_IP_ABI = parseAbi(["function nextTokenId() view returns (uint256)"]);

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
  error?: string;
};

const onCronTrigger = async (runtime: Runtime<Config>): Promise<WorkflowResult> => {
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

  // 1) External API integration (required: blockchain + external API/data source)
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

  // 2) EVM read nextTokenId from ModredIP (so we know tokenId for mint license after register)
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

  // 3) Report 1: Register IP
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
  runtime.log(`Register IP tx: ${registerTxHash ?? "(no tx in simulation)"}`);

  const result: WorkflowResult = {
    externalApiFetched: true,
    beneficiary: demo.beneficiary,
  };
  if (registerTxHash != null) result.registerTxHash = registerTxHash;

  // Wait for first tx to be mined so second WriteReport uses correct nonce (avoid "nonce too low")
  if (registerTxHash != null) {
    const delayMs = 15_000;
    runtime.log(`Waiting ${delayMs / 1000}s for first tx to be mined before mint license...`);
    await new Promise((resolve) => setTimeout(resolve, delayMs));
  }

  // 4) Report 2: Mint license for the new token (tokenId = nextTokenId we read)
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
    runtime.log(`Mint license tx: ${licenseTxHash ?? "(no tx in simulation)"}`);
    result.tokenId = tokenIdForLicense;
    if (licenseTxHash != null) result.licenseTxHash = licenseTxHash;
  }

  return result;
};

const initWorkflow = (config: Config) => {
  const cron = new CronCapability();
  return [handler(cron.trigger({ schedule: config.schedule }), onCronTrigger)];
};

export async function main() {
  const runner = await Runner.newRunner<Config>();
  await runner.run(initWorkflow);
}

main().catch(sendErrorResponse)
