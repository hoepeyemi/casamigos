// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/utils/introspection/IERC165.sol";

/// @title IReceiver - receives Chainlink CRE keystone reports
/// @notice Implementations must support the IReceiver interface through ERC165.
/// @dev See: https://docs.chain.link/cre/guides/workflow/using-evm-client/onchain-write/building-consumer-contracts
interface IReceiver is IERC165 {
    /// @notice Handles incoming keystone reports from the Chainlink Forwarder.
    /// @dev If this function call reverts, it can be retried with a higher gas limit.
    /// @param metadata Report's metadata (workflowId, workflowName, workflowOwner).
    /// @param report Workflow report payload (ABI-encoded data from your workflow).
    function onReport(bytes calldata metadata, bytes calldata report) external;
}
