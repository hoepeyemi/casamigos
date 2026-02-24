/**
 * POST /api/register-ip-yakoa — Register an on-chain IP asset with Yakoa (infringement monitoring).
 * Used by the CRE workflow after register IP + mint license.
 *
 * Body: {
 *   contractAddress: string;   // ModredIP contract address (lowercase)
 *   tokenId: number;
 *   txHash: string;             // Register-IP tx hash (0x...)
 *   blockNumber?: string;       // Optional; if missing, fetched from chain via txHash
 *   ipHash: string;
 *   metadata: string | object;  // JSON string or object
 *   isEncrypted?: boolean;
 *   creatorId?: string;         // Default 0x0
 * }
 */

import express from "express";
import { registerToYakoa } from "../services/yakoascanner";
import { publicClient } from "../utils/config";

const router = express.Router();

function extractHash(ipfsHash: string): string {
  if (ipfsHash.startsWith("ipfs://")) return ipfsHash.replace("ipfs://", "");
  return ipfsHash;
}

router.post("/", async (req, res) => {
  try {
    const {
      contractAddress: rawContract,
      tokenId: tokenIdRaw,
      txHash,
      blockNumber: blockNumberRaw,
      ipHash,
      metadata: metadataInput,
      isEncrypted = false,
      creatorId = "0x0000000000000000000000000000000000000000",
    } = req.body;

    const contractAddress = (rawContract ?? "").toLowerCase().trim();
    const tokenId = Number(tokenIdRaw);
    const ipHashTrim = (ipHash ?? "").trim();

    if (!contractAddress || Number.isNaN(tokenId) || !txHash?.trim() || !ipHashTrim) {
      return res.status(400).json({
        error: "Missing or invalid: contractAddress, tokenId, txHash, ipHash",
      });
    }

    let blockNumber: bigint;
    if (blockNumberRaw != null && blockNumberRaw !== "") {
      blockNumber = BigInt(String(blockNumberRaw).trim());
    } else {
      const receipt = await publicClient.getTransactionReceipt({
        hash: txHash.trim() as `0x${string}`,
      });
      if (!receipt?.blockNumber) {
        return res.status(400).json({
          error: "blockNumber required or txHash must exist on chain",
        });
      }
      blockNumber = receipt.blockNumber;
    }

    const creatorIdNorm = (creatorId ?? "0x0000000000000000000000000000000000000000")
      .toLowerCase()
      .trim();
    const Id = `${contractAddress}:${tokenId}`;

    let parsedMetadata: Record<string, unknown> = {};
    if (metadataInput != null) {
      if (typeof metadataInput === "string") {
        try {
          parsedMetadata = JSON.parse(metadataInput) as Record<string, unknown>;
        } catch {
          parsedMetadata = { name: metadataInput };
        }
      } else if (typeof metadataInput === "object") {
        parsedMetadata = metadataInput as Record<string, unknown>;
      }
    }

    const title =
      (parsedMetadata.name as string) ||
      (parsedMetadata.title as string) ||
      "CRE Registered IP";
    const description = (parsedMetadata.description as string) || "";
    const hashOnly = extractHash(ipHashTrim);

    const yakoaMetadata: Record<string, string | number | boolean> = {
      title,
      description,
      creator: creatorIdNorm,
      created_at:
        (parsedMetadata.created_at as string) || new Date().toISOString(),
      ip_hash: hashOnly,
      is_encrypted: Boolean(isEncrypted),
      contract_address: contractAddress,
      token_id: String(tokenId),
      content_type: (parsedMetadata.content_type as string) || "unknown",
      file_size: Number(parsedMetadata.file_size) || 0,
      mime_type: (parsedMetadata.mime_type as string) || "unknown",
      category: (parsedMetadata.category as string) || "general",
      license_type:
        (parsedMetadata.license_type as string) || "all_rights_reserved",
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
          creator: creatorIdNorm,
          created_at:
            (parsedMetadata.created_at as string) || new Date().toISOString(),
        },
      },
    ];

    const authorizations = [
      {
        brand_id: null as string | null,
        brand_name: null as string | null,
        data: {
          type: "email" as const,
          email_address:
            (parsedMetadata.creator_email as string) || "creator@sear.com",
        },
      },
    ];

    const result = await registerToYakoa({
      Id,
      transactionHash: txHash.trim() as `0x${string}`,
      blockNumber,
      creatorId: creatorIdNorm,
      metadata: yakoaMetadata as { [key: string]: string },
      media: yakoaMedia as { media_id: string; url: string }[],
      brandId: null,
      brandName: null,
      emailAddress: (parsedMetadata.creator_email as string) || null,
      licenseParents: [],
      authorizations,
    });

    return res.json({
      ok: true,
      id: Id,
      message: (result as { message?: string })?.message ?? "Registered with Yakoa",
    });
  } catch (err) {
    console.error("[register-ip-yakoa]", err);
    return res.status(500).json({
      error: err instanceof Error ? err.message : "Failed to register IP with Yakoa",
    });
  }
});

export default router;
