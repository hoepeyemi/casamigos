/**
 * Register a single on-chain IP asset with Yakoa (for infringement monitoring).
 * Used by the contract-features test after registerIP so the infringement check can find the token.
 *
 * Env (set by caller, e.g. test script):
 *   MODRED_IP_CONTRACT_ADDRESS or CONTRACT_ADDRESS
 *   TOKEN_ID
 *   TX_HASH
 *   BLOCK_NUMBER
 *   CREATOR_ID (optional; default 0x0)
 *   IP_HASH
 *   METADATA (JSON string)
 *   IS_ENCRYPTED (optional; default false)
 *
 * Run from repo root: (cd backend && npx ts-node src/scripts/register-ip-to-yakoa.ts)
 * Or from backend: npx ts-node src/scripts/register-ip-to-yakoa.ts
 */

import dotenv from "dotenv";
import path from "path";

dotenv.config({ path: path.join(__dirname, "..", "..", ".env") });

import { registerToYakoa } from "../services/yakoascanner";

function extractHash(ipfsHash: string): string {
  if (ipfsHash.startsWith("ipfs://")) return ipfsHash.replace("ipfs://", "");
  return ipfsHash;
}

async function main() {
  const contractAddress = (
    process.env.MODRED_IP_CONTRACT_ADDRESS ||
    process.env.CONTRACT_ADDRESS ||
    ""
  ).toLowerCase().trim();
  const tokenIdRaw = process.env.TOKEN_ID?.trim();
  const txHash = process.env.TX_HASH?.trim();
  const blockNumberRaw = process.env.BLOCK_NUMBER?.trim();
  const creatorId = (process.env.CREATOR_ID || "0x0000000000000000000000000000000000000000")
    .toLowerCase()
    .trim();
  const ipHash = process.env.IP_HASH?.trim();
  const metadataStr = process.env.METADATA?.trim() || "{}";
  const isEncrypted = process.env.IS_ENCRYPTED === "true" || process.env.IS_ENCRYPTED === "1";

  if (!contractAddress || !tokenIdRaw || !txHash || !blockNumberRaw || !ipHash) {
    console.error(
      "Missing required env: MODRED_IP_CONTRACT_ADDRESS, TOKEN_ID, TX_HASH, BLOCK_NUMBER, IP_HASH"
    );
    process.exit(1);
  }

  const tokenId = Number(tokenIdRaw);
  const blockNumber = BigInt(blockNumberRaw);
  const Id = `${contractAddress}:${tokenId}`;

  let parsedMetadata: Record<string, unknown> = {};
  try {
    parsedMetadata = JSON.parse(metadataStr) as Record<string, unknown>;
  } catch {
    // use empty
  }

  const title = (parsedMetadata.name as string) || (parsedMetadata.title as string) || "Test IP";
  const description = (parsedMetadata.description as string) || "";
  const hashOnly = extractHash(ipHash);

  const yakoaMetadata: Record<string, string | number | boolean> = {
    title,
    description,
    creator: creatorId,
    created_at: (parsedMetadata.created_at as string) || new Date().toISOString(),
    ip_hash: hashOnly,
    is_encrypted: isEncrypted,
    contract_address: contractAddress,
    token_id: String(tokenId),
    content_type: (parsedMetadata.content_type as string) || "unknown",
    file_size: Number(parsedMetadata.file_size) || 0,
    mime_type: (parsedMetadata.mime_type as string) || "unknown",
    category: (parsedMetadata.category as string) || "general",
    license_type: (parsedMetadata.license_type as string) || "all_rights_reserved",
    commercial_use: Boolean(parsedMetadata.commercial_use),
    derivatives_allowed: Boolean(parsedMetadata.derivatives_allowed),
  };

  const yakoaMedia = [
    {
      media_id: title,
      url: `https://ipfs.io/ipfs/${hashOnly}`,
      type: (parsedMetadata.mime_type as string) || "unknown",
      size: Number(parsedMetadata.file_size) || 0,
      metadata: {
        name: title,
        description,
        creator: creatorId,
        created_at: (parsedMetadata.created_at as string) || new Date().toISOString(),
      },
    },
  ];

  const authorizations = [
    {
      brand_id: null as string | null,
      brand_name: null as string | null,
      data: {
        type: "email" as const,
        email_address: (parsedMetadata.creator_email as string) || "creator@sear.com",
      },
    },
  ];

  console.log("Registering IP with Yakoa:", Id);
  const result = await registerToYakoa({
    Id,
    transactionHash: txHash as `0x${string}`,
    blockNumber,
    creatorId,
    metadata: yakoaMetadata as { [key: string]: string },
    media: yakoaMedia as { media_id: string; url: string }[],
    brandId: null,
    brandName: null,
    emailAddress: (parsedMetadata.creator_email as string) || null,
    licenseParents: [],
    authorizations,
  });
  console.log("Yakoa result:", result?.message ?? result);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
