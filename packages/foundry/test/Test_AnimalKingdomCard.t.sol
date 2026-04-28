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
        vm.prank(stranger);
        vm.expectRevert(); // OwnableUnauthorizedAccount selector — just confirm it reverts.
        card.setImageBaseURI("ipfs://nope/");
    }
}
