// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import { Test } from "forge-std/Test.sol";
import { TraitShop } from "../contracts/TraitShop.sol";
import { AnimalKingdomCard } from "../contracts/AnimalKingdomCard.sol";

contract TestTraitShop is Test {
    TraitShop internal shop;
    AnimalKingdomCard internal card;

    address internal admin = vm.addr(1);
    address internal player = vm.addr(2);
    address internal stranger = vm.addr(3);
    address internal newRevenue = vm.addr(4);

    uint256 internal constant TRAIT_PRICE_WEI = 0.005 ether;

    function setUp() public {
        card = new AnimalKingdomCard(admin);
        shop = new TraitShop(admin, address(card));
        // Cache role hash to avoid consuming the prank with a view call inside the tx.
        bytes32 fuserRole = card.TRAIT_FUSER_ROLE();
        vm.prank(admin);
        card.grantRole(fuserRole, address(shop));
        // Mint a card to player for fuse tests.
        vm.prank(admin);
        card.mintCreature(player, 1, 5, 5, 5, 5);
        // Catalog one trait.
        vm.prank(admin);
        shop.addTrait(42, TRAIT_PRICE_WEI, "ipfs://traits/42.json");
        vm.deal(player, 10 ether);
    }

    // -------------------------------------------------------------------------
    // [Issue #2] `card` is immutable — there is no setCard on TraitShop.
    // -------------------------------------------------------------------------

    function test_CardImmutableMatchesConstructor() public view {
        assertEq(shop.card(), address(card));
    }

    /// @dev Statically asserts the absence of setCard by trying to call its 4-byte
    ///      selector. With the function removed, the call falls through to the absent
    ///      fallback and reverts.
    function test_SetCardSelectorAbsent() public {
        // selector for setCard(address)
        bytes4 selector = bytes4(keccak256("setCard(address)"));
        (bool ok,) = address(shop).call(abi.encodeWithSelector(selector, address(0xdead)));
        assertFalse(ok, "setCard should not exist on TraitShop");
    }

    // -------------------------------------------------------------------------
    // [Issue #5] Exact payment required.
    // -------------------------------------------------------------------------

    function test_BuyTraitExactPaymentSucceeds() public {
        uint256 adminBalanceBefore = admin.balance;
        vm.prank(player);
        shop.buyTrait{ value: TRAIT_PRICE_WEI }(1, 42);
        assertEq(admin.balance - adminBalanceBefore, TRAIT_PRICE_WEI);
        // And the trait was fused.
        assertEq(card.traitCount(1), 1);
        uint256[] memory ts = card.getTraits(1);
        assertEq(ts[0], 42);
    }

    function test_BuyTraitOverpaymentReverts() public {
        vm.prank(player);
        vm.expectRevert(
            abi.encodeWithSelector(TraitShop.IncorrectPayment.selector, TRAIT_PRICE_WEI + 1, TRAIT_PRICE_WEI)
        );
        shop.buyTrait{ value: TRAIT_PRICE_WEI + 1 }(1, 42);
    }

    function test_BuyTraitUnderpaymentReverts() public {
        vm.prank(player);
        vm.expectRevert(
            abi.encodeWithSelector(TraitShop.IncorrectPayment.selector, TRAIT_PRICE_WEI - 1, TRAIT_PRICE_WEI)
        );
        shop.buyTrait{ value: TRAIT_PRICE_WEI - 1 }(1, 42);
    }

    // -------------------------------------------------------------------------
    // Ownership and trait gating sanity.
    // -------------------------------------------------------------------------

    function test_BuyTraitNonOwnerReverts() public {
        vm.deal(stranger, 1 ether);
        vm.prank(stranger);
        vm.expectRevert(abi.encodeWithSelector(TraitShop.NotTokenOwner.selector, uint256(1), stranger));
        shop.buyTrait{ value: TRAIT_PRICE_WEI }(1, 42);
    }

    function test_BuyTraitUnavailableReverts() public {
        vm.prank(admin);
        shop.setTraitAvailable(42, false);
        vm.prank(player);
        vm.expectRevert(abi.encodeWithSelector(TraitShop.TraitUnavailable.selector, uint256(42)));
        shop.buyTrait{ value: TRAIT_PRICE_WEI }(1, 42);
    }

    // -------------------------------------------------------------------------
    // [Issue #3] Revenue wallet timelock — propose/accept must wait 24h.
    // -------------------------------------------------------------------------

    function test_RevenueWalletProposeAcceptHappyPath() public {
        vm.prank(admin);
        shop.proposeRevenueWallet(newRevenue);
        assertEq(shop.pendingRevenueWallet(), newRevenue);
        assertGt(shop.revenueWalletEffectiveAt(), block.timestamp);

        // Cannot accept early.
        vm.prank(admin);
        vm.expectRevert();
        shop.acceptRevenueWallet();

        vm.warp(block.timestamp + shop.REVENUE_WALLET_TIMELOCK() + 1);
        vm.prank(admin);
        shop.acceptRevenueWallet();
        assertEq(shop.revenueWallet(), newRevenue);
    }

    function test_RevenueWalletAcceptWithoutProposalReverts() public {
        vm.prank(admin);
        vm.expectRevert(TraitShop.NoPendingRevenueWallet.selector);
        shop.acceptRevenueWallet();
    }

    function test_RevenueWalletProposalCanBeCancelled() public {
        vm.prank(admin);
        shop.proposeRevenueWallet(newRevenue);
        vm.prank(admin);
        shop.cancelRevenueWalletProposal();
        assertEq(shop.pendingRevenueWallet(), address(0));
    }

    function test_RevenueWalletProposeOnlyOwner() public {
        vm.prank(stranger);
        vm.expectRevert();
        shop.proposeRevenueWallet(newRevenue);
    }
}
