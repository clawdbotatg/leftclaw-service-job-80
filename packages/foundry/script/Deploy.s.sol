//SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "./DeployHelpers.s.sol";
import { DeployAnimalKingdom } from "./DeployAnimalKingdom.s.sol";

/**
 * @notice Main deployment script for all contracts
 * @dev Run this when you want to deploy multiple contracts at once
 *
 * Example: yarn deploy # runs this script(without`--file` flag)
 */
contract DeployScript is ScaffoldETHDeploy {
  function run() external {
    // Deploys all Animal Kingdom TCG contracts (Card, PackShop, TraitShop)
    // with the project's job.client as admin / owner of every contract.
    DeployAnimalKingdom deployAnimalKingdom = new DeployAnimalKingdom();
    deployAnimalKingdom.run();
  }
}