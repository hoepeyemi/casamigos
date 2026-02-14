// Deploy ModredIPCREConsumer (Chainlink CRE proxy for ModredIP).
// Prerequisites: ModredIP must already be deployed. Set CRE_FORWARDER_ADDRESS (KeystoneForwarder or Forwarder).
// After deploy: call ModredIP.setCREProxy(consumerAddress).
// Forwarder directory: https://docs.chain.link/cre/guides/workflow/using-evm-client/forwarder-directory

import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

const CRE_FORWARDER_ADDRESS = process.env.CRE_FORWARDER_ADDRESS || "0x0000000000000000000000000000000000000000";

const ModredIPCREConsumerModule = buildModule("ModredIPCREConsumerModule", (m) => {
  const modredIPAddress = m.getParameter("modredIPAddress");
  const forwarderAddress = m.getParameter("forwarderAddress", CRE_FORWARDER_ADDRESS);

  const consumer = m.contract("ModredIPCREConsumer", [forwarderAddress, modredIPAddress]);

  return { consumer };
});

export default ModredIPCREConsumerModule;
