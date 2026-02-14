// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/utils/introspection/IERC165.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "./IReceiver.sol";

/// @title ReceiverTemplate - Abstract receiver for Chainlink CRE reports with optional permission controls
/// @notice Provides forwarder validation and optional workflow ID/author/name checks.
/// @dev Set forwarder at deployment; optionally set expectedWorkflowId, expectedAuthor, or expectedWorkflowName.
abstract contract ReceiverTemplate is IReceiver, Ownable {
    address private s_forwarderAddress;
    address private s_expectedAuthor;
    bytes10 private s_expectedWorkflowName;
    bytes32 private s_expectedWorkflowId;

    bytes private constant HEX_CHARS = "0123456789abcdef";

    error InvalidForwarderAddress();
    error InvalidSender(address sender, address expected);
    error InvalidAuthor(address received, address expected);
    error InvalidWorkflowName(bytes10 received, bytes10 expected);
    error InvalidWorkflowId(bytes32 received, bytes32 expected);
    error WorkflowNameRequiresAuthorValidation();

    event ForwarderAddressUpdated(address indexed previousForwarder, address indexed newForwarder);
    event ExpectedAuthorUpdated(address indexed previousAuthor, address indexed newAuthor);
    event ExpectedWorkflowNameUpdated(bytes10 indexed previousName, bytes10 indexed newName);
    event ExpectedWorkflowIdUpdated(bytes32 indexed previousId, bytes32 indexed newId);

    constructor(address _forwarderAddress) Ownable(msg.sender) {
        if (_forwarderAddress == address(0)) revert InvalidForwarderAddress();
        s_forwarderAddress = _forwarderAddress;
        emit ForwarderAddressUpdated(address(0), _forwarderAddress);
    }

    function getForwarderAddress() external view returns (address) {
        return s_forwarderAddress;
    }

    function getExpectedAuthor() external view returns (address) {
        return s_expectedAuthor;
    }

    function getExpectedWorkflowName() external view returns (bytes10) {
        return s_expectedWorkflowName;
    }

    function getExpectedWorkflowId() external view returns (bytes32) {
        return s_expectedWorkflowId;
    }

    function onReport(bytes calldata metadata, bytes calldata report) external override {
        if (s_forwarderAddress != address(0) && msg.sender != s_forwarderAddress) {
            revert InvalidSender(msg.sender, s_forwarderAddress);
        }

        if (s_expectedWorkflowId != bytes32(0) || s_expectedAuthor != address(0) || s_expectedWorkflowName != bytes10(0)) {
            (bytes32 workflowId, bytes10 workflowName, address workflowOwner) = _decodeMetadata(metadata);

            if (s_expectedWorkflowId != bytes32(0) && workflowId != s_expectedWorkflowId) {
                revert InvalidWorkflowId(workflowId, s_expectedWorkflowId);
            }
            if (s_expectedAuthor != address(0) && workflowOwner != s_expectedAuthor) {
                revert InvalidAuthor(workflowOwner, s_expectedAuthor);
            }
            if (s_expectedWorkflowName != bytes10(0)) {
                if (s_expectedAuthor == address(0)) revert WorkflowNameRequiresAuthorValidation();
                if (workflowName != s_expectedWorkflowName) revert InvalidWorkflowName(workflowName, s_expectedWorkflowName);
            }
        }

        _processReport(report);
    }

    function setForwarderAddress(address _forwarder) external onlyOwner {
        address previousForwarder = s_forwarderAddress;
        s_forwarderAddress = _forwarder;
        emit ForwarderAddressUpdated(previousForwarder, _forwarder);
    }

    function setExpectedAuthor(address _author) external onlyOwner {
        address previousAuthor = s_expectedAuthor;
        s_expectedAuthor = _author;
        emit ExpectedAuthorUpdated(previousAuthor, _author);
    }

    function setExpectedWorkflowName(string calldata _name) external onlyOwner {
        bytes10 previousName = s_expectedWorkflowName;
        if (bytes(_name).length == 0) {
            s_expectedWorkflowName = bytes10(0);
            emit ExpectedWorkflowNameUpdated(previousName, bytes10(0));
            return;
        }
        bytes32 hash = sha256(bytes(_name));
        bytes memory hexString = _bytesToHexString(abi.encodePacked(hash));
        bytes memory first10 = new bytes(10);
        for (uint256 i = 0; i < 10 && i < hexString.length; i++) {
            first10[i] = hexString[i];
        }
        s_expectedWorkflowName = bytes10(first10);
        emit ExpectedWorkflowNameUpdated(previousName, s_expectedWorkflowName);
    }

    function setExpectedWorkflowId(bytes32 _id) external onlyOwner {
        bytes32 previousId = s_expectedWorkflowId;
        s_expectedWorkflowId = _id;
        emit ExpectedWorkflowIdUpdated(previousId, _id);
    }

    function _bytesToHexString(bytes memory data) internal pure returns (bytes memory) {
        bytes memory hexString = new bytes(data.length * 2);
        for (uint256 i = 0; i < data.length; i++) {
            hexString[i * 2] = HEX_CHARS[uint8(data[i] >> 4)];
            hexString[i * 2 + 1] = HEX_CHARS[uint8(data[i] & 0x0f)];
        }
        return hexString;
    }

    /// @param metadata abi.encodePacked(workflowId, workflowName, workflowOwner) from Forwarder; layout: 32 bytes workflowId, 10 bytes workflowName, 20 bytes workflowOwner (62 bytes payload + 32 length = 94 min)
    function _decodeMetadata(bytes memory metadata) internal pure returns (bytes32 workflowId, bytes10 workflowName, address workflowOwner) {
        require(metadata.length >= 94, "Metadata too short");
        assembly {
            workflowId := mload(add(metadata, 32))
            workflowName := mload(add(metadata, 64))
            workflowOwner := shr(96, mload(add(metadata, 74)))
        }
        return (workflowId, workflowName, workflowOwner);
    }

    function _processReport(bytes calldata report) internal virtual;

    function supportsInterface(bytes4 interfaceId) public view virtual override returns (bool) {
        return interfaceId == type(IReceiver).interfaceId || interfaceId == type(IERC165).interfaceId;
    }
}
