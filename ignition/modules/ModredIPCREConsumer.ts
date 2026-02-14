// Deploy ModredIPCREConsumer (Chainlink CRE proxy for ModredIP).
// Prerequisites: ModredIP must already be deployed.
// After deploy: call ModredIP.setCREProxy(consumerAddress).
// Forwarder is set in ../constants.ts; override with CRE_FORWARDER_ADDRESS env if needed.

import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";
import { CRE_FORWARDER_ADDRESS as DEFAULT_FORWARDER } from "../constants";

const CRE_FORWARDER_ADDRESS = process.env.CRE_FORWARDER_ADDRESS || DEFAULT_FORWARDER;

const ModredIPCREConsumerModule = buildModule("ModredIPCREConsumerModule", (m) => {
  const modredIPAddress = m.getParameter("modredIPAddress");
  const forwarderAddress = m.getParameter("forwarderAddress", CRE_FORWARDER_ADDRESS);

  const consumer = m.contract("ModredIPCREConsumer", [forwarderAddress, modredIPAddress]);

  return { consumer };
});

export default ModredIPCREConsumerModule;
