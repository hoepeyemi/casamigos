"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.mintLicenseOnMantle = exports.registerIpWithMantle = exports.checkExistingLicenses = void 0;
const config_1 = require("../utils/config");
// ModredIP contract ABI (simplified for IP registration)
const MODRED_IP_ABI = [
    {
        "inputs": [
            {
                "internalType": "string",
                "name": "ipHash",
                "type": "string"
            },
            {
                "internalType": "string",
                "name": "metadata",
                "type": "string"
            },
            {
                "internalType": "bool",
                "name": "isEncrypted",
                "type": "bool"
            }
        ],
        "name": "registerIP",
        "outputs": [
            {
                "internalType": "uint256",
                "name": "",
                "type": "uint256"
            }
        ],
        "stateMutability": "nonpayable",
        "type": "function"
    },
    {
        "inputs": [
            {
                "internalType": "uint256",
                "name": "tokenId",
                "type": "uint256"
            },
            {
                "internalType": "uint256",
                "name": "royaltyPercentage",
                "type": "uint256"
            },
            {
                "internalType": "uint256",
                "name": "duration",
                "type": "uint256"
            },
            {
                "internalType": "bool",
                "name": "commercialUse",
                "type": "bool"
            },
            {
                "internalType": "string",
                "name": "terms",
                "type": "string"
            }
        ],
        "name": "mintLicense",
        "outputs": [
            {
                "internalType": "uint256",
                "name": "",
                "type": "uint256"
            }
        ],
        "stateMutability": "nonpayable",
        "type": "function"
    },
    {
        "inputs": [
            {
                "internalType": "uint256",
                "name": "",
                "type": "uint256"
            },
            {
                "internalType": "uint256",
                "name": "",
                "type": "uint256"
            }
        ],
        "name": "tokenLicenses",
        "outputs": [
            {
                "internalType": "uint256",
                "name": "",
                "type": "uint256"
            }
        ],
        "stateMutability": "view",
        "type": "function"
    }
];
// Helper function to check if a tokenId already has licenses
const checkExistingLicenses = async (tokenId, modredIpContractAddress) => {
    try {
        // For public mappings to arrays, Solidity generates a getter that takes (key, index)
        // Try to read index 0 - if it succeeds, there's at least one license
        try {
            const licenseId = await config_1.publicClient.readContract({
                address: modredIpContractAddress,
                abi: MODRED_IP_ABI,
                functionName: 'tokenLicenses',
                args: [BigInt(tokenId), BigInt(0)],
            });
            // If we successfully read index 0, there's at least one license
            console.log(`✅ Found existing license for tokenId ${tokenId}: licenseId ${licenseId}`);
            return true;
        }
        catch (indexError) {
            // If reading index 0 fails, it means the array is empty or doesn't exist
            const errorMsg = indexError?.message || String(indexError || '');
            if (errorMsg.includes('execution reverted') || errorMsg.includes('out of bounds')) {
                // Array is empty - no licenses exist
                console.log(`ℹ️ No existing licenses found for tokenId ${tokenId}`);
                return false;
            }
            // Some other error - rethrow
            throw indexError;
        }
    }
    catch (error) {
        // If the function doesn't exist or there's an error, log it but don't fail
        // This allows the system to work even if the contract doesn't have this function
        console.warn('⚠️ Could not check existing licenses:', error);
        return false; // Default to allowing minting if we can't check
    }
};
exports.checkExistingLicenses = checkExistingLicenses;
const registerIpWithMantle = async (ipHash, metadata, isEncrypted, modredIpContractAddress) => {
    const maxRetries = 3;
    let lastError = null;
    for (let attempt = 0; attempt < maxRetries; attempt++) {
        try {
            console.log('ipHash:', ipHash);
            console.log('metadata:', metadata);
            console.log('isEncrypted:', isEncrypted);
            // Register IP on ModredIP contract
            const { request } = await config_1.publicClient.simulateContract({
                address: modredIpContractAddress,
                abi: MODRED_IP_ABI,
                functionName: 'registerIP',
                args: [
                    ipHash,
                    metadata,
                    isEncrypted
                ],
                account: config_1.account.address,
            });
            // Fetch nonce right before sending to avoid race conditions
            const nonce = await config_1.publicClient.getTransactionCount({
                address: config_1.account.address,
                blockTag: 'pending', // Include pending transactions
            });
            console.log(`📊 Using nonce: ${nonce} (attempt ${attempt + 1}/${maxRetries})`);
            const hash = await config_1.walletClient.writeContract({
                ...request,
                account: config_1.account,
                nonce: nonce, // Explicitly set nonce to avoid conflicts
            });
            const receipt = await config_1.publicClient.waitForTransactionReceipt({ hash });
            // Extract IP Asset ID from transaction logs
            let ipAssetId;
            if (receipt.logs && receipt.logs.length > 0) {
                // Look for the Transfer event which contains the token ID
                for (const log of receipt.logs) {
                    if (log.topics[0] === '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef') {
                        // Transfer event signature
                        if (log.topics[3]) {
                            ipAssetId = parseInt(log.topics[3], 16);
                            break;
                        }
                    }
                }
            }
            return {
                txHash: hash,
                ipAssetId: ipAssetId,
                blockNumber: receipt.blockNumber,
                explorerUrl: `${config_1.BLOCK_EXPLORER_URL}/tx/${hash}`,
            };
        }
        catch (error) {
            lastError = error;
            console.error(`❌ Error registering IP with Mantle (attempt ${attempt + 1}/${maxRetries}):`, error?.message || error);
            // Check if it's a nonce-related error (check nested cause chain)
            const checkNonceError = (err, depth = 0) => {
                if (!err || depth > 5)
                    return false; // Prevent infinite recursion
                const message = (err?.message || err?.shortMessage || err?.details || '').toLowerCase();
                const name = (err?.name || '').toLowerCase();
                const isNonce = message.includes('nonce') ||
                    message.includes('already known') ||
                    name.includes('nonce') ||
                    name.includes('noncetoolow');
                if (isNonce)
                    return true;
                // Recursively check cause chain
                return checkNonceError(err?.cause, depth + 1);
            };
            const isNonceError = checkNonceError(error);
            if (isNonceError && attempt < maxRetries - 1) {
                // Wait a bit before retrying to allow nonce to update
                const delay = (attempt + 1) * 1000; // 1s, 2s, 3s
                console.log(`⏳ Nonce error detected. Waiting ${delay}ms before retry...`);
                await new Promise(resolve => setTimeout(resolve, delay));
                continue; // Retry with fresh nonce
            }
            // If not a nonce error or last attempt, throw
            throw error;
        }
    }
    // If we exhausted all retries, throw the last error
    throw lastError;
};
exports.registerIpWithMantle = registerIpWithMantle;
const mintLicenseOnMantle = async (tokenId, royaltyPercentage, duration, commercialUse, terms, modredIpContractAddress) => {
    const maxRetries = 3;
    let lastError = null;
    for (let attempt = 0; attempt < maxRetries; attempt++) {
        try {
            const { request } = await config_1.publicClient.simulateContract({
                address: modredIpContractAddress,
                abi: MODRED_IP_ABI,
                functionName: 'mintLicense',
                args: [
                    BigInt(tokenId),
                    BigInt(royaltyPercentage),
                    BigInt(duration),
                    commercialUse,
                    terms
                ],
                account: config_1.account.address,
            });
            // Fetch nonce right before sending to avoid race conditions
            const nonce = await config_1.publicClient.getTransactionCount({
                address: config_1.account.address,
                blockTag: 'pending', // Include pending transactions
            });
            console.log(`📊 Using nonce: ${nonce} (attempt ${attempt + 1}/${maxRetries})`);
            const hash = await config_1.walletClient.writeContract({
                ...request,
                account: config_1.account,
                nonce: nonce, // Explicitly set nonce to avoid conflicts
            });
            const receipt = await config_1.publicClient.waitForTransactionReceipt({ hash });
            return {
                txHash: hash,
                blockNumber: receipt.blockNumber,
                explorerUrl: `${config_1.BLOCK_EXPLORER_URL}/tx/${hash}`,
            };
        }
        catch (error) {
            lastError = error;
            console.error(`❌ Error minting license on Mantle (attempt ${attempt + 1}/${maxRetries}):`, error?.message || error);
            // Check if it's a nonce-related error (check nested cause chain)
            const checkNonceError = (err, depth = 0) => {
                if (!err || depth > 5)
                    return false; // Prevent infinite recursion
                const message = (err?.message || err?.shortMessage || err?.details || '').toLowerCase();
                const name = (err?.name || '').toLowerCase();
                const isNonce = message.includes('nonce') ||
                    message.includes('already known') ||
                    name.includes('nonce') ||
                    name.includes('noncetoolow');
                if (isNonce)
                    return true;
                // Recursively check cause chain
                return checkNonceError(err?.cause, depth + 1);
            };
            const isNonceError = checkNonceError(error);
            if (isNonceError && attempt < maxRetries - 1) {
                // Wait a bit before retrying to allow nonce to update
                const delay = (attempt + 1) * 1000; // 1s, 2s, 3s
                console.log(`⏳ Nonce error detected. Waiting ${delay}ms before retry...`);
                await new Promise(resolve => setTimeout(resolve, delay));
                continue; // Retry with fresh nonce
            }
            // If not a nonce error or last attempt, throw
            throw error;
        }
    }
    // If we exhausted all retries, throw the last error
    throw lastError;
};
exports.mintLicenseOnMantle = mintLicenseOnMantle;
