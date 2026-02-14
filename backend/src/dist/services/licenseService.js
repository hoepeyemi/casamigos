"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getLicenseExplorerUrl = exports.mintLicense = void 0;
const storyService_1 = require("./storyService");
const config_1 = require("../utils/config");
const bigIntSerializer_1 = require("../utils/bigIntSerializer");
const mintLicense = async (licenseRequest) => {
    try {
        // Check if a license already exists for this IP (tokenId)
        const hasExistingLicense = await (0, storyService_1.checkExistingLicenses)(licenseRequest.tokenId, licenseRequest.searContractAddress);
        if (hasExistingLicense) {
            return {
                success: false,
                error: 'A license already exists for this IP asset. Only one license can be minted per IP.',
                message: 'License minting failed: IP already has a license'
            };
        }
        const { txHash, blockNumber, explorerUrl } = await (0, storyService_1.mintLicenseOnMantle)(licenseRequest.tokenId, licenseRequest.royaltyPercentage, licenseRequest.duration, licenseRequest.commercialUse, licenseRequest.terms, licenseRequest.searContractAddress);
        const result = {
            success: true,
            txHash,
            blockNumber,
            explorerUrl,
            message: 'License minted successfully on Mantle'
        };
        // Convert any BigInt values to strings for JSON serialization
        return (0, bigIntSerializer_1.convertBigIntsToStrings)(result);
    }
    catch (error) {
        console.error('Error minting license:', error);
        return {
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error occurred',
            message: 'Failed to mint license on Mantle'
        };
    }
};
exports.mintLicense = mintLicense;
const getLicenseExplorerUrl = (txHash) => {
    return `${config_1.BLOCK_EXPLORER_URL}/tx/${txHash}`;
};
exports.getLicenseExplorerUrl = getLicenseExplorerUrl;
