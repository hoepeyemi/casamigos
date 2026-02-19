"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
require("@nomicfoundation/hardhat-toolbox-viem");
require("@nomicfoundation/hardhat-verify");
const config_1 = require("hardhat/config");
if (!config_1.vars.has("DEPLOYER_PRIVATE_KEY")) {
    console.error("Missing env var DEPLOYER_PRIVATE_KEY");
}
const deployerPrivateKey = config_1.vars.get("DEPLOYER_PRIVATE_KEY");
const config = {
    solidity: "0.8.24",
    networks: {
        baseSepolia: {
            url: "https://sepolia.base.org",
            accounts: [deployerPrivateKey],
            timeout: 120000, // 120 seconds
        },
    },
    etherscan: {
        apiKey: {
            baseSepolia: "YOU_CAN_COPY_ME",
        },
        customChains: [
            {
                network: "baseSepolia",
                chainId: 84532,
                urls: {
                    apiURL: "https://api-sepolia.basescan.org/api",
                    browserURL: "https://sepolia.basescan.org",
                },
            },
        ],
    },
    sourcify: {
        // Disabled by default
        // Doesn't need an API key
        enabled: false,
    },
};
exports.default = config;
