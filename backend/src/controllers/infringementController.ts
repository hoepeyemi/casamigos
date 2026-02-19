import { Request, Response } from 'express';
import { getYakoaInfringementStatus } from '../services/yakoascanner';
import {
  getInfringementStatusForAllIpAssets,
  getModredIPContractAddress,
} from '../services/infringementAllService';
import { convertBigIntsToStrings } from '../utils/bigIntSerializer';

const handleInfringementStatus = async (req: Request, res: Response) => {
  console.log("🔥 Entered handleInfringementStatus");
  try {
    const { id } = req.params;
    console.log("📦 Received infringement status request for ID:", id);

    // Validate required parameters
    if (!id) {
      return res.status(400).json({
        error: 'Missing required parameter: id'
      });
    }

    // Get infringement status from Yakoa
    const infringementStatus = await getYakoaInfringementStatus(id);

    const responseData = {
      message: 'Infringement status retrieved successfully',
      data: infringementStatus
    };

    return res.status(200).json(convertBigIntsToStrings(responseData));
  } catch (err) {
    console.error('❌ Infringement status error:', err);
    return res.status(500).json({
      error: 'Failed to retrieve infringement status',
      details: err instanceof Error ? err.message : err,
    });
  }
};

const handleInfringementStatusByContract = async (req: Request, res: Response) => {
  console.log("🔥 Entered handleInfringementStatusByContract");
  try {
    const { contractAddress, tokenId } = req.params;
    console.log("📦 Received infringement status request for contract:", contractAddress, "token:", tokenId);

    // Validate required parameters
    if (!contractAddress || !tokenId) {
      return res.status(400).json({
        error: 'Missing required parameters: contractAddress, tokenId'
      });
    }

    // Format ID as contract address with token ID
    const id = `${contractAddress.toLowerCase()}:${tokenId}`;

    // Get infringement status from Yakoa
    const infringementStatus = await getYakoaInfringementStatus(id);

    const responseData = {
      message: 'Infringement status retrieved successfully',
      data: infringementStatus
    };

    return res.status(200).json(convertBigIntsToStrings(responseData));
  } catch (err) {
    console.error('❌ Infringement status error:', err);
    return res.status(500).json({
      error: 'Failed to retrieve infringement status',
      details: err instanceof Error ? err.message : err,
    });
  }
};

const handleInfringementStatusAll = async (req: Request, res: Response) => {
  try {
    const contractAddress =
      (req.query.contractAddress as string)?.trim() || getModredIPContractAddress();
    const result = await getInfringementStatusForAllIpAssets(contractAddress);
    return res.status(200).json(convertBigIntsToStrings(result));
  } catch (err) {
    console.error('Infringement status all error:', err);
    return res.status(500).json({
      error: 'Failed to retrieve infringement status for all IP assets',
      details: err instanceof Error ? err.message : err,
    });
  }
};

export { handleInfringementStatus, handleInfringementStatusByContract, handleInfringementStatusAll }; 