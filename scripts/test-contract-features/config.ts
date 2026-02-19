/**
 * Config for contract feature test scripts.
 * Reads deployed ModredIP address; uses TEST_PRIVATE_KEY for the main wallet.
 * Optional: DISPUTER_PRIVATE_KEY, ARBITRATOR_PRIVATE_KEY for dispute/arbitration flow.
 * All env vars can be set in a root .env file (loaded automatically).
 */

import "dotenv/config";
import { createPublicClient, createWalletClient, http } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import * as fs from "fs";
import * as path from "path";

const BASE_SEPOLIA = {
  id: 84532,
  name: "Base Sepolia",
  nativeCurrency: { name: "ETH", symbol: "ETH", decimals: 18 },
  rpcUrls: { default: { http: ["https://sepolia.base.org"] } },
} as const;

function loadDeployedAddresses(): { modredIP: string } {
  const p = path.join(__dirname, "..", "..", "app", "src", "deployed_addresses.json");
  const raw = fs.readFileSync(p, "utf-8");
  const j = JSON.parse(raw);
  const modredIP = j["ModredIPModule#ModredIP"];
  if (!modredIP) throw new Error("ModredIPModule#ModredIP not in deployed_addresses.json");
  return { modredIP };
}

function getAccount(key: string) {
  const hex = key.startsWith("0x") ? key : "0x" + key;
  return privateKeyToAccount(hex as `0x${string}`);
}

export function getConfig() {
  const { modredIP } = loadDeployedAddresses();
  const rpcUrl = process.env.RPC_URL || "https://sepolia.base.org";
  const testKey = process.env.TEST_PRIVATE_KEY;
  const disputerKey = process.env.DISPUTER_PRIVATE_KEY;
  const arbitratorKey = process.env.ARBITRATOR_PRIVATE_KEY;

  if (!testKey) throw new Error("Set TEST_PRIVATE_KEY (wallet with Base Sepolia ETH)");

  const transport = http(rpcUrl);
  const publicClient = createPublicClient({ chain: BASE_SEPOLIA, transport });
  const mainAccount = getAccount(testKey);
  const walletClient = createWalletClient({
    account: mainAccount,
    chain: BASE_SEPOLIA,
    transport,
  });

  const disputerAccount = disputerKey ? getAccount(disputerKey) : null;
  const disputerWalletClient =
    disputerAccount ?
      createWalletClient({
        account: disputerAccount,
        chain: BASE_SEPOLIA,
        transport,
      })
    : null;

  return {
    chain: BASE_SEPOLIA,
    modredIPAddress: modredIP as `0x${string}`,
    publicClient,
    mainAccount,
    walletClient,
    disputer: disputerAccount,
    disputerWalletClient,
    arbitrator: arbitratorKey ? getAccount(arbitratorKey) : null,
  };
}

const IPFS_GATEWAY = "https://gateway.pinata.cloud/ipfs";

/** Inputs for IP asset, license, and payRevenue (from env or defaults). See .env.example and TESTING.md. */
export function getTestInputs() {
  const ipHashRaw = process.env.TEST_IP_HASH?.trim();
  const ipHashForContract =
    ipHashRaw && ipHashRaw.length > 0
      ? ipHashRaw.startsWith("ipfs://")
        ? ipHashRaw
        : ipHashRaw.includes("/")
          ? ipHashRaw
          : `ipfs://${ipHashRaw}` // plain CID -> ipfs://CID like frontend
      : "ipfs://QmTestScriptHash" + Date.now();

  // Extract CID for gateway URL (so tokenURI metadata has "image" for Basescan/explorers)
  const cidForGateway = ipHashForContract.replace(/^ipfs:\/\//, "").split("/")[0];
  const imageUrl = `${IPFS_GATEWAY}/${cidForGateway}`;

  const metadataRaw = process.env.TEST_IP_METADATA?.trim();
  let metadata: string;
  if (metadataRaw && metadataRaw.length > 0) {
    metadata = metadataRaw;
    // If user metadata is JSON and has no "image", inject image so Basescan can show it
    if (metadata.startsWith("{")) {
      try {
        const obj = JSON.parse(metadata) as Record<string, unknown>;
        if (obj.image === undefined || obj.image === null) {
          obj.image = imageUrl;
          metadata = JSON.stringify(obj);
        }
      } catch {
        // leave metadata as-is
      }
    }
  } else {
    metadata = JSON.stringify({
      name: "Test IP",
      description: "Created via contract test script",
      image: imageUrl,
    });
  }
  const isEncrypted = process.env.TEST_IP_ENCRYPTED === "true" || process.env.TEST_IP_ENCRYPTED === "1";

  const royaltyBps = Math.min(10000, Math.max(0, parseInt(process.env.TEST_LICENSE_ROYALTY_BPS ?? "1000", 10) || 1000));
  const durationSec = parseInt(process.env.TEST_LICENSE_DURATION_SECONDS ?? "2592000", 10) || 2592000; // 30 days
  const commercialUse = process.env.TEST_LICENSE_COMMERCIAL !== "false" && process.env.TEST_LICENSE_COMMERCIAL !== "0";
  const terms = process.env.TEST_LICENSE_TERMS?.trim() || "test terms";

  const payRevenueEth = process.env.TEST_PAY_REVENUE_ETH?.trim() || "0.001";

  return {
    ipHash: ipHashForContract,
    metadata,
    isEncrypted,
    royaltyBps: BigInt(royaltyBps),
    durationSec: BigInt(durationSec),
    commercialUse,
    terms,
    payRevenueEth,
  };
}
