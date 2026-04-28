// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import { ERC721 } from "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import { ERC721Enumerable } from "@openzeppelin/contracts/token/ERC721/extensions/ERC721Enumerable.sol";
import { AccessControl } from "@openzeppelin/contracts/access/AccessControl.sol";
import { ERC2981 } from "@openzeppelin/contracts/token/common/ERC2981.sol";
import { Ownable } from "@openzeppelin/contracts/access/Ownable.sol";
import { Ownable2Step } from "@openzeppelin/contracts/access/Ownable2Step.sol";
import { Strings } from "@openzeppelin/contracts/utils/Strings.sol";
import { Base64 } from "@openzeppelin/contracts/utils/Base64.sol";
import { IERC165 } from "@openzeppelin/contracts/utils/introspection/IERC165.sol";

/**
 * @title AnimalKingdomCard
 * @notice ERC-721 NFT for the Animal Kingdom TCG. Each token represents a creature with
 *         immutable rolled stats (creatureId, atk, def, chg, trk) plus an append-only list
 *         of cosmetic traits fused over time.
 *
 *         Stats are write-once at mint. There is intentionally NO function to mutate stats
 *         after mint — this is the core onchain trust guarantee to players. Traits are
 *         append-only via `fuseTrait`; there is no remove or replace.
 *
 *         Roles:
 *           - DEFAULT_ADMIN_ROLE: rotates other roles (the project's `job.client` initially)
 *           - MINTER_ROLE: mints new creatures (server hot wallet / pack opening service)
 *           - TRAIT_FUSER_ROLE: fuses traits onto existing tokens (TraitShop and / or
 *             play-progression server)
 *
 *         Royalties: ERC-2981 with a configurable default royalty. Owner (the deployer's
 *         designated admin) can update the royalty receiver and basis points.
 */
contract AnimalKingdomCard is ERC721, ERC721Enumerable, AccessControl, ERC2981, Ownable2Step {
    using Strings for uint256;
    using Strings for uint8;

    // -------------------------------------------------------------------------
    // Roles
    // -------------------------------------------------------------------------

    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");
    bytes32 public constant TRAIT_FUSER_ROLE = keccak256("TRAIT_FUSER_ROLE");

    // -------------------------------------------------------------------------
    // Storage
    // -------------------------------------------------------------------------

    /// @notice Per-token rolled creature stats. Written once at mint, never mutated.
    struct CreatureStats {
        uint8 creatureId;
        uint8 atk;
        uint8 def;
        uint8 chg;
        uint8 trk;
    }

    /// @notice Maximum number of creatures that can be minted in a single `batchMintPack` call.
    uint256 public constant MAX_PACK_SIZE = 10;

    /// @notice Maximum number of traits that can be fused onto a single token.
    uint256 public constant MAX_TRAITS_PER_TOKEN = 32;

    /// @notice Per-token immutable creature stats.
    mapping(uint256 => CreatureStats) public stats;

    /// @notice Per-token append-only list of fused trait IDs.
    mapping(uint256 => uint256[]) public traits;

    /// @notice Base URI used to compose per-creature artwork references inside `tokenURI`.
    ///         Expected to point to an IPFS gateway path with a trailing slash, e.g.
    ///         "ipfs://<cid>/" so that `<baseURI><creatureId>.png` resolves to the image.
    string public imageBaseURI;

    /// @dev Token id counter. Starts at 1; 0 is reserved as "non-existent".
    uint256 private _nextTokenId;

    // -------------------------------------------------------------------------
    // Events
    // -------------------------------------------------------------------------

    event CreatureMinted(
        uint256 indexed tokenId,
        address indexed to,
        uint8 creatureId,
        uint8 atk,
        uint8 def,
        uint8 chg,
        uint8 trk
    );
    event TraitFused(uint256 indexed tokenId, uint256 indexed traitId);
    event PackOpened(address indexed player, uint256[] tokenIds);
    event ImageBaseURIUpdated(string newBaseURI);
    event DefaultRoyaltyUpdated(address receiver, uint96 feeBps);

    // -------------------------------------------------------------------------
    // Errors
    // -------------------------------------------------------------------------

    error PackSizeZero();
    error PackSizeTooLarge(uint256 requested, uint256 max);
    error TraitLimitReached(uint256 tokenId, uint256 max);
    error NonexistentToken(uint256 tokenId);
    error ZeroAddressAdmin();

    // -------------------------------------------------------------------------
    // Constructor
    // -------------------------------------------------------------------------

    /**
     * @param admin Address that receives DEFAULT_ADMIN_ROLE, MINTER_ROLE, TRAIT_FUSER_ROLE,
     *              and Ownable2Step ownership. This is the project's `job.client` and is
     *              expected to rotate these roles to operational hot wallets / a Safe.
     */
    constructor(address admin) ERC721("Animal Kingdom Card", "AKC") Ownable(admin) {
        if (admin == address(0)) revert ZeroAddressAdmin();
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(MINTER_ROLE, admin);
        _grantRole(TRAIT_FUSER_ROLE, admin);

        // Default royalty: 5% to admin. Owner can update via setDefaultRoyalty.
        _setDefaultRoyalty(admin, 500);

        _nextTokenId = 1;
    }

    // -------------------------------------------------------------------------
    // Minting
    // -------------------------------------------------------------------------

    /**
     * @notice Mint a single creature with permanent rolled stats.
     * @dev Restricted to MINTER_ROLE. Stats are written once and never mutated.
     */
    function mintCreature(address to, uint8 creatureId, uint8 atk, uint8 def, uint8 chg, uint8 trk)
        external
        onlyRole(MINTER_ROLE)
        returns (uint256 tokenId)
    {
        tokenId = _nextTokenId;
        unchecked {
            _nextTokenId = tokenId + 1;
        }

        // Write once. There is intentionally no setter for `stats` — see contract NatSpec.
        stats[tokenId] = CreatureStats({ creatureId: creatureId, atk: atk, def: def, chg: chg, trk: trk });

        _safeMint(to, tokenId);

        emit CreatureMinted(tokenId, to, creatureId, atk, def, chg, trk);
    }

    /**
     * @notice Mint a batch of creatures in a single call (a pack opening).
     * @dev Restricted to MINTER_ROLE. Bounded by MAX_PACK_SIZE to prevent unbounded gas.
     *      Stats are written once per token.
     */
    function batchMintPack(address to, CreatureStats[] calldata creatures)
        external
        onlyRole(MINTER_ROLE)
        returns (uint256[] memory tokenIds)
    {
        uint256 n = creatures.length;
        if (n == 0) revert PackSizeZero();
        if (n > MAX_PACK_SIZE) revert PackSizeTooLarge(n, MAX_PACK_SIZE);

        tokenIds = new uint256[](n);
        uint256 nextId = _nextTokenId;

        for (uint256 i = 0; i < n; i++) {
            uint256 tokenId = nextId + i;
            CreatureStats calldata c = creatures[i];

            stats[tokenId] = CreatureStats({
                creatureId: c.creatureId,
                atk: c.atk,
                def: c.def,
                chg: c.chg,
                trk: c.trk
            });

            tokenIds[i] = tokenId;

            _safeMint(to, tokenId);

            emit CreatureMinted(tokenId, to, c.creatureId, c.atk, c.def, c.chg, c.trk);
        }

        unchecked {
            _nextTokenId = nextId + n;
        }

        emit PackOpened(to, tokenIds);
    }

    // -------------------------------------------------------------------------
    // Trait fusion (append-only)
    // -------------------------------------------------------------------------

    /**
     * @notice Append a trait to the given token's trait list.
     * @dev Restricted to TRAIT_FUSER_ROLE. Append-only by design — there is no remove or
     *      replace path. Bounded by MAX_TRAITS_PER_TOKEN to prevent unbounded growth.
     *      Reverts if the token does not exist.
     */
    function fuseTrait(uint256 tokenId, uint256 traitId) external onlyRole(TRAIT_FUSER_ROLE) {
        if (_ownerOf(tokenId) == address(0)) revert NonexistentToken(tokenId);

        uint256 len = traits[tokenId].length;
        if (len >= MAX_TRAITS_PER_TOKEN) revert TraitLimitReached(tokenId, MAX_TRAITS_PER_TOKEN);

        traits[tokenId].push(traitId);
        emit TraitFused(tokenId, traitId);
    }

    /// @notice Number of traits fused onto a token.
    function traitCount(uint256 tokenId) external view returns (uint256) {
        return traits[tokenId].length;
    }

    /// @notice Returns the full trait array for a token (convenience getter — public mapping
    ///         accessor only returns one element at a time).
    function getTraits(uint256 tokenId) external view returns (uint256[] memory) {
        return traits[tokenId];
    }

    // -------------------------------------------------------------------------
    // Admin
    // -------------------------------------------------------------------------

    /// @notice Update the IPFS / HTTP base URI used to compose creature image URLs.
    function setImageBaseURI(string calldata newBaseURI) external onlyOwner {
        imageBaseURI = newBaseURI;
        emit ImageBaseURIUpdated(newBaseURI);
    }

    /// @notice Update the default ERC-2981 royalty.
    /// @param receiver Address that receives royalty payments.
    /// @param feeBps   Royalty fee in basis points (e.g. 500 = 5%). Capped at 10000 by ERC2981.
    function setDefaultRoyalty(address receiver, uint96 feeBps) external onlyOwner {
        _setDefaultRoyalty(receiver, feeBps);
        emit DefaultRoyaltyUpdated(receiver, feeBps);
    }

    /// @notice Remove the default royalty entirely.
    function deleteDefaultRoyalty() external onlyOwner {
        _deleteDefaultRoyalty();
        emit DefaultRoyaltyUpdated(address(0), 0);
    }

    // -------------------------------------------------------------------------
    // Metadata
    // -------------------------------------------------------------------------

    /**
     * @notice Returns a base64-encoded data URI containing onchain JSON metadata for the
     *         token: name, description, stats, fused trait IDs, and an `image` field that
     *         points at `{imageBaseURI}{creatureId}.png` if a base URI is configured.
     */
    function tokenURI(uint256 tokenId) public view override returns (string memory) {
        if (_ownerOf(tokenId) == address(0)) revert NonexistentToken(tokenId);

        bytes memory json = _buildJson(tokenId);
        return string.concat("data:application/json;base64,", Base64.encode(json));
    }

    /// @dev Builds the metadata JSON. Split out of `tokenURI` to keep the variable count per
    ///      stack-frame low enough to compile without `via-ir`.
    function _buildJson(uint256 tokenId) private view returns (bytes memory) {
        CreatureStats memory s = stats[tokenId];
        uint256[] memory t = traits[tokenId];

        bytes memory header = _headerJson(tokenId, s);
        bytes memory statsBlock = _statsJson(s);
        bytes memory tail = _tailJson(t, s);

        return abi.encodePacked(header, statsBlock, tail);
    }

    function _headerJson(uint256 tokenId, CreatureStats memory s) private view returns (bytes memory) {
        string memory image = bytes(imageBaseURI).length == 0
            ? ""
            : string.concat(imageBaseURI, uint256(s.creatureId).toString(), ".png");

        return abi.encodePacked(
            '{"name":"Animal Kingdom #',
            tokenId.toString(),
            '","description":"An Animal Kingdom TCG creature card. Stats are immutable; traits accumulate over time.","image":"',
            image,
            '","creatureId":',
            uint256(s.creatureId).toString()
        );
    }

    function _statsJson(CreatureStats memory s) private pure returns (bytes memory) {
        return abi.encodePacked(
            ',"stats":{"atk":',
            uint256(s.atk).toString(),
            ',"def":',
            uint256(s.def).toString(),
            ',"chg":',
            uint256(s.chg).toString(),
            ',"trk":',
            uint256(s.trk).toString(),
            "}"
        );
    }

    function _tailJson(uint256[] memory t, CreatureStats memory s) private pure returns (bytes memory) {
        return abi.encodePacked(
            ',"traits":',
            _traitsArrayJson(t),
            ',"attributes":',
            _attributesJson(s, t),
            "}"
        );
    }

    /// @dev Encodes the raw `traits` ID array as a JSON list of numbers, e.g. `[1,2,3]`.
    function _traitsArrayJson(uint256[] memory t) private pure returns (string memory) {
        if (t.length == 0) return "[]";
        bytes memory out = abi.encodePacked("[");
        for (uint256 i = 0; i < t.length; i++) {
            if (i > 0) out = abi.encodePacked(out, ",");
            out = abi.encodePacked(out, t[i].toString());
        }
        out = abi.encodePacked(out, "]");
        return string(out);
    }

    /// @dev Encodes the OpenSea-style `attributes` array (stats as numeric traits + each fused
    ///      trait id as a string trait).
    function _attributesJson(CreatureStats memory s, uint256[] memory t) private pure returns (string memory) {
        bytes memory head = abi.encodePacked(
            '[{"trait_type":"Creature","value":',
            uint256(s.creatureId).toString(),
            '},{"trait_type":"ATK","value":',
            uint256(s.atk).toString(),
            '},{"trait_type":"DEF","value":',
            uint256(s.def).toString(),
            '},{"trait_type":"CHG","value":',
            uint256(s.chg).toString(),
            '},{"trait_type":"TRK","value":',
            uint256(s.trk).toString(),
            "}"
        );

        bytes memory tail;
        for (uint256 i = 0; i < t.length; i++) {
            tail = abi.encodePacked(tail, ',{"trait_type":"Trait","value":"', t[i].toString(), '"}');
        }

        return string(abi.encodePacked(head, tail, "]"));
    }

    // -------------------------------------------------------------------------
    // Multiple-inheritance overrides
    // -------------------------------------------------------------------------

    function _update(address to, uint256 tokenId, address auth)
        internal
        override(ERC721, ERC721Enumerable)
        returns (address)
    {
        return super._update(to, tokenId, auth);
    }

    function _increaseBalance(address account, uint128 value) internal override(ERC721, ERC721Enumerable) {
        super._increaseBalance(account, value);
    }

    function supportsInterface(bytes4 interfaceId)
        public
        view
        override(ERC721, ERC721Enumerable, AccessControl, ERC2981)
        returns (bool)
    {
        return super.supportsInterface(interfaceId);
    }
}
