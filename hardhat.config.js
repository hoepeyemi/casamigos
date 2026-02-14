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
        mantleMainnet: {
            url: "https://rpc.mantle.xyz",
            accounts: [deployerPrivateKey],
            timeout: 120000, // 120 seconds
        },
        mantleTestnet: {
            url: "https://mantle-sepolia.drpc.org",
            accounts: [deployerPrivateKey],
            timeout: 120000, // 120 seconds
        },
    },
    etherscan: {
        apiKey: {
            mantleMainnet: "YOU_CAN_COPY_ME",
            mantleTestnet: "YOU_CAN_COPY_ME",
        },
        customChains: [
            {
                network: "mantleMainnet",
                chainId: 5000,
                urls: {
                    apiURL: "https://explorer.mantle.xyz/api",
                    browserURL: "https://explorer.mantle.xyz",
                },
            },
            {
                network: "mantleTestnet",
                chainId: 5003,
                urls: {
                    apiURL: "https://explorer.testnet.mantle.xyz/api",
                    browserURL: "https://explorer.testnet.mantle.xyz",
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
