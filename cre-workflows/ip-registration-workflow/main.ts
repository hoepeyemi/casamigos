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
  type Config as CREConfig,
  type NodeRuntime,
  type Runtime,
} from "@chainlink/cre-sdk";
import { encodeAbiParameters, parseAbiParameters } from "viem";

const INSTRUCTION_REGISTER_IP = 0;

type EvmConfig = {
  chainName: string;
  consumerAddress: string;
  gasLimit: string;
};

type DemoRegistration = {
  beneficiary: string;
  ipHash: string;
  metadata: string;
  isEncrypted: boolean;
};

type Config = {
  schedule: string;
  apiUrl: string;
  evms: EvmConfig[];
  demoRegistration?: DemoRegistration;
};

type WorkflowResult = {
  externalApiFetched: boolean;
  beneficiary: string;
  tokenId?: number;
  txHash?: string;
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

  // 1) External API integration (required: blockchain + external API/data source)
  runtime.log(`Fetching external API: ${runtime.config.apiUrl}`);
  const apiResult = runtime.runInNodeMode(
    (nodeRuntime: NodeRuntime) => {
      const http = new HTTPClient();
      const resp = http.sendRequest(nodeRuntime, {
        url: nodeRuntime.config.apiUrl,
        method: "GET",
      }).result();
      const body = new TextDecoder().decode(resp.body);
      return { status: resp.statusCode, body: body.slice(0, 200) };
    },
    consensusMedianAggregation()
  )().result();
  runtime.log(`External API response status: ${apiResult.status}`);

  // 2) Build registration payload (from config demo or could be derived from API body)
  const demo = runtime.config.demoRegistration;
  if (!demo?.beneficiary || !demo?.ipHash) {
    return {
      externalApiFetched: true,
      beneficiary: "",
      error: "demoRegistration.beneficiary and ipHash required in config",
    };
  }

  const beneficiary = demo.beneficiary as `0x${string}`;
  const params = encodeAbiParameters(
    parseAbiParameters("address beneficiary, string ipHash, string metadata, bool isEncrypted"),
    [beneficiary, demo.ipHash, demo.metadata, demo.isEncrypted]
  );
  const reportData = encodeAbiParameters(
    parseAbiParameters("uint8 instructionType, bytes params"),
    [INSTRUCTION_REGISTER_IP, params]
  );

  // 3) Signed report and onchain write
  const reportResponse = runtime
    .report({
      encodedPayload: hexToBase64(reportData as `0x${string}`),
      encoderName: "evm",
      signingAlgo: "ecdsa",
      hashingAlgo: "keccak256",
    })
    .result();

  const evmClient = new EVMClient(network.chainSelector.selector);
  const writeResult = evmClient
    .writeReport(runtime, {
      receiver: evmConfig.consumerAddress as `0x${string}`,
      report: reportResponse,
      gasConfig: { gasLimit: evmConfig.gasLimit },
    })
    .result();

  const txHash = writeResult.txHash ? bytesToHex(writeResult.txHash) : undefined;
  runtime.log(`Write report tx: ${txHash}`);

  return {
    externalApiFetched: true,
    beneficiary: demo.beneficiary,
    txHash,
  };
};

const initWorkflow = (config: Config) => {
  const cron = new CronCapability();
  return [handler(cron.trigger({ schedule: config.schedule }), onCronTrigger)];
};

export async function main() {
  const runner = await Runner.newRunner<Config>();
  await runner.run(initWorkflow);
}
