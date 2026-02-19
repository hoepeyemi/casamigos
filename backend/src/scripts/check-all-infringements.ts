/**
 * Run Yakoa infringement check on all IP assets of the ModredIP contract.
 * Uses the same flow as the frontend: read token IDs from contract, then
 * call Yakoa for each (contract:tokenId).
 *
 * Requires in backend/.env: YAKOA_API_KEY, YAKOA_SUBDOMAIN, YAKOA_NETWORK.
 * Optional: MODRED_IP_CONTRACT_ADDRESS (else uses app/src/deployed_addresses.json).
 * Optional: RPC_PROVIDER_URL or RPC_URL for chain reads.
 *
 * Run from repo root: npm run check:infringements --prefix backend
 * Or from backend: npm run check:infringements
 */

import 'dotenv/config';
import {
  getModredIPContractAddress,
  getInfringementStatusForAllIpAssets,
  type AllInfringementResult,
} from '../services/infringementAllService';

function main() {
  console.log('🔍 Infringement check for all IP assets (Yakoa)\n');

  const contractAddress = getModredIPContractAddress();
  console.log('Contract:', contractAddress);

  getInfringementStatusForAllIpAssets(contractAddress)
    .then((result: AllInfringementResult) => {
      console.log('\n--- Results ---');
      console.log('Total IP assets:', result.totalAssets);

      if (result.results.length === 0) {
        console.log('No IP assets found on contract.');
        return;
      }

      for (const r of result.results) {
        if (r.error) {
          console.log(`  Token #${r.tokenId}: ERROR - ${r.error}`);
          continue;
        }
        const inf = r.infringement!;
        const total = inf.totalInfringements;
        const badge = total > 0 ? `⚠️ ${total} infringement(s)` : '✅ Clean';
        console.log(`  Token #${r.tokenId}: ${badge} (status: ${inf.status}, result: ${inf.result})`);
      }

      const withErrors = result.results.filter((r) => r.error);
      const withInfringements = result.results.filter(
        (r) => !r.error && r.infringement && r.infringement.totalInfringements > 0
      );
      console.log('\n--- Summary ---');
      console.log('Clean:', result.results.length - withErrors.length - withInfringements.length);
      console.log('With infringements:', withInfringements.length);
      if (withErrors.length) console.log('Errors:', withErrors.length);
    })
    .catch((err) => {
      console.error('Failed:', err instanceof Error ? err.message : err);
      process.exit(1);
    });
}

main();
