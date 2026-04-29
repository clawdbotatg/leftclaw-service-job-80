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
 *         Pricing safety:
 *           - `buyPack` and `buyPackUSDC` take an `expectedPrice` argument (Uniswap-style
 *             slippage param). The frontend reads the current price via `getPack` and
 *             pins it in the call; if the on-chain price has moved, the tx reverts
 *             cleanly with `PriceChanged` instead of consuming whatever price is current.
 *           - ETH purchases require `msg.value == priceWei` exactly. There is no refund
 *             path — buyers pass the exact price they read. This eliminates the
 *             contract-wallet refund-DoS surface.
 *
 *         Fund custody: ETH purchases are forwarded to `revenueWallet` immediately in
 *         the same call (CEI pattern). USDC purchases use `transferFrom` directly to
 *         `revenueWallet`. Funds therefore do not normally accumulate here. `sweepEth`
 *         and `sweepToken` exist for defensive recovery only.
 *
 *         Revenue wallet rotation is gated by a 24-hour timelock to bound the blast
 *         radius of an admin-key compromise (`proposeRevenueWallet` /
 *         `acceptRevenueWallet`).
 *
 *         Pack purchases produce a `requestId` derived from buyer, pack type, block
 *         number, and a per-buyer monotonic nonce so two purchases by the same buyer
 *         in the same block produce different ids.
 */
contract PackShop is Ownable2Step, ReentrancyGuard {
    using SafeERC20 for IERC20;

    // -------------------------------------------------------------------------
    // Constants
    // -------------------------------------------------------------------------

    /// @notice Delay between proposing and accepting a new revenue wallet.
    uint256 public constant REVENUE_WALLET_TIMELOCK = 24 hours;

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

    /// @notice Address that receives all sale proceeds. Mutable by owner via the timelocked
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

    event PackPurchased(address indexed buyer, uint8 indexed packType, bytes32 requestId);
    event PackUpdated(uint8 indexed packType, uint256 priceWei, uint256 priceUsdc, bool active, string name);
    event PackActiveChanged(uint8 indexed packType, bool active);
    event RevenueWalletProposed(address indexed proposed, uint256 effectiveAt);
    event RevenueWalletUpdated(address indexed previous, address indexed current);
    event RevenueWalletProposalCancelled(address indexed cancelled);
    event EthSwept(address indexed to, uint256 amount);
    event TokenSwept(address indexed token, address indexed to, uint256 amount);

    // -------------------------------------------------------------------------
    // Errors
    // -------------------------------------------------------------------------

    error ZeroAddress();
    error PackInactive(uint8 packType);
    error IncorrectPayment(uint256 sent, uint256 required);
    error EthPurchaseDisabled(uint8 packType);
    error UsdcPurchaseDisabled(uint8 packType);
    error PriceChanged(uint256 onchain, uint256 expected);
    error EthForwardFailed();
    error SweepFailed();
    error NoPendingRevenueWallet();
    error TimelockNotElapsed(uint256 currentTime, uint256 effectiveAt);

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
     * @notice Buy a pack with ETH. Forwards funds to `revenueWallet` immediately. Caller
     *         must send the exact price (`msg.value == priceWei`) — overpayment reverts.
     *
     * @param packType         The pack catalog id to buy.
     * @param expectedPriceWei The price the caller saw on the frontend. Must match the
     *                          on-chain `priceWei` exactly. Acts as a slippage guard
     *                          against owner price changes between read and execute.
     */
    function buyPack(uint8 packType, uint256 expectedPriceWei) external payable nonReentrant {
        PackType memory p = packs[packType];
        if (!p.active) revert PackInactive(packType);
        if (p.priceWei == 0) revert EthPurchaseDisabled(packType);
        if (p.priceWei != expectedPriceWei) revert PriceChanged(p.priceWei, expectedPriceWei);
        if (msg.value != p.priceWei) revert IncorrectPayment(msg.value, p.priceWei);

        // Effects: bump nonce + compute request id BEFORE external calls.
        uint256 nonce = ++buyerNonce[msg.sender];
        bytes32 requestId =
            keccak256(abi.encodePacked(msg.sender, packType, block.number, address(this), nonce));

        emit PackPurchased(msg.sender, packType, requestId);

        // Interactions: forward sale proceeds to revenue wallet. No refund path — exact
        // payment was required above.
        (bool ok,) = revenueWallet.call{ value: p.priceWei }("");
        if (!ok) revert EthForwardFailed();
    }

    /**
     * @notice Buy a pack with USDC. Pulls `priceUsdc` USDC from the buyer directly to
     *         `revenueWallet` via `transferFrom`. Buyer must `approve` PackShop first.
     *
     * @param packType          The pack catalog id to buy.
     * @param expectedPriceUsdc The price the caller saw on the frontend. Must match the
     *                           on-chain `priceUsdc` exactly. Acts as a slippage guard
     *                           against owner price changes between read and execute.
     */
    function buyPackUSDC(uint8 packType, uint256 expectedPriceUsdc) external nonReentrant {
        PackType memory p = packs[packType];
        if (!p.active) revert PackInactive(packType);
        if (p.priceUsdc == 0) revert UsdcPurchaseDisabled(packType);
        if (p.priceUsdc != expectedPriceUsdc) revert PriceChanged(p.priceUsdc, expectedPriceUsdc);

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
