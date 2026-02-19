/**
 * Runs all frontend contract features in sequence against the deployed ModredIP on Base Sepolia.
 * Requires: TEST_PRIVATE_KEY (wallet with Base Sepolia ETH).
 * Optional: DISPUTER_PRIVATE_KEY, ARBITRATOR_PRIVATE_KEY for dispute/arbitration steps.
 *
 * Run: npx ts-node scripts/test-contract-features/run-all.ts
 * Or:  npm run test:contract-features
 */

import { parseEther, formatEther } from "viem";
import { getConfig, getTestInputs } from "./config";
import { MODRED_IP_ABI } from "./abi";

const log = (msg: string) => console.log("[test]", msg);

async function main() {
  const { modredIPAddress, publicClient, walletClient, mainAccount, disputerWalletClient } = getConfig();
  const inputs = getTestInputs();
  if (!walletClient) throw new Error("walletClient required");

  log("Contract: " + modredIPAddress);
  log("Account:  " + mainAccount.address);
  log("IP hash:  " + inputs.ipHash);
  log("Metadata: " + (inputs.metadata.length > 60 ? inputs.metadata.slice(0, 60) + "..." : inputs.metadata));
  log("");

  // --- Reads (same as frontend) ---
  log("1. Read nextTokenId");
  const nextTokenId = await publicClient.readContract({
    address: modredIPAddress,
    abi: MODRED_IP_ABI,
    functionName: "nextTokenId",
  });
  log("   nextTokenId = " + String(nextTokenId));

  log("2. Read nextLicenseId");
  const nextLicenseId = await publicClient.readContract({
    address: modredIPAddress,
    abi: MODRED_IP_ABI,
    functionName: "nextLicenseId",
  });
  log("   nextLicenseId = " + String(nextLicenseId));

  log("3. Read MIN_ARBITRATOR_STAKE");
  const minStake = await publicClient.readContract({
    address: modredIPAddress,
    abi: MODRED_IP_ABI,
    functionName: "MIN_ARBITRATOR_STAKE",
  });
  log("   MIN_ARBITRATOR_STAKE = " + formatEther(minStake) + " ETH");

  // --- Register IP (frontend: backend does this; we call contract directly) ---
  log("4. registerIP(ipHash, metadata, isEncrypted)");
  const hash = await walletClient.writeContract({
    address: modredIPAddress,
    abi: MODRED_IP_ABI,
    functionName: "registerIP",
    args: [inputs.ipHash, inputs.metadata, inputs.isEncrypted],
    account: mainAccount,
  });
  log("   tx: " + hash);
  await publicClient.waitForTransactionReceipt({ hash });
  log("   tx confirmed");

  const tokenId = await publicClient.readContract({
    address: modredIPAddress,
    abi: MODRED_IP_ABI,
    functionName: "nextTokenId",
  }).then((n) => Number(n) - 1);
  log("   new tokenId = " + tokenId);

  // --- getIPAsset ---
  log("5. getIPAsset(tokenId)");
  const ipAsset = await publicClient.readContract({
    address: modredIPAddress,
    abi: MODRED_IP_ABI,
    functionName: "getIPAsset",
    args: [BigInt(tokenId)],
  });
  log("   owner = " + ipAsset[0]);

  // --- Mint license (frontend: mintLicense) ---
  log("6. mintLicense(tokenId, royaltyPercentage, duration, commercialUse, terms)");
  const licenseTxHash = await walletClient.writeContract({
    address: modredIPAddress,
    abi: MODRED_IP_ABI,
    functionName: "mintLicense",
    args: [BigInt(tokenId), inputs.royaltyBps, inputs.durationSec, inputs.commercialUse, inputs.terms],
    account: mainAccount,
  });
  log("   tx: " + licenseTxHash);
  await publicClient.waitForTransactionReceipt({ hash: licenseTxHash });
  const licenseId = Number(nextLicenseId);
  log("   new licenseId = " + licenseId);

  // --- getLicense ---
  log("7. getLicense(licenseId)");
  const license = await publicClient.readContract({
    address: modredIPAddress,
    abi: MODRED_IP_ABI,
    functionName: "getLicense",
    args: [BigInt(licenseId)],
  });
  log("   licensee = " + license[0]);

  // --- Pay revenue (frontend: payRevenue) ---
  log("8. payRevenue(tokenId) with " + inputs.payRevenueEth + " ETH");
  const payTxHash = await walletClient.writeContract({
    address: modredIPAddress,
    abi: MODRED_IP_ABI,
    functionName: "payRevenue",
    args: [BigInt(tokenId)],
    value: parseEther(inputs.payRevenueEth),
    account: mainAccount,
  });
  log("   tx: " + payTxHash);
  await publicClient.waitForTransactionReceipt({ hash: payTxHash });

  // --- getRoyaltyInfo ---
  log("9. getRoyaltyInfo(tokenId, account)");
  const royaltyInfo = await publicClient.readContract({
    address: modredIPAddress,
    abi: MODRED_IP_ABI,
    functionName: "getRoyaltyInfo",
    args: [BigInt(tokenId), mainAccount.address],
  });
  log("   claimable = " + formatEther(royaltyInfo[1]) + " ETH");

  // --- Claim royalties (frontend: claimRoyalties) ---
  log("10. claimRoyalties(tokenId)");
  const claimTxHash = await walletClient.writeContract({
    address: modredIPAddress,
    abi: MODRED_IP_ABI,
    functionName: "claimRoyalties",
    args: [BigInt(tokenId)],
    account: mainAccount,
  });
  log("   tx: " + claimTxHash);
  await publicClient.waitForTransactionReceipt({ hash: claimTxHash });

  // --- Raise dispute (frontend: raiseDispute) - optional, uses DISPUTER_PRIVATE_KEY as second wallet ---
  log("11. raiseDispute(tokenId, reason)");
  if (disputerWalletClient) {
    const disputeReason = process.env.TEST_DISPUTE_REASON?.trim() || "Test dispute from script";
    try {
      const disputeTxHash = await disputerWalletClient.writeContract({
        address: modredIPAddress,
        abi: MODRED_IP_ABI,
        functionName: "raiseDispute",
        args: [BigInt(tokenId), disputeReason],
        account: disputerWalletClient.account!,
      });
      log("   tx: " + disputeTxHash);
      await publicClient.waitForTransactionReceipt({ hash: disputeTxHash });
    } catch (e: any) {
      log("   error: " + (e?.shortMessage ?? e?.message ?? String(e)));
    }
  } else {
    log("   skipped (set DISPUTER_PRIVATE_KEY in .env to use a second wallet as disputer)");
  }

  // --- Register arbitrator (frontend: registerArbitrator) ---
  log("12. registerArbitrator() with MIN_ARBITRATOR_STAKE");
  try {
    const regArbTxHash = await walletClient.writeContract({
      address: modredIPAddress,
      abi: MODRED_IP_ABI,
      functionName: "registerArbitrator",
      args: [],
      value: minStake,
      account: mainAccount,
    });
    log("   tx: " + regArbTxHash);
    await publicClient.waitForTransactionReceipt({ hash: regArbTxHash });
  } catch (e: any) {
    const msg = e?.shortMessage ?? e?.message ?? String(e);
    if (msg.includes("Already registered") || (e?.cause?.reason === "Already registered")) {
      log("   already registered, skipping");
    } else {
      log("   error: " + msg);
    }
  }

  // --- Read arbitrators ---
  log("13. getAllArbitrators()");
  const arbitrators = await publicClient.readContract({
    address: modredIPAddress,
    abi: MODRED_IP_ABI,
    functionName: "getAllArbitrators",
  });
  log("   count = " + arbitrators.length);

  log("14. getActiveArbitratorsCount()");
  const activeCount = await publicClient.readContract({
    address: modredIPAddress,
    abi: MODRED_IP_ABI,
    functionName: "getActiveArbitratorsCount",
  });
  log("   count = " + String(activeCount));

  // --- Summary: all IP assets, licenses, arbitrators, disputes ---
  log("");
  log("========== SUMMARY: All on-chain data ==========");

  const finalNextTokenId = await publicClient.readContract({
    address: modredIPAddress,
    abi: MODRED_IP_ABI,
    functionName: "nextTokenId",
  }).then((n) => Number(n));
  const finalNextLicenseId = await publicClient.readContract({
    address: modredIPAddress,
    abi: MODRED_IP_ABI,
    functionName: "nextLicenseId",
  }).then((n) => Number(n));
  const finalNextDisputeId = await publicClient.readContract({
    address: modredIPAddress,
    abi: MODRED_IP_ABI,
    functionName: "nextDisputeId",
  }).then((n) => Number(n));

  log("");
  log("--- All IP assets (" + Math.max(0, finalNextTokenId - 1) + ") ---");
  for (let tokenId = 1; tokenId < finalNextTokenId; tokenId++) {
    const a = await publicClient.readContract({
      address: modredIPAddress,
      abi: MODRED_IP_ABI,
      functionName: "getIPAsset",
      args: [BigInt(tokenId)],
    });
    log("  [Token #" + tokenId + "] owner=" + a[0] + " ipHash=" + (a[1].length > 50 ? a[1].slice(0, 50) + "..." : a[1]));
    log("           metadata=" + (a[2].length > 60 ? a[2].slice(0, 60) + "..." : a[2]));
    log("           isEncrypted=" + a[3] + " isDisputed=" + a[4] + " registrationDate=" + String(a[5]));
    log("           totalRevenue=" + formatEther(a[6]) + " ETH royaltyTokens=" + String(a[7]));
  }

  log("");
  log("--- All licenses (" + Math.max(0, finalNextLicenseId - 1) + ") ---");
  for (let licenseId = 1; licenseId < finalNextLicenseId; licenseId++) {
    const l = await publicClient.readContract({
      address: modredIPAddress,
      abi: MODRED_IP_ABI,
      functionName: "getLicense",
      args: [BigInt(licenseId)],
    });
    log("  [License #" + licenseId + "] licensee=" + l[0] + " tokenId=" + String(l[1]));
    log("           royaltyPercentage=" + String(l[2]) + " (bps) duration=" + String(l[3]) + " startDate=" + String(l[4]));
    log("           isActive=" + l[5] + " commercialUse=" + l[6] + " terms=" + (l[7].length > 40 ? l[7].slice(0, 40) + "..." : l[7]));
  }

  log("");
  log("--- All arbitrators (" + arbitrators.length + ") ---");
  for (let i = 0; i < arbitrators.length; i++) {
    const addr = arbitrators[i];
    const arb = await publicClient.readContract({
      address: modredIPAddress,
      abi: MODRED_IP_ABI,
      functionName: "getArbitrator",
      args: [addr],
    });
    log("  [" + (i + 1) + "] address=" + addr + " stake=" + formatEther(arb[1]) + " ETH reputation=" + String(arb[2]));
    log("      totalCases=" + String(arb[3]) + " successfulCases=" + String(arb[4]) + " isActive=" + arb[5] + " registrationDate=" + String(arb[6]));
  }

  log("");
  log("--- All disputes (" + Math.max(0, finalNextDisputeId - 1) + ") ---");
  for (let disputeId = 1; disputeId < finalNextDisputeId; disputeId++) {
    const d = await publicClient.readContract({
      address: modredIPAddress,
      abi: MODRED_IP_ABI,
      functionName: "getDispute",
      args: [BigInt(disputeId)],
    });
    log("  [Dispute #" + disputeId + "] tokenId=" + String(d[1]) + " disputer=" + d[2]);
    log("           reason=" + (d[3].length > 50 ? d[3].slice(0, 50) + "..." : d[3]));
    log("           timestamp=" + String(d[4]) + " isResolved=" + d[5] + " arbitrationId=" + String(d[6]));
  }

  log("");
  log("========== Done. All frontend contract features exercised. ==========");

  // --- Infringement check for all IP assets (backend Yakoa) ---
  if (process.env.RUN_INFRINGEMENT_CHECK !== "false") {
    log("");
    log("========== Infringement check (all IP assets via backend) ==========");
    const path = require("path");
    const { execSync } = require("child_process");
    const backendDir = path.join(__dirname, "..", "..", "backend");
    try {
      execSync("npx ts-node src/scripts/check-all-infringements.ts", {
        cwd: backendDir,
        stdio: "inherit",
        env: { ...process.env, MODRED_IP_CONTRACT_ADDRESS: modredIPAddress },
      });
    } catch {
      log("   (Skipped or failed: ensure backend/.env has YAKOA_API_KEY, YAKOA_SUBDOMAIN, YAKOA_NETWORK)");
    }
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
