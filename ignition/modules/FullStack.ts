// This setup uses Hardhat Ignition to deploy the full stack:
// - ERC6551Registry, ERC6551Account, ModredIP
// - ModredIPCREConsumer (CRE consumer; requires Forwarder address from Chainlink)
// - Wires ModredIP.setCREProxy(consumer)
//
// You do NOT deploy CRE's Forwarder (KeystoneForwarder/Forwarder)—Chainlink hosts it.
// Get the Forwarder address for Base Sepolia from:
// https://docs.chain.link/cre/guides/workflow/using-evm-client/forwarder-directory
//
// Optional: set CRE_FORWARDER_ADDRESS before deploying, or pass forwarderAddress in parameters.
// Default below is Base Sepolia KeystoneForwarder (for simulation); use KeystoneForwarder for production.

import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

const BASE_SEPOLIA_FORWARDER = "0x15fC6ae953E024d975e77382eEeC56A9101f9F88";
const DEFAULT_FORWARDER = process.env.CRE_FORWARDER_ADDRESS || BASE_SEPOLIA_FORWARDER;

const FullStackModule = buildModule("FullStackModule", (m) => {
  const deployer = m.getAccount(0);
  const forwarderAddress = m.getParameter("forwarderAddress", DEFAULT_FORWARDER) as unknown as string;

  const registry = m.contract("ERC6551Registry");
  const accountImplementation = m.contract("ERC6551Account");
  m.call(registry, "addImplementation", [accountImplementation]);

  const modredIP = m.contract("ModredIP", [
    registry,
    accountImplementation,
    84532,
    deployer,
  ]);

  const consumer = m.contract("ModredIPCREConsumer", [forwarderAddress, modredIP]);
  m.call(modredIP, "setCREProxy", [consumer]);

  return {
    registry,
    accountImplementation,
    modredIP,
    consumer,
  };
});

export default FullStackModule;
