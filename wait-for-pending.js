// Script to wait for pending transactions to be confirmed
const { createPublicClient, http } = require('viem');
const { privateKeyToAccount } = require('viem/accounts');

// Get deployer address from private key
const deployerPrivateKey = process.env.DEPLOYER_PRIVATE_KEY;
if (!deployerPrivateKey) {
  console.error('❌ DEPLOYER_PRIVATE_KEY not set');
  console.error('Please set it: $env:DEPLOYER_PRIVATE_KEY="your_key"');
  process.exit(1);
}

const account = privateKeyToAccount(`0x${deployerPrivateKey.replace(/^0x/, '')}`);

const publicClient = createPublicClient({
  chain: {
    id: 84532,
    name: 'Base Sepolia',
    nativeCurrency: { name: 'ETH', symbol: 'ETH', decimals: 18 },
    rpcUrls: {
      default: { http: ['https://sepolia.base.org'] },
    },
  },
  transport: http('https://sepolia.base.org'),
});

async function waitForPendingTransactions() {
  try {
    console.log('🔍 Checking deployer account:', account.address);
    console.log('💡 Check transactions at: https://sepolia.basescan.org/address/' + account.address);
    console.log('');
    
    let hasPending = true;
    let checkCount = 0;
    const maxChecks = 60; // Check for up to 5 minutes (60 * 5 seconds)
    
    while (hasPending && checkCount < maxChecks) {
      // Get confirmed nonce
      const confirmedNonce = await publicClient.getTransactionCount({
        address: account.address,
        blockTag: 'latest',
      });
      
      // Get pending nonce (includes pending transactions)
      const pendingNonce = await publicClient.getTransactionCount({
        address: account.address,
        blockTag: 'pending',
      });
      
      const pendingCount = pendingNonce - confirmedNonce;
      
      if (pendingCount > 0) {
        console.log(`⏳ [${checkCount + 1}/${maxChecks}] Pending transactions: ${pendingCount} (Confirmed: ${confirmedNonce}, Pending: ${pendingNonce})`);
        console.log('   Waiting 5 seconds...');
        await new Promise(resolve => setTimeout(resolve, 5000));
        checkCount++;
      } else {
        hasPending = false;
        console.log('');
        console.log('✅ No pending transactions! Safe to deploy now.');
        console.log(`   Confirmed nonce: ${confirmedNonce}`);
        console.log('');
      }
    }
    
    if (hasPending) {
      console.log('');
      console.log('⚠️  Still have pending transactions after waiting.');
      console.log('   You may need to wait longer or check the explorer manually.');
      console.log(`   https://sepolia.basescan.org/address/${account.address}`);
    }
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

waitForPendingTransactions();
