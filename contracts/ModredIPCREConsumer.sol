// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "./cre/ReceiverTemplate.sol";
import "./ModredIP.sol";

/**
 * @title ModredIPCREConsumer
 * @dev Chainlink CRE (Runtime Environment) consumer for ModredIP.
 * Receives signed reports from the Chainlink KeystoneForwarder and executes
 * registerIPFor or mintLicenseByProxy on the ModredIP contract.
 *
 * Report format: abi.encode(uint8 instructionType, bytes params)
 * - instructionType 0: registerIPFor. params = abi.encode(address beneficiary, string ipHash, string metadata, bool isEncrypted)
 * - instructionType 1: mintLicenseByProxy. params = abi.encode(uint256 tokenId, address licensee, uint256 royaltyPercentage, uint256 duration, bool commercialUse, string terms)
 *
 * Deployment:
 * 1. Deploy ModredIP (or use existing).
 * 2. Deploy ModredIPCREConsumer(forwarderAddress, modredIPAddress).
 * 3. Call ModredIP.setCREProxy(consumerAddress) so only this consumer can call registerIPFor/mintLicenseByProxy.
 * 4. In CRE workflow, use evmClient.writeReport(runtime, { receiver: consumerAddress, report }).
 *
 * Forwarder addresses: https://docs.chain.link/cre/guides/workflow/using-evm-client/forwarder-directory
 * - Simulation: use KeystoneForwarder for your chain.
 * - Production: use KeystoneForwarder for your chain (e.g. Base Sepolia).
 */
contract ModredIPCREConsumer is ReceiverTemplate {
    ModredIP public immutable modredIP;

    uint8 public constant INSTRUCTION_REGISTER_IP = 0;
    uint8 public constant INSTRUCTION_MINT_LICENSE = 1;

    event IPRegisteredViaCRE(address indexed beneficiary, uint256 tokenId, string ipHash);
    event LicenseMintedViaCRE(uint256 indexed tokenId, address indexed licensee, uint256 licenseId);

    error UnknownInstructionType(uint8 instructionType);

    constructor(address _forwarderAddress, address _modredIPAddress) ReceiverTemplate(_forwarderAddress) {
        require(_modredIPAddress != address(0), "Zero ModredIP");
        modredIP = ModredIP(_modredIPAddress);
    }

    function _processReport(bytes calldata report) internal override {
        (uint8 instructionType, bytes memory params) = abi.decode(report, (uint8, bytes));

        if (instructionType == INSTRUCTION_REGISTER_IP) {
            (address beneficiary, string memory ipHash, string memory metadata, bool isEncrypted) =
                abi.decode(params, (address, string, string, bool));
            uint256 tokenId = modredIP.registerIPFor(beneficiary, ipHash, metadata, isEncrypted);
            emit IPRegisteredViaCRE(beneficiary, tokenId, ipHash);
        } else if (instructionType == INSTRUCTION_MINT_LICENSE) {
            (
                uint256 tokenId,
                address licensee,
                uint256 royaltyPercentage,
                uint256 duration,
                bool commercialUse,
                string memory terms
            ) = abi.decode(params, (uint256, address, uint256, uint256, bool, string));
            uint256 licenseId = modredIP.mintLicenseByProxy(
                tokenId, licensee, royaltyPercentage, duration, commercialUse, terms
            );
            emit LicenseMintedViaCRE(tokenId, licensee, licenseId);
        } else {
            revert UnknownInstructionType(instructionType);
        }
    }
}
