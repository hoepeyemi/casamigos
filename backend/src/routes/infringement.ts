import express from 'express';
import {
  handleInfringementStatus,
  handleInfringementStatusByContract,
  handleInfringementStatusAll,
} from '../controllers/infringementController';

const router = express.Router();

// Get infringement status by Yakoa ID
router.get('/status/:id', handleInfringementStatus);

// Get infringement status by contract address and token ID
router.get('/status/:contractAddress/:tokenId', handleInfringementStatusByContract);

// Get infringement status for all IP assets of the contract (same as frontend flow)
router.get('/status-all', handleInfringementStatusAll);

export default router; 