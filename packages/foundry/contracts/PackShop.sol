// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import { Ownable } from "@openzeppelin/contracts/access/Ownable.sol";
import { Ownable2Step } from "@openzeppelin/contracts/access/Ownable2Step.sol";
import { ReentrancyGuard } from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

/**
 * @title PackShop
 * @notice Sells card packs in ETH or USDC. Does NOT mint cards itself: it emits a
 *         `PackPurchased` event that an off-chain pack-opening service watches. The
 *         service rolls creatures + stats then calls `AnimalKingdomCard.batchMintPack`
 *         with its MINTER_ROLE wallet.
 *
 *         CEI / fund custody: ETH purchases are forwarded to `revenueWallet` immediately
 *         in the same call (CEI pattern). USDC purchases use `transferFrom` directly to
 *         `revenueWallet`. Funds therefore do not normally accumulate here. `sweepEth`
 *         and `sweepToken` exist for defensive recovery only.
 *
 *         Pack purchases produce a `requestId` derived from buyer, pack type, block
 *         number, and a per-buyer monotonic nonce so two purchases by the same buyer
 *         in the same block produce different ids.
 */
contract PackShop is Ownable2Step, ReentrancyGuard {
    using SafeERC20 for IERC20;

    // -------------------------------------------------------------------------
    // Storage
    // -------------------------------------------------------------------------

    struct PackType {
        uint256 priceWei; // price in native currency (wei). 0 disables ETH purchase.
        uint256 priceUsdc; // price in USDC base units (USDC has 6 decimals on Base). 0 disables USDC purchase.
        bool active;
        string name;
    }

    /// @notice Pack catalog. Indexed by a uint8 pack-type identifier.
    mapping(uint8 => PackType) public packs;

    /// @notice Per-buyer monotonic nonce used to disambiguate same-block purchases.
    mapping(address => uint256) public buyerNonce;

    /// @notice USDC token address. Set in constructor; immutable in practice for the deployment.
    address public immutable usdc;

    /// @notice Address that receives all sale proceeds. Mutable by owner.
    address public revenueWallet;

    // -------------------------------------------------------------------------
    // Events
    // -------------------------------------------------------------------------

    event PackPurchased(address indexed buyer, uint8 indexed packType, bytes32 requestId);
    event PackUpdated(uint8 indexed packType, uint256 priceWei, uint256 priceUsdc, bool active, string name);
    event PackActiveChanged(uint8 indexed packType, bool active);
    event RevenueWalletUpdated(address indexed previous, address indexed current);
    event EthSwept(address indexed to, uint256 amount);
    event TokenSwept(address indexed token, address indexed to, uint256 amount);

    // -------------------------------------------------------------------------
    // Errors
    // -------------------------------------------------------------------------

    error ZeroAddress();
    error PackInactive(uint8 packType);
    error InsufficientPayment(uint256 sent, uint256 required);
    error EthPurchaseDisabled(uint8 packType);
    error UsdcPurchaseDisabled(uint8 packType);
    error EthForwardFailed();
    error RefundFailed();
    error SweepFailed();

    // -------------------------------------------------------------------------
    // Constructor
    // -------------------------------------------------------------------------

    /**
     * @param admin          Owner / `job.client`. Receives ownership and is the initial
     *                        revenue wallet.
     * @param usdcToken      USDC contract address (Base mainnet: 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913).
     */
    constructor(address admin, address usdcToken) Ownable(admin) {
        if (admin == address(0) || usdcToken == address(0)) revert ZeroAddress();
        usdc = usdcToken;
        revenueWallet = admin;
    }

    // -------------------------------------------------------------------------
    // Admin: pack catalog
    // -------------------------------------------------------------------------

    /// @notice Add or replace a pack configuration. Activates the pack.
    function addPack(uint8 packType, uint256 priceWei, uint256 priceUsdc, string calldata name) external onlyOwner {
        packs[packType] = PackType({ priceWei: priceWei, priceUsdc: priceUsdc, active: true, name: name });
        emit PackUpdated(packType, priceWei, priceUsdc, true, name);
    }

    /// @notice Toggle the active flag on a pack without changing price / name.
    function setPackActive(uint8 packType, bool active) external onlyOwner {
        packs[packType].active = active;
        emit PackActiveChanged(packType, active);
    }

    /// @notice Update the address that receives sale proceeds.
    function setRevenueWallet(address newWallet) external onlyOwner {
        if (newWallet == address(0)) revert ZeroAddress();
        address prev = revenueWallet;
        revenueWallet = newWallet;
        emit RevenueWalletUpdated(prev, newWallet);
    }

    // -------------------------------------------------------------------------
    // Purchase
    // -------------------------------------------------------------------------

    /**
     * @notice Buy a pack with ETH. Forwards funds to `revenueWallet` immediately. Refunds
     *         any excess to the buyer.
     */
    function buyPack(uint8 packType) external payable nonReentrant {
        PackType memory p = packs[packType];
        if (!p.active) revert PackInactive(packType);
        if (p.priceWei == 0) revert EthPurchaseDisabled(packType);
        if (msg.value < p.priceWei) revert InsufficientPayment(msg.value, p.priceWei);

        // Effects: bump nonce + compute request id BEFORE external calls.
        uint256 nonce = ++buyerNonce[msg.sender];
        bytes32 requestId =
            keccak256(abi.encodePacked(msg.sender, packType, block.number, address(this), nonce));

        emit PackPurchased(msg.sender, packType, requestId);

        // Interactions: forward sale proceeds to revenue wallet.
        (bool ok,) = revenueWallet.call{ value: p.priceWei }("");
        if (!ok) revert EthForwardFailed();

        // Refund any excess.
        uint256 excess = msg.value - p.priceWei;
        if (excess > 0) {
            (bool refunded,) = msg.sender.call{ value: excess }("");
            if (!refunded) revert RefundFailed();
        }
    }

    /**
     * @notice Buy a pack with USDC. Pulls `priceUsdc` USDC from the buyer directly to
     *         `revenueWallet` via `transferFrom`. Buyer must `approve` PackShop first.
     */
    function buyPackUSDC(uint8 packType) external nonReentrant {
        PackType memory p = packs[packType];
        if (!p.active) revert PackInactive(packType);
        if (p.priceUsdc == 0) revert UsdcPurchaseDisabled(packType);

        // Effects.
        uint256 nonce = ++buyerNonce[msg.sender];
        bytes32 requestId =
            keccak256(abi.encodePacked(msg.sender, packType, block.number, address(this), nonce));

        emit PackPurchased(msg.sender, packType, requestId);

        // Interactions: pull USDC directly to the revenue wallet.
        IERC20(usdc).safeTransferFrom(msg.sender, revenueWallet, p.priceUsdc);
    }

    // -------------------------------------------------------------------------
    // Defensive sweeps
    // -------------------------------------------------------------------------

    /// @notice Send any ETH stuck in the contract to `revenueWallet`. Funds normally
    ///         forward immediately on each purchase, so a non-zero balance only happens
    ///         if a forward failed and was caught off-path, or someone forced ETH in via
    ///         selfdestruct.
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

    /// @notice Returns the full PackType struct for a given id.
    function getPack(uint8 packType) external view returns (PackType memory) {
        return packs[packType];
    }
}
