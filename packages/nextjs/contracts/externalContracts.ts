import { GenericContractsDeclaration } from "~~/utils/scaffold-eth/contract";

/**
 * USDC on Base mainnet (`0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913`).
 *
 * The ABI here intentionally includes both the standard ERC-20 surface AND the
 * OZ-v5 custom errors (`ERC20InsufficientAllowance`, `ERC20InsufficientBalance`,
 * `ERC20InvalidSpender`, etc.) so `getParsedError` can decode them into
 * human-readable toast messages instead of raw 4-byte hex selectors. Without these
 * entries, viem cannot decode the revert data — the error message becomes useless.
 *
 * Note: the live USDC on Base is a fiat-token proxy using older OZ-style string
 * reverts as well. We include both styles defensively.
 */
const externalContracts = {
  8453: {
    USDC: {
      address: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
      abi: [
        // ---------- Reads ----------
        {
          type: "function",
          name: "name",
          stateMutability: "view",
          inputs: [],
          outputs: [{ name: "", type: "string" }],
        },
        {
          type: "function",
          name: "symbol",
          stateMutability: "view",
          inputs: [],
          outputs: [{ name: "", type: "string" }],
        },
        {
          type: "function",
          name: "decimals",
          stateMutability: "view",
          inputs: [],
          outputs: [{ name: "", type: "uint8" }],
        },
        {
          type: "function",
          name: "totalSupply",
          stateMutability: "view",
          inputs: [],
          outputs: [{ name: "", type: "uint256" }],
        },
        {
          type: "function",
          name: "balanceOf",
          stateMutability: "view",
          inputs: [{ name: "account", type: "address" }],
          outputs: [{ name: "", type: "uint256" }],
        },
        {
          type: "function",
          name: "allowance",
          stateMutability: "view",
          inputs: [
            { name: "owner", type: "address" },
            { name: "spender", type: "address" },
          ],
          outputs: [{ name: "", type: "uint256" }],
        },
        // ---------- Writes ----------
        {
          type: "function",
          name: "approve",
          stateMutability: "nonpayable",
          inputs: [
            { name: "spender", type: "address" },
            { name: "value", type: "uint256" },
          ],
          outputs: [{ name: "", type: "bool" }],
        },
        {
          type: "function",
          name: "transfer",
          stateMutability: "nonpayable",
          inputs: [
            { name: "to", type: "address" },
            { name: "value", type: "uint256" },
          ],
          outputs: [{ name: "", type: "bool" }],
        },
        {
          type: "function",
          name: "transferFrom",
          stateMutability: "nonpayable",
          inputs: [
            { name: "from", type: "address" },
            { name: "to", type: "address" },
            { name: "value", type: "uint256" },
          ],
          outputs: [{ name: "", type: "bool" }],
        },
        // ---------- Events ----------
        {
          type: "event",
          name: "Transfer",
          inputs: [
            { name: "from", type: "address", indexed: true },
            { name: "to", type: "address", indexed: true },
            { name: "value", type: "uint256", indexed: false },
          ],
          anonymous: false,
        },
        {
          type: "event",
          name: "Approval",
          inputs: [
            { name: "owner", type: "address", indexed: true },
            { name: "spender", type: "address", indexed: true },
            { name: "value", type: "uint256", indexed: false },
          ],
          anonymous: false,
        },
        // ---------- Errors (OZ v5 custom errors) ----------
        {
          type: "error",
          name: "ERC20InsufficientAllowance",
          inputs: [
            { name: "spender", type: "address" },
            { name: "allowance", type: "uint256" },
            { name: "needed", type: "uint256" },
          ],
        },
        {
          type: "error",
          name: "ERC20InsufficientBalance",
          inputs: [
            { name: "sender", type: "address" },
            { name: "balance", type: "uint256" },
            { name: "needed", type: "uint256" },
          ],
        },
        {
          type: "error",
          name: "ERC20InvalidApprover",
          inputs: [{ name: "approver", type: "address" }],
        },
        {
          type: "error",
          name: "ERC20InvalidReceiver",
          inputs: [{ name: "receiver", type: "address" }],
        },
        {
          type: "error",
          name: "ERC20InvalidSender",
          inputs: [{ name: "sender", type: "address" }],
        },
        {
          type: "error",
          name: "ERC20InvalidSpender",
          inputs: [{ name: "spender", type: "address" }],
        },
      ],
    },
  },
} as const;

export default externalContracts satisfies GenericContractsDeclaration;
