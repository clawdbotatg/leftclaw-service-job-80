// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import { Test } from "forge-std/Test.sol";
import { AnimalKingdomCard } from "../contracts/AnimalKingdomCard.sol";
import { IAccessControl } from "@openzeppelin/contracts/access/IAccessControl.sol";
import { IERC2981 } from "@openzeppelin/contracts/interfaces/IERC2981.sol";

contract TestAnimalKingdomCard is Test {
    AnimalKingdomCard internal card;
    address internal admin = vm.addr(1);
    address internal player = vm.addr(2);
    address internal stranger = vm.addr(3);

    function setUp() public {
        card = new AnimalKingdomCard(admin);
    }

    // -------------------------------------------------------------------------
    // mintCreature
    // -------------------------------------------------------------------------

    function test_MintCreatureWritesStatsAndIncrementsId() public {
        vm.prank(admin);
        uint256 tokenId = card.mintCreature(player, 7, 5, 4, 3, 2);
        assertEq(tokenId, 1);
        assertEq(card.ownerOf(tokenId), player);

        (uint8 creatureId, uint8 atk, uint8 def, uint8 chg, uint8 trk) = card.stats(tokenId);
        assertEq(creatureId, 7);
        assertEq(atk, 5);
        assertEq(def, 4);
        assertEq(chg, 3);
        assertEq(trk, 2);

        vm.prank(admin);
        uint256 nextId = card.mintCreature(player, 1, 1, 1, 1, 1);
        assertEq(nextId, 2);
    }

    function test_MintCreatureNonMinterReverts() public {
        bytes32 minterRole = card.MINTER_ROLE();
        vm.expectRevert(
            abi.encodeWithSelector(
                IAccessControl.AccessControlUnauthorizedAccount.selector, stranger, minterRole
            )
        );
        vm.prank(stranger);
        card.mintCreature(player, 1, 1, 1, 1, 1);
    }

    // -------------------------------------------------------------------------
    // batchMintPack
    // -------------------------------------------------------------------------

    function test_BatchMintPackMintsAllAndAssignsStats() public {
        AnimalKingdomCard.CreatureStats[] memory pack = new AnimalKingdomCard.CreatureStats[](3);
        pack[0] = AnimalKingdomCard.CreatureStats(1, 10, 9, 8, 7);
        pack[1] = AnimalKingdomCard.CreatureStats(2, 20, 19, 18, 17);
        pack[2] = AnimalKingdomCard.CreatureStats(3, 30, 29, 28, 27);

        vm.prank(admin);
        uint256[] memory ids = card.batchMintPack(player, pack);
        assertEq(ids.length, 3);
        assertEq(ids[0], 1);
        assertEq(ids[1], 2);
        assertEq(ids[2], 3);

        // Spot check stats on the middle token.
        (uint8 cid, uint8 atk, uint8 def, uint8 chg, uint8 trk) = card.stats(ids[1]);
        assertEq(cid, 2);
        assertEq(atk, 20);
        assertEq(def, 19);
        assertEq(chg, 18);
        assertEq(trk, 17);

        // Owner set, supply incremented.
        assertEq(card.ownerOf(ids[2]), player);
        assertEq(card.totalSupply(), 3);
    }

    function test_BatchMintPackRejectsZero() public {
        AnimalKingdomCard.CreatureStats[] memory empty = new AnimalKingdomCard.CreatureStats[](0);
        vm.prank(admin);
        vm.expectRevert(AnimalKingdomCard.PackSizeZero.selector);
        card.batchMintPack(player, empty);
    }

    function test_BatchMintPackRejectsTooLarge() public {
        uint256 maxPack = card.MAX_PACK_SIZE();
        uint256 oversized = maxPack + 1;
        AnimalKingdomCard.CreatureStats[] memory pack = new AnimalKingdomCard.CreatureStats[](oversized);
        for (uint256 i = 0; i < oversized; i++) {
            pack[i] = AnimalKingdomCard.CreatureStats(uint8(i + 1), 1, 1, 1, 1);
        }
        vm.expectRevert(
            abi.encodeWithSelector(AnimalKingdomCard.PackSizeTooLarge.selector, oversized, maxPack)
        );
        vm.prank(admin);
        card.batchMintPack(player, pack);
    }

    // -------------------------------------------------------------------------
    // fuseTrait
    // -------------------------------------------------------------------------

    function test_FuseTraitAppendsAndEmits() public {
        vm.prank(admin);
        uint256 tokenId = card.mintCreature(player, 1, 1, 1, 1, 1);

        vm.prank(admin);
        card.fuseTrait(tokenId, 42);
        vm.prank(admin);
        card.fuseTrait(tokenId, 99);

        uint256[] memory t = card.getTraits(tokenId);
        assertEq(t.length, 2);
        assertEq(t[0], 42);
        assertEq(t[1], 99);
        assertEq(card.traitCount(tokenId), 2);
    }

    function test_FuseTraitNonFuserReverts() public {
        vm.prank(admin);
        uint256 tokenId = card.mintCreature(player, 1, 1, 1, 1, 1);

        bytes32 fuserRole = card.TRAIT_FUSER_ROLE();
        vm.expectRevert(
            abi.encodeWithSelector(
                IAccessControl.AccessControlUnauthorizedAccount.selector, stranger, fuserRole
            )
        );
        vm.prank(stranger);
        card.fuseTrait(tokenId, 1);
    }

    function test_FuseTraitNonexistentTokenReverts() public {
        vm.prank(admin);
        vm.expectRevert(abi.encodeWithSelector(AnimalKingdomCard.NonexistentToken.selector, 999));
        card.fuseTrait(999, 1);
    }

    function test_FuseTraitRespectsLimit() public {
        vm.prank(admin);
        uint256 tokenId = card.mintCreature(player, 1, 1, 1, 1, 1);

        uint256 max = card.MAX_TRAITS_PER_TOKEN();
        for (uint256 i = 0; i < max; i++) {
            vm.prank(admin);
            card.fuseTrait(tokenId, i);
        }

        vm.prank(admin);
        vm.expectRevert(abi.encodeWithSelector(AnimalKingdomCard.TraitLimitReached.selector, tokenId, max));
        card.fuseTrait(tokenId, max);
    }

    // -------------------------------------------------------------------------
    // ERC-2981 royaltyInfo
    // -------------------------------------------------------------------------

    function test_RoyaltyInfoReturnsAdminAndFivePercent() public {
        vm.prank(admin);
        uint256 tokenId = card.mintCreature(player, 1, 1, 1, 1, 1);

        (address receiver, uint256 amount) = card.royaltyInfo(tokenId, 1 ether);
        assertEq(receiver, admin);
        // 5% of 1 ether = 0.05 ether.
        assertEq(amount, 0.05 ether);

        // ERC-2981 interface support.
        assertTrue(card.supportsInterface(type(IERC2981).interfaceId));
    }

    function test_OwnerCanUpdateRoyalty() public {
        // Ownable2Step: admin (current owner) sets new royalty.
        vm.prank(admin);
        card.setDefaultRoyalty(stranger, 250); // 2.5%

        vm.prank(admin);
        uint256 tokenId = card.mintCreature(player, 1, 1, 1, 1, 1);

        (address receiver, uint256 amount) = card.royaltyInfo(tokenId, 1 ether);
        assertEq(receiver, stranger);
        assertEq(amount, 0.025 ether);
    }

    // -------------------------------------------------------------------------
    // tokenURI smoke
    // -------------------------------------------------------------------------

    function test_TokenURIReturnsNonEmptyDataURI() public {
        vm.prank(admin);
        uint256 tokenId = card.mintCreature(player, 7, 10, 9, 8, 7);
        vm.prank(admin);
        card.fuseTrait(tokenId, 5);

        string memory uri = card.tokenURI(tokenId);
        // Must be a non-trivial data URI starting with "data:application/json;base64,".
        bytes memory uriBytes = bytes(uri);
        assertGt(uriBytes.length, 100, "tokenURI suspiciously short");
        // Prefix check.
        bytes memory prefix = bytes("data:application/json;base64,");
        assertGe(uriBytes.length, prefix.length);
        for (uint256 i = 0; i < prefix.length; i++) {
            assertEq(uriBytes[i], prefix[i]);
        }
    }

    function test_TokenURINonexistentReverts() public {
        vm.expectRevert(abi.encodeWithSelector(AnimalKingdomCard.NonexistentToken.selector, 12345));
        card.tokenURI(12345);
    }

    // -------------------------------------------------------------------------
    // Admin: image base URI
    // -------------------------------------------------------------------------

    function test_AdminCanSetImageBaseURI() public {
        vm.prank(admin);
        card.setImageBaseURI("ipfs://abc/");
        assertEq(card.imageBaseURI(), "ipfs://abc/");
    }

    function test_NonOwnerCannotSetImageBaseURI() public {
        // Now gated by onlyRole(DEFAULT_ADMIN_ROLE) instead of onlyOwner.
        bytes32 adminRole = card.DEFAULT_ADMIN_ROLE();
        vm.expectRevert(
            abi.encodeWithSelector(
                IAccessControl.AccessControlUnauthorizedAccount.selector, stranger, adminRole
            )
        );
        vm.prank(stranger);
        card.setImageBaseURI("ipfs://nope/");
    }

    // -------------------------------------------------------------------------
    // [Issue #1] Royalty cap — setDefaultRoyalty must reject feeBps > MAX_ROYALTY_BPS.
    // -------------------------------------------------------------------------

    function test_SetDefaultRoyaltyAtCapSucceeds() public {
        uint96 cap = card.MAX_ROYALTY_BPS();
        // 10% should be allowed exactly (the cap is inclusive).
        vm.prank(admin);
        card.setDefaultRoyalty(stranger, cap);

        vm.prank(admin);
        uint256 tokenId = card.mintCreature(player, 1, 1, 1, 1, 1);
        (address receiver, uint256 amount) = card.royaltyInfo(tokenId, 1 ether);
        assertEq(receiver, stranger);
        assertEq(amount, 0.1 ether);
    }

    function test_SetDefaultRoyaltyAboveCapReverts() public {
        uint96 cap = card.MAX_ROYALTY_BPS();
        uint96 tooHigh = cap + 1;
        vm.prank(admin);
        vm.expectRevert(abi.encodeWithSelector(AnimalKingdomCard.RoyaltyTooHigh.selector, tooHigh, cap));
        card.setDefaultRoyalty(stranger, tooHigh);
    }

    function test_SetDefaultRoyaltyTypoFiftyPercentReverts() public {
        // The headline scenario from the audit finding: typo `5000` instead of `500`.
        // Cache the cap before the prank so reading it doesn't consume the prank.
        uint96 cap = card.MAX_ROYALTY_BPS();
        vm.expectRevert(
            abi.encodeWithSelector(AnimalKingdomCard.RoyaltyTooHigh.selector, uint96(5000), cap)
        );
        vm.prank(admin);
        card.setDefaultRoyalty(stranger, 5000);
    }

    // -------------------------------------------------------------------------
    // [Issue #4] AccessControlDefaultAdminRules — admin rotation is timelocked,
    // direct revoke of DEFAULT_ADMIN_ROLE via revokeRole is forbidden, brick-via-renounce
    // requires the same delay flow.
    // -------------------------------------------------------------------------

    function test_RevokeDefaultAdminRoleDirectlyReverts() public {
        // AccessControlDefaultAdminRules forbids using `revokeRole` to remove the admin —
        // it must go through the begin/accept default admin transfer flow.
        bytes32 adminRole = card.DEFAULT_ADMIN_ROLE();
        vm.prank(admin);
        vm.expectRevert(); // AccessControlEnforcedDefaultAdminRules
        card.revokeRole(adminRole, admin);
    }

    function test_RenounceDefaultAdminRoleWithoutScheduleReverts() public {
        // Admin cannot brick the contract by renouncing without scheduling the renounce
        // through beginDefaultAdminTransfer first.
        bytes32 adminRole = card.DEFAULT_ADMIN_ROLE();
        vm.prank(admin);
        vm.expectRevert(); // AccessControlEnforcedDefaultAdminDelay
        card.renounceRole(adminRole, admin);
    }

    function test_DefaultAdminTransferRespectsDelay() public {
        // Admin schedules a transfer to `stranger`. Cannot accept before delay elapses.
        vm.prank(admin);
        card.beginDefaultAdminTransfer(stranger);

        // Stranger tries to accept too early.
        vm.prank(stranger);
        vm.expectRevert(); // AccessControlEnforcedDefaultAdminDelay
        card.acceptDefaultAdminTransfer();

        // Warp past the delay; accept should now succeed.
        vm.warp(block.timestamp + card.ADMIN_TRANSFER_DELAY() + 1);
        vm.prank(stranger);
        card.acceptDefaultAdminTransfer();
        assertEq(card.defaultAdmin(), stranger);
        // Now stranger is the admin and admin is no longer.
        assertTrue(card.hasRole(card.DEFAULT_ADMIN_ROLE(), stranger));
        assertFalse(card.hasRole(card.DEFAULT_ADMIN_ROLE(), admin));
    }
}
