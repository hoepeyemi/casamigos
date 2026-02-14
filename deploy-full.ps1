# Deploy FULL STACK to Base Sepolia: ModredIP + ERC6551 + CRE Consumer
# Requires: DEPLOYER_PRIVATE_KEY
# CRE Forwarder: default is in ignition/constants.ts (0x15fc6ae953e024d975e77382eeec56a9101f9f88). Override with CRE_FORWARDER_ADDRESS.

param(
    [string]$ForwarderAddress = $env:CRE_FORWARDER_ADDRESS
)

Write-Host "Deploying full stack (ModredIP + CRE consumer) to Base Sepolia..." -ForegroundColor Cyan
Write-Host ""

if (-not $env:DEPLOYER_PRIVATE_KEY) {
    Write-Host "Error: DEPLOYER_PRIVATE_KEY not set" -ForegroundColor Red
    Write-Host "  `$env:DEPLOYER_PRIVATE_KEY = 'your_private_key_here'"
    exit 1
}

Write-Host "Deployer key found." -ForegroundColor Green
if (-not $ForwarderAddress) {
    Write-Host "Using default CRE Forwarder from ignition/constants.ts" -ForegroundColor Green
    Write-Host ""
    npx hardhat ignition deploy ignition/modules/FullStack.ts --network baseSepolia
} else {
    Write-Host "Using CRE Forwarder: $ForwarderAddress" -ForegroundColor Green
    Write-Host ""
    $params = "{`"FullStackModule`":{`"forwarderAddress`":`"$ForwarderAddress`"}}"
    npx hardhat ignition deploy ignition/modules/FullStack.ts --network baseSepolia --parameters $params
}

Write-Host ""
Write-Host "Deployment complete. Update app/src/deployed_addresses.json with ModredIP and (optional) CRE consumer address." -ForegroundColor Cyan
