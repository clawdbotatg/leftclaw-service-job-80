// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "./DeployHelpers.s.sol";
import { AnimalKingdomCard } from "../contracts/AnimalKingdomCard.sol";
import { PackShop } from "../contracts/PackShop.sol";
import { TraitShop } from "../contracts/TraitShop.sol";

/**
 * @notice Deploys the Animal Kingdom TCG contracts to the target network.
 *
 *         Owner / admin for every deployed contract is the project's `job.client` address.
 *         The deployer (worker) does not retain any privileged role.
 *
 *         AnimalKingdomCard uses AccessControlDefaultAdminRules (3-day delayed admin
 *         transfer), so we cannot atomically: deploy with deployer as admin, grant a role
 *         to TraitShop, then transfer admin to the client. Instead the client is the admin
 *         from the very first transaction. The client is responsible for granting
 *         TRAIT_FUSER_ROLE to the deployed TraitShop in a follow-up transaction (documented
 *         in HANDOFF.md).
 *
 *         Pack catalog seeding and trait catalog seeding are also client-side actions —
 *         not performed here.
 */
contract DeployAnimalKingdom is ScaffoldETHDeploy {
    /// @dev Default `job.client` for Job #80. Override at deploy time by setting
    ///      `CLIENT_ADDRESS` in the environment.
    address internal constant DEFAULT_CLIENT = 0xFE968dE21eb0E77d5877477C31a04A3075c0086E;

    /// @dev Base mainnet USDC. Hard-coded — only used when deploying to chainid 8453.
    address internal constant BASE_USDC = 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913;

    function run() external ScaffoldEthDeployerRunner {
        address client = vm.envOr("CLIENT_ADDRESS", DEFAULT_CLIENT);
        require(client != address(0), "client zero");

        address usdc = vm.envOr("USDC_ADDRESS", BASE_USDC);
        require(usdc != address(0), "usdc zero");

        AnimalKingdomCard card = new AnimalKingdomCard(client);
        deployments.push(Deployment({ name: "AnimalKingdomCard", addr: address(card) }));

        PackShop packShop = new PackShop(client, usdc);
        deployments.push(Deployment({ name: "PackShop", addr: address(packShop) }));

        TraitShop traitShop = new TraitShop(client, address(card));
        deployments.push(Deployment({ name: "TraitShop", addr: address(traitShop) }));

        // No role grants here — client must grant TRAIT_FUSER_ROLE post-deploy.
        // No pack seeding here — client owns the operational config.

        console.log("AnimalKingdomCard:", address(card));
        console.log("PackShop:        ", address(packShop));
        console.log("TraitShop:       ", address(traitShop));
        console.log("Admin / owner:   ", client);
    }
}
