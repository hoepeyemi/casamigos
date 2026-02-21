// src/routes/yakoaRoutes.ts
import express from 'express';
import axios from 'axios';
import { createPublicClient, http } from 'viem';
import { baseSepolia } from 'viem/chains';
import { registerToYakoa } from '../services/yakoascanner';

const router = express.Router();

const YAKOA_API_KEY = process.env.YAKOA_API_KEY!;

const BASE_URL = 'https://docs-demo.ip-api-sandbox.yakoa.io/docs-demo/token';

function extractHash(ipfsHash: string): string {
  if (ipfsHash.startsWith('ipfs://')) return ipfsHash.replace('ipfs://', '');
  return ipfsHash;
}

/**
 * Extract base ID without timestamp for Yakoa API calls
 * @param id - The full ID (may include timestamp)
 * @returns Base ID in format contract:tokenId
 */
function getBaseIdForYakoa(id: string): string {
  const parts = id.split(':');
  if (parts.length >= 2) {
    // Return contract:tokenId format (first two parts)
    return `${parts[0]}:${parts[1]}`;
  }
  return id; // Return as-is if no colon found
}

// GET /api/yakoa - health/ping for CRE workflow external API (no id required)
router.get('/', (_req, res) => {
  res.json({ ok: true, service: 'yakoa-backend', message: 'Yakoa + Base Sepolia backend' });
});

// POST /api/yakoa/register - register an on-chain IP asset with Yakoa (for CRE workflow or other callers)
router.post('/register', async (req, res) => {
  try {
    const { contractAddress, tokenId, txHash, blockNumber: blockNumberParam, creatorId, ipHash, metadata, isEncrypted } = req.body as {
      contractAddress?: string;
      tokenId?: number;
      txHash?: string;
      blockNumber?: string | number;
      creatorId?: string;
      ipHash?: string;
      metadata?: string;
      isEncrypted?: boolean;
    };
    if (!contractAddress || tokenId == null || !txHash || !creatorId || !ipHash) {
      return res.status(400).json({
        error: 'Missing required fields: contractAddress, tokenId, txHash, creatorId, ipHash',
      });
    }
    const contract = contractAddress.toLowerCase().trim();
    const creator = creatorId.toLowerCase().trim();
    const metadataStr = typeof metadata === 'string' ? metadata : JSON.stringify(metadata ?? {});
    const isEnc = isEncrypted === true || isEncrypted === 'true' || isEncrypted === '1';

    let blockNumber: bigint;
    if (blockNumberParam != null && blockNumberParam !== '') {
      blockNumber = BigInt(blockNumberParam);
    } else {
      const rpcUrl = process.env.RPC_PROVIDER_URL || process.env.RPC_URL || 'https://sepolia.base.org';
      const publicClient = createPublicClient({
        chain: baseSepolia,
        transport: http(rpcUrl, { timeout: 15_000 }),
      });
      const receipt = await publicClient.getTransactionReceipt({ hash: txHash as `0x${string}` });
      if (!receipt) {
        return res.status(400).json({ error: 'Transaction not found; provide blockNumber or ensure txHash is mined' });
      }
      blockNumber = receipt.blockNumber;
    }

    let parsedMetadata: Record<string, unknown> = {};
    try {
      parsedMetadata = JSON.parse(metadataStr) as Record<string, unknown>;
    } catch {
      // use empty
    }
    const title = (parsedMetadata.name as string) || (parsedMetadata.title as string) || 'IP Asset';
    const description = (parsedMetadata.description as string) || '';
    const hashOnly = extractHash(ipHash);

    const yakoaMetadata: Record<string, string | number | boolean> = {
      title,
      description,
      creator: creator,
      created_at: (parsedMetadata.created_at as string) || new Date().toISOString(),
      ip_hash: hashOnly,
      is_encrypted: isEnc,
      contract_address: contract,
      token_id: String(tokenId),
      content_type: (parsedMetadata.content_type as string) || 'unknown',
      file_size: Number(parsedMetadata.file_size) || 0,
      mime_type: (parsedMetadata.mime_type as string) || 'unknown',
      category: (parsedMetadata.category as string) || 'general',
      license_type: (parsedMetadata.license_type as string) || 'all_rights_reserved',
      commercial_use: Boolean(parsedMetadata.commercial_use),
      derivatives_allowed: Boolean(parsedMetadata.derivatives_allowed),
    };

    const yakoaMedia = [
      {
        media_id: title,
        url: `https://ipfs.io/ipfs/${hashOnly}`,
        type: (parsedMetadata.mime_type as string) || 'unknown',
        size: Number(parsedMetadata.file_size) || 0,
        metadata: { name: title, description, creator, created_at: (parsedMetadata.created_at as string) || new Date().toISOString() },
      },
    ];

    const authorizations = [
      { brand_id: null as string | null, brand_name: null as string | null, data: { type: 'email' as const, email_address: (parsedMetadata.creator_email as string) || 'creator@sear.com' } },
    ];

    const Id = `${contract}:${tokenId}`;
    const result = await registerToYakoa({
      Id,
      transactionHash: txHash as `0x${string}`,
      blockNumber,
      creatorId: creator,
      metadata: yakoaMetadata as { [key: string]: string },
      media: yakoaMedia as { media_id: string; url: string }[],
      brandId: null,
      brandName: null,
      emailAddress: (parsedMetadata.creator_email as string) || null,
      licenseParents: [],
      authorizations,
    });
    return res.json({ ok: true, message: result?.message ?? 'Registered with Yakoa', ...result });
  } catch (err: any) {
    console.error('❌ Yakoa register error:', err?.response?.data || err?.message || err);
    return res.status(500).json({ error: err?.message || 'Failed to register with Yakoa' });
  }
});

// GET /api/yakoa/status/:id
router.get('/status/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const baseId = getBaseIdForYakoa(id);
    
    const yakoaApiUrl = `https://docs-demo.ip-api-sandbox.yakoa.io/docs-demo/token/${encodeURIComponent(baseId)}`;

    console.log("Fetching Yakoa status from:", yakoaApiUrl);
    console.log("🔍 Using base ID for API call:", baseId);

    const response = await axios.get(yakoaApiUrl, {
      headers: {
        'X-API-KEY': process.env.YAKOA_API_KEY || 'your-api-key',
      },
    });
    console.log("Yakoa response:", response.data);

    res.json(response.data);
  } catch (error: any) {
    console.error('❌ Error fetching Yakoa status:', error.response?.data || error.message);
    res.status(500).json({ error: 'Failed to fetch infringement status' });
  }
});


export default router;
