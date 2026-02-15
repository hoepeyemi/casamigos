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

  return {
    chain: BASE_SEPOLIA,
    modredIPAddress: modredIP as `0x${string}`,
    publicClient,
    mainAccount,
    walletClient,
    disputer: disputerKey ? getAccount(disputerKey) : null,
    arbitrator: arbitratorKey ? getAccount(arbitratorKey) : null,
  };
}
