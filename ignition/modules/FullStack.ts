// This setup uses Hardhat Ignition to deploy the full stack:
// - ERC6551Registry, ERC6551Account, ModredIP
// - ModredIPCREConsumer (CRE consumer; Forwarder address from ignition/constants.ts)
// - Wires ModredIP.setCREProxy(consumer)
//
// You do NOT deploy CRE's Forwarder—Chainlink hosts it. Override with CRE_FORWARDER_ADDRESS env or forwarderAddress param.

import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";
import { CRE_FORWARDER_ADDRESS as DEFAULT_FORWARDER } from "../constants";

const DEFAULT_FORWARDER_RESOLVED = process.env.CRE_FORWARDER_ADDRESS || DEFAULT_FORWARDER;

const FullStackModule = buildModule("FullStackModule", (m) => {
  const deployer = m.getAccount(0);
  const forwarderAddress = m.getParameter("forwarderAddress", DEFAULT_FORWARDER_RESOLVED) as unknown as string;

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
