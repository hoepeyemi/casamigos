/**
 * Fetches all IP asset token IDs from the ModredIP contract and runs Yakoa
 * infringement check for each. Same flow as frontend (contract + Yakoa API).
 */

import { type Chain, createPublicClient, http } from 'viem';
import * as path from 'path';
import * as fs from 'fs';
import { getYakoaInfringementStatus } from './yakoascanner';

const baseSepolia: Chain = {
  id: 84532,
  name: 'Base Sepolia',
  nativeCurrency: { name: 'ETH', symbol: 'ETH', decimals: 18 },
  rpcUrls: { default: { http: ['https://sepolia.base.org'] } },
};

const MODRED_IP_ABI = [
  { inputs: [], name: 'nextTokenId', outputs: [{ name: '', type: 'uint256' }], stateMutability: 'view', type: 'function' },
] as const;

export type InfringementResult = {
  tokenId: number;
  id: string;
  status: string;
  result: string;
  totalInfringements: number;
  inNetworkInfringements: unknown[];
  externalInfringements: unknown[];
  credits: Record<string, unknown>;
  lastChecked: string | null;
};

export type AllInfringementResult = {
  contractAddress: string;
  totalAssets: number;
  results: { tokenId: number; infringement: InfringementResult | null; error?: string }[];
};

/**
 * Resolve ModredIP contract address: env MODRED_IP_CONTRACT_ADDRESS or app deployed_addresses.json.
 */
export function getModredIPContractAddress(): string {
  const fromEnv = process.env.MODRED_IP_CONTRACT_ADDRESS?.trim();
  if (fromEnv) return fromEnv;

  const appPath = path.join(__dirname, '..', '..', '..', 'app', 'src', 'deployed_addresses.json');
  if (fs.existsSync(appPath)) {
    const raw = fs.readFileSync(appPath, 'utf-8');
    const j = JSON.parse(raw);
    const addr = j['ModredIPModule#ModredIP'];
    if (addr) return addr;
  }

  throw new Error(
    'ModredIP contract address not set. Set MODRED_IP_CONTRACT_ADDRESS in backend/.env or ensure app/src/deployed_addresses.json has ModredIPModule#ModredIP.'
  );
}

/**
 * Create a read-only public client (no wallet required).
 */
function createReadOnlyClient() {
  const rpcUrl = process.env.RPC_PROVIDER_URL || process.env.RPC_URL || 'https://sepolia.base.org';
  return createPublicClient({
    chain: baseSepolia,
    transport: http(rpcUrl, { timeout: 15_000 }),
  });
}

/**
 * Fetch all token IDs (1 to nextTokenId - 1) from the contract.
 */
export async function getTokenIdsFromContract(contractAddress: string): Promise<number[]> {
  const client = createReadOnlyClient();
  const nextId = await client.readContract({
    address: contractAddress as `0x${string}`,
    abi: MODRED_IP_ABI,
    functionName: 'nextTokenId',
  });
  const n = Number(nextId);
  const tokenIds: number[] = [];
  for (let i = 1; i < n; i++) tokenIds.push(i);
  return tokenIds;
}

/**
 * Run Yakoa infringement check for all IP assets of the given contract.
 * Uses id format contractAddress:tokenId (same as frontend and handleInfringementStatusByContract).
 */
export async function getInfringementStatusForAllIpAssets(
  contractAddress: string
): Promise<AllInfringementResult> {
  const normalizedContract = contractAddress.toLowerCase().trim();
  const tokenIds = await getTokenIdsFromContract(normalizedContract);

  const results: AllInfringementResult['results'] = [];

  for (const tokenId of tokenIds) {
    const id = `${normalizedContract}:${tokenId}`;
    try {
      const infringement = await getYakoaInfringementStatus(id);
      results.push({
        tokenId,
        infringement: infringement as InfringementResult,
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      results.push({
        tokenId,
        infringement: null,
        error: message,
      });
    }
  }

  return {
    contractAddress: normalizedContract,
    totalAssets: tokenIds.length,
    results,
  };
}
