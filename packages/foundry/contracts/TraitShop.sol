// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import { Ownable } from "@openzeppelin/contracts/access/Ownable.sol";
import { Ownable2Step } from "@openzeppelin/contracts/access/Ownable2Step.sol";
import { ReentrancyGuard } from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import { IERC721 } from "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

/**
 * @dev Minimal interface for the trait-fusion call into AnimalKingdomCard. Kept as a
 *      separate interface so TraitShop does not import the full ERC-721 implementation.
 */
interface IAnimalKingdomCardFuser {
    function fuseTrait(uint256 tokenId, uint256 traitId) external;
}

/**
 * @title TraitShop
 * @notice Sells cosmetic trait fusions for AnimalKingdomCard tokens. Buyer pays in ETH,
 *         contract verifies they own the target token, forwards funds to the revenue
 *         wallet, and calls `fuseTrait` on the card contract.
 *
 *         The bound `card` is set in the constructor and is `immutable` — there is no
 *         migration path. Fresh AnimalKingdomCard deployments require a fresh TraitShop
 *         deployment (TraitShop is small enough to redeploy cheaply on Base).
 *
 *         ETH purchases require `msg.value == priceWei` exactly. There is no refund
 *         path — buyers pass the exact price they read via `getTrait`. This eliminates
 *         the contract-wallet refund-DoS surface.
 *
 *         Revenue wallet rotation is gated by a 24-hour timelock to bound the blast
 *         radius of an admin-key compromise (`proposeRevenueWallet` /
 *         `acceptRevenueWallet`).
 *
 *         Requirement: TraitShop must hold `TRAIT_FUSER_ROLE` on the AnimalKingdomCard
 *         contract for `buyTrait` to succeed. This is granted at deploy-time as a setup
 *         step (see HANDOFF.md).
 *
 *         CEI: ownership and price are checked, the fuse call is made, then funds are
 *         forwarded. Funds do not normally accumulate here; sweep functions exist for
 *         defensive recovery.
 */
contract TraitShop is Ownable2Step, ReentrancyGuard {
    using SafeERC20 for IERC20;

    // -------------------------------------------------------------------------
    // Constants
    // -------------------------------------------------------------------------

    /// @notice Delay between proposing and accepting a new revenue wallet.
    uint256 public constant REVENUE_WALLET_TIMELOCK = 24 hours;

    // -------------------------------------------------------------------------
    // Storage
    // -------------------------------------------------------------------------

    struct TraitInfo {
        uint256 priceWei;
        bool available;
        string metadataURI;
    }

    /// @notice Trait catalog. Keyed by traitId (matches the id stored on the NFT).
    mapping(uint256 => TraitInfo) public traitCatalog;

    /// @notice The AnimalKingdomCard contract this shop fuses traits onto. Immutable —
    ///         migration requires a fresh TraitShop deployment.
    address public immutable card;

    /// @notice Address that receives sale proceeds. Mutable by owner via the timelocked
    ///         propose/accept flow.
    address public revenueWallet;

    /// @notice Pending revenue wallet awaiting acceptance.
    address public pendingRevenueWallet;

    /// @notice Earliest timestamp at which `pendingRevenueWallet` may be promoted via
    ///         `acceptRevenueWallet`. 0 means no proposal is active.
    uint256 public revenueWalletEffectiveAt;

    // -------------------------------------------------------------------------
    // Events
    // -------------------------------------------------------------------------

    event TraitPurchased(
        address indexed buyer, uint256 indexed tokenId, uint256 indexed traitId, uint256 price
    );
    event TraitAdded(uint256 indexed traitId, uint256 priceWei, string metadataURI);
    event TraitAvailabilityChanged(uint256 indexed traitId, bool available);
    event RevenueWalletProposed(address indexed proposed, uint256 effectiveAt);
    event RevenueWalletUpdated(address indexed previous, address indexed current);
    event RevenueWalletProposalCancelled(address indexed cancelled);
    event EthSwept(address indexed to, uint256 amount);
    event TokenSwept(address indexed token, address indexed to, uint256 amount);

    // -------------------------------------------------------------------------
    // Errors
    // -------------------------------------------------------------------------

    error ZeroAddress();
    error NotTokenOwner(uint256 tokenId, address caller);
    error TraitUnavailable(uint256 traitId);
    error IncorrectPayment(uint256 sent, uint256 required);
    error EthForwardFailed();
    error SweepFailed();
    error NoPendingRevenueWallet();
    error TimelockNotElapsed(uint256 currentTime, uint256 effectiveAt);

    // -------------------------------------------------------------------------
    // Constructor
    // -------------------------------------------------------------------------

    /**
     * @param admin    Owner / `job.client`. Also the initial revenue wallet.
     * @param cardAddr AnimalKingdomCard contract this shop fuses traits onto. Stored as
     *                 immutable; migration requires redeploying TraitShop.
     */
    constructor(address admin, address cardAddr) Ownable(admin) {
        if (admin == address(0) || cardAddr == address(0)) revert ZeroAddress();
        card = cardAddr;
        revenueWallet = admin;
    }

    // -------------------------------------------------------------------------
    // Admin
    // -------------------------------------------------------------------------

    /// @notice Add or replace a trait. Sets `available = true`.
    function addTrait(uint256 traitId, uint256 priceWei, string calldata metadataURI) external onlyOwner {
        traitCatalog[traitId] = TraitInfo({ priceWei: priceWei, available: true, metadataURI: metadataURI });
        emit TraitAdded(traitId, priceWei, metadataURI);
    }

    /// @notice Toggle the availability of an existing trait without changing price / metadata.
    function setTraitAvailable(uint256 traitId, bool available) external onlyOwner {
        traitCatalog[traitId].available = available;
        emit TraitAvailabilityChanged(traitId, available);
    }

    // -------------------------------------------------------------------------
    // Admin: revenue wallet (timelocked rotation)
    // -------------------------------------------------------------------------

    /// @notice Propose a new revenue wallet. Becomes effective after
    ///         `REVENUE_WALLET_TIMELOCK` has elapsed via `acceptRevenueWallet`.
    /// @dev    Calling this overwrites any prior pending proposal.
    function proposeRevenueWallet(address newWallet) external onlyOwner {
        if (newWallet == address(0)) revert ZeroAddress();
        pendingRevenueWallet = newWallet;
        revenueWalletEffectiveAt = block.timestamp + REVENUE_WALLET_TIMELOCK;
        emit RevenueWalletProposed(newWallet, revenueWalletEffectiveAt);
    }

    /// @notice Promote `pendingRevenueWallet` to `revenueWallet` after the timelock has
    ///         elapsed.
    function acceptRevenueWallet() external onlyOwner {
        address pending = pendingRevenueWallet;
        if (pending == address(0)) revert NoPendingRevenueWallet();
        if (block.timestamp < revenueWalletEffectiveAt) {
            revert TimelockNotElapsed(block.timestamp, revenueWalletEffectiveAt);
        }
        address prev = revenueWallet;
        revenueWallet = pending;
        pendingRevenueWallet = address(0);
        revenueWalletEffectiveAt = 0;
        emit RevenueWalletUpdated(prev, pending);
    }

    /// @notice Cancel a pending revenue-wallet proposal before it has been accepted.
    function cancelRevenueWalletProposal() external onlyOwner {
        address pending = pendingRevenueWallet;
        if (pending == address(0)) revert NoPendingRevenueWallet();
        pendingRevenueWallet = address(0);
        revenueWalletEffectiveAt = 0;
        emit RevenueWalletProposalCancelled(pending);
    }

    // -------------------------------------------------------------------------
    // Purchase
    // -------------------------------------------------------------------------

    /**
     * @notice Buy a trait fusion for `tokenId`. Caller must own the token and the trait
     *         must be available. Caller must send the exact `priceWei`. Forwards funds
     *         to `revenueWallet`, then calls `fuseTrait` on the card contract.
     */
    function buyTrait(uint256 tokenId, uint256 traitId) external payable nonReentrant {
        // Checks
        if (IERC721(card).ownerOf(tokenId) != msg.sender) revert NotTokenOwner(tokenId, msg.sender);

        TraitInfo memory info = traitCatalog[traitId];
        if (!info.available) revert TraitUnavailable(traitId);
        if (msg.value != info.priceWei) revert IncorrectPayment(msg.value, info.priceWei);

        // Effects
        emit TraitPurchased(msg.sender, tokenId, traitId, info.priceWei);

        // Interactions
        // 1. Fuse the trait onto the NFT (requires TraitShop to hold TRAIT_FUSER_ROLE on `card`).
        IAnimalKingdomCardFuser(card).fuseTrait(tokenId, traitId);

        // 2. Forward sale proceeds to revenue wallet. No refund path — exact payment was
        //    required above.
        if (info.priceWei > 0) {
            (bool ok,) = revenueWallet.call{ value: info.priceWei }("");
            if (!ok) revert EthForwardFailed();
        }
    }

    // -------------------------------------------------------------------------
    // Defensive sweeps
    // -------------------------------------------------------------------------

    /// @notice Send any stuck ETH to the revenue wallet.
    function sweepEth() external onlyOwner {
        uint256 bal = address(this).balance;
        (bool ok,) = revenueWallet.call{ value: bal }("");
        if (!ok) revert SweepFailed();
        emit EthSwept(revenueWallet, bal);
    }

    /// @notice Recover any ERC-20 tokens accidentally sent to the contract.
    function sweepToken(IERC20 token) external onlyOwner {
        uint256 bal = token.balanceOf(address(this));
        token.safeTransfer(revenueWallet, bal);
        emit TokenSwept(address(token), revenueWallet, bal);
    }

    // -------------------------------------------------------------------------
    // View helpers
    // -------------------------------------------------------------------------

    /// @notice Convenience getter for a trait's full info.
    function getTrait(uint256 traitId) external view returns (TraitInfo memory) {
        return traitCatalog[traitId];
    }
}
