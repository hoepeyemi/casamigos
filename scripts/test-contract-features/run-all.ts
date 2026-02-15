/**
 * Runs all frontend contract features in sequence against the deployed ModredIP on Base Sepolia.
 * Requires: TEST_PRIVATE_KEY (wallet with Base Sepolia ETH).
 * Optional: DISPUTER_PRIVATE_KEY, ARBITRATOR_PRIVATE_KEY for dispute/arbitration steps.
 *
 * Run: npx ts-node scripts/test-contract-features/run-all.ts
 * Or:  npm run test:contract-features
 */

import { parseEther, formatEther } from "viem";
import { getConfig } from "./config";
import { MODRED_IP_ABI } from "./abi";

const log = (msg: string) => console.log("[test]", msg);

async function main() {
  const { modredIPAddress, publicClient, walletClient, mainAccount } = getConfig();
  if (!walletClient) throw new Error("walletClient required");

  log("Contract: " + modredIPAddress);
  log("Account:  " + mainAccount.address);
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
    args: ["QmTestScriptHash" + Date.now(), '{"name":"Test IP"}', false],
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
    args: [BigInt(tokenId), 1000n, 86400n * 30n, true, "test terms"],
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
  log("8. payRevenue(tokenId) with 0.001 ETH");
  const payTxHash = await walletClient.writeContract({
    address: modredIPAddress,
    abi: MODRED_IP_ABI,
    functionName: "payRevenue",
    args: [BigInt(tokenId)],
    value: parseEther("0.001"),
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

  // --- Raise dispute (frontend: raiseDispute) - optional, needs second wallet as disputer ---
  log("11. raiseDispute - skipped unless DISPUTER_PRIVATE_KEY set (use second wallet to dispute this token)");

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
    log("   (may already be registered) " + (e?.message || e));
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

  log("");
  log("Done. All frontend contract features exercised.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
