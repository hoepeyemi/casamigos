#!/bin/bash
# Deploy FULL STACK to Base Sepolia: ModredIP + ERC6551 + CRE Consumer
# Requires: DEPLOYER_PRIVATE_KEY
# CRE Forwarder: default in ignition/constants.ts. Override with CRE_FORWARDER_ADDRESS.

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
    echo "Using default CRE Forwarder from ignition/constants.ts"
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
