// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import { Test } from "forge-std/Test.sol";
import { PackShop } from "../contracts/PackShop.sol";
import { ERC20 } from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/// @dev Minimal ERC-20 mock for USDC tests.
contract MockUSDC is ERC20 {
    constructor() ERC20("Mock USDC", "mUSDC") { }
    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
}

contract TestPackShop is Test {
    PackShop internal shop;
    MockUSDC internal usdc;

    address internal admin = vm.addr(1);
    address internal buyer = vm.addr(2);
    address internal newRevenue = vm.addr(3);
    address internal stranger = vm.addr(4);

    uint256 internal constant PACK_PRICE_WEI = 0.01 ether;
    uint256 internal constant PACK_PRICE_USDC = 5_000_000; // 5 USDC (6 decimals)

    function setUp() public {
        usdc = new MockUSDC();
        shop = new PackShop(admin, address(usdc));
        // Stock the buyer.
        vm.deal(buyer, 10 ether);
        usdc.mint(buyer, 1_000_000_000); // 1000 USDC
        // Catalog one pack.
        vm.prank(admin);
        shop.addPack(1, PACK_PRICE_WEI, PACK_PRICE_USDC, "Common");
    }

    // -------------------------------------------------------------------------
    // Sanity
    // -------------------------------------------------------------------------

    function test_InitialRevenueWalletIsAdmin() public view {
        assertEq(shop.revenueWallet(), admin);
    }

    function test_AddPackOnlyOwner() public {
        vm.prank(stranger);
        vm.expectRevert();
        shop.addPack(2, 1 ether, 0, "X");
    }

    // -------------------------------------------------------------------------
    // [Issue #5] Exact payment required — overpayment reverts (no refund path).
    // -------------------------------------------------------------------------

    function test_BuyPackEthExactPaymentSucceeds() public {
        uint256 adminBalanceBefore = admin.balance;
        vm.prank(buyer);
        shop.buyPack{ value: PACK_PRICE_WEI }(1, PACK_PRICE_WEI);
        assertEq(admin.balance - adminBalanceBefore, PACK_PRICE_WEI);
    }

    function test_BuyPackEthOverpaymentReverts() public {
        vm.prank(buyer);
        vm.expectRevert(
            abi.encodeWithSelector(PackShop.IncorrectPayment.selector, PACK_PRICE_WEI + 1, PACK_PRICE_WEI)
        );
        shop.buyPack{ value: PACK_PRICE_WEI + 1 }(1, PACK_PRICE_WEI);
    }

    function test_BuyPackEthUnderpaymentReverts() public {
        vm.prank(buyer);
        vm.expectRevert(
            abi.encodeWithSelector(PackShop.IncorrectPayment.selector, PACK_PRICE_WEI - 1, PACK_PRICE_WEI)
        );
        shop.buyPack{ value: PACK_PRICE_WEI - 1 }(1, PACK_PRICE_WEI);
    }

    // -------------------------------------------------------------------------
    // [Issue #6] expectedPrice — buyPack reverts on price mismatch (frontrun guard).
    // -------------------------------------------------------------------------

    function test_BuyPackPriceMismatchReverts() public {
        // Caller's expected price is stale (e.g. owner just changed it from 0.01 → 0.02).
        vm.prank(admin);
        shop.addPack(1, 0.02 ether, PACK_PRICE_USDC, "Common");

        vm.prank(buyer);
        vm.expectRevert(abi.encodeWithSelector(PackShop.PriceChanged.selector, 0.02 ether, PACK_PRICE_WEI));
        shop.buyPack{ value: PACK_PRICE_WEI }(1, PACK_PRICE_WEI);
    }

    function test_BuyPackUSDCPriceMismatchReverts() public {
        vm.prank(admin);
        shop.addPack(1, PACK_PRICE_WEI, 10_000_000, "Common"); // 10 USDC

        vm.prank(buyer);
        usdc.approve(address(shop), PACK_PRICE_USDC);
        vm.prank(buyer);
        vm.expectRevert(
            abi.encodeWithSelector(PackShop.PriceChanged.selector, 10_000_000, PACK_PRICE_USDC)
        );
        shop.buyPackUSDC(1, PACK_PRICE_USDC);
    }

    // The Uniswap-style frontrun scenario from issue #6 narrative: buyer sends a tx with
    // the price they saw, owner sandwiches to a higher price. With the slippage guard,
    // the buyer's tx reverts with PriceChanged instead of consuming the new (higher)
    // price.
    function test_FrontrunUpwardPriceCannotExtractMoreThanExpected() public {
        // Buyer reads price = 0.01 ETH and submits with that as expected.
        // Owner frontruns to 0.02 ETH.
        vm.prank(admin);
        shop.addPack(1, 0.02 ether, PACK_PRICE_USDC, "Common");

        // Buyer's tx pinned 0.01 — must revert, NOT consume 0.02.
        vm.prank(buyer);
        vm.expectRevert(abi.encodeWithSelector(PackShop.PriceChanged.selector, 0.02 ether, PACK_PRICE_WEI));
        shop.buyPack{ value: 0.02 ether }(1, PACK_PRICE_WEI);
    }

    // -------------------------------------------------------------------------
    // USDC purchase happy path (still works after the new expectedPrice arg).
    // -------------------------------------------------------------------------

    function test_BuyPackUSDCExactSucceeds() public {
        vm.prank(buyer);
        usdc.approve(address(shop), PACK_PRICE_USDC);
        uint256 adminBalBefore = usdc.balanceOf(admin);
        vm.prank(buyer);
        shop.buyPackUSDC(1, PACK_PRICE_USDC);
        assertEq(usdc.balanceOf(admin) - adminBalBefore, PACK_PRICE_USDC);
    }

    // -------------------------------------------------------------------------
    // [Issue #3] Revenue wallet timelock — propose/accept must wait 24h.
    // -------------------------------------------------------------------------

    function test_RevenueWalletProposeAcceptHappyPath() public {
        vm.prank(admin);
        shop.proposeRevenueWallet(newRevenue);
        assertEq(shop.pendingRevenueWallet(), newRevenue);
        assertGt(shop.revenueWalletEffectiveAt(), block.timestamp);

        // Cannot accept before delay.
        vm.prank(admin);
        vm.expectRevert(); // TimelockNotElapsed
        shop.acceptRevenueWallet();

        // Warp past delay.
        vm.warp(block.timestamp + shop.REVENUE_WALLET_TIMELOCK() + 1);
        vm.prank(admin);
        shop.acceptRevenueWallet();
        assertEq(shop.revenueWallet(), newRevenue);
        assertEq(shop.pendingRevenueWallet(), address(0));
        assertEq(shop.revenueWalletEffectiveAt(), 0);
    }

    function test_RevenueWalletAcceptWithoutProposalReverts() public {
        vm.prank(admin);
        vm.expectRevert(PackShop.NoPendingRevenueWallet.selector);
        shop.acceptRevenueWallet();
    }

    function test_RevenueWalletProposalCanBeCancelled() public {
        vm.prank(admin);
        shop.proposeRevenueWallet(newRevenue);

        vm.prank(admin);
        shop.cancelRevenueWalletProposal();
        assertEq(shop.pendingRevenueWallet(), address(0));
        assertEq(shop.revenueWalletEffectiveAt(), 0);

        vm.warp(block.timestamp + shop.REVENUE_WALLET_TIMELOCK() + 1);
        vm.prank(admin);
        vm.expectRevert(PackShop.NoPendingRevenueWallet.selector);
        shop.acceptRevenueWallet();
    }

    function test_RevenueWalletProposeOnlyOwner() public {
        vm.prank(stranger);
        vm.expectRevert();
        shop.proposeRevenueWallet(newRevenue);
    }

    // -------------------------------------------------------------------------
    // PackInactive sanity (regression).
    // -------------------------------------------------------------------------

    function test_BuyPackInactiveReverts() public {
        vm.prank(admin);
        shop.setPackActive(1, false);
        vm.prank(buyer);
        vm.expectRevert(abi.encodeWithSelector(PackShop.PackInactive.selector, uint8(1)));
        shop.buyPack{ value: PACK_PRICE_WEI }(1, PACK_PRICE_WEI);
    }
}
