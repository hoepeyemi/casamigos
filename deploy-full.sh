#!/bin/bash
# Deploy FULL STACK to Base Sepolia: ModredIP + ERC6551 + CRE Consumer
# Requires: DEPLOYER_PRIVATE_KEY
# Optional: CRE_FORWARDER_ADDRESS (from https://docs.chain.link/cre/guides/workflow/using-evm-client/forwarder-directory)

set -e

echo "Deploying full stack (ModredIP + CRE consumer) to Base Sepolia..."
echo ""

if [ -z "$DEPLOYER_PRIVATE_KEY" ]; then
    echo "Error: DEPLOYER_PRIVATE_KEY not set"
    echo "  export DEPLOYER_PRIVATE_KEY=your_private_key_here"
    exit 1
fi

echo "Deployer key found."

if [ -z "$CRE_FORWARDER_ADDRESS" ]; then
    echo "CRE_FORWARDER_ADDRESS not set - consumer will use 0x0 (set later via consumer.setForwarderAddress)"
    echo ""
    npx hardhat ignition deploy ignition/modules/FullStack.ts --network baseSepolia
else
    echo "Using CRE Forwarder: $CRE_FORWARDER_ADDRESS"
    echo ""
    npx hardhat ignition deploy ignition/modules/FullStack.ts --network baseSepolia \
        --parameters "{\"FullStackModule\":{\"forwarderAddress\":\"$CRE_FORWARDER_ADDRESS\"}}"
fi

echo ""
echo "Deployment complete. Update app/src/deployed_addresses.json with ModredIP and (optional) CRE consumer address."
