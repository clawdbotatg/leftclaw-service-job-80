/**
 * Stage 4a placeholder — Stage 5 (deploy) will regenerate this file with the real
 * Base mainnet addresses. ABIs come straight from `forge build` output.
 *
 * Addresses are zero-address placeholders. `useScaffoldReadContract` /
 * `useScaffoldWriteContract` will fail gracefully in this state — pages should
 * conditionally render based on whether reads return data.
 */
import { GenericContractsDeclaration } from "~~/utils/scaffold-eth/contract";

const deployedContracts = {
  8453: {
    AnimalKingdomCard: {
      address: "0x0000000000000000000000000000000000000000",
      abi: [
        {
          type: "constructor",
          inputs: [
            {
              name: "admin",
              type: "address",
              internalType: "address",
            },
          ],
          stateMutability: "nonpayable",
        },
        {
          type: "function",
          name: "DEFAULT_ADMIN_ROLE",
          inputs: [],
          outputs: [
            {
              name: "",
              type: "bytes32",
              internalType: "bytes32",
            },
          ],
          stateMutability: "view",
        },
        {
          type: "function",
          name: "MAX_PACK_SIZE",
          inputs: [],
          outputs: [
            {
              name: "",
              type: "uint256",
              internalType: "uint256",
            },
          ],
          stateMutability: "view",
        },
        {
          type: "function",
          name: "MAX_TRAITS_PER_TOKEN",
          inputs: [],
          outputs: [
            {
              name: "",
              type: "uint256",
              internalType: "uint256",
            },
          ],
          stateMutability: "view",
        },
        {
          type: "function",
          name: "MINTER_ROLE",
          inputs: [],
          outputs: [
            {
              name: "",
              type: "bytes32",
              internalType: "bytes32",
            },
          ],
          stateMutability: "view",
        },
        {
          type: "function",
          name: "TRAIT_FUSER_ROLE",
          inputs: [],
          outputs: [
            {
              name: "",
              type: "bytes32",
              internalType: "bytes32",
            },
          ],
          stateMutability: "view",
        },
        {
          type: "function",
          name: "acceptOwnership",
          inputs: [],
          outputs: [],
          stateMutability: "nonpayable",
        },
        {
          type: "function",
          name: "approve",
          inputs: [
            {
              name: "to",
              type: "address",
              internalType: "address",
            },
            {
              name: "tokenId",
              type: "uint256",
              internalType: "uint256",
            },
          ],
          outputs: [],
          stateMutability: "nonpayable",
        },
        {
          type: "function",
          name: "balanceOf",
          inputs: [
            {
              name: "owner",
              type: "address",
              internalType: "address",
            },
          ],
          outputs: [
            {
              name: "",
              type: "uint256",
              internalType: "uint256",
            },
          ],
          stateMutability: "view",
        },
        {
          type: "function",
          name: "batchMintPack",
          inputs: [
            {
              name: "to",
              type: "address",
              internalType: "address",
            },
            {
              name: "creatures",
              type: "tuple[]",
              internalType: "struct AnimalKingdomCard.CreatureStats[]",
              components: [
                {
                  name: "creatureId",
                  type: "uint8",
                  internalType: "uint8",
                },
                {
                  name: "atk",
                  type: "uint8",
                  internalType: "uint8",
                },
                {
                  name: "def",
                  type: "uint8",
                  internalType: "uint8",
                },
                {
                  name: "chg",
                  type: "uint8",
                  internalType: "uint8",
                },
                {
                  name: "trk",
                  type: "uint8",
                  internalType: "uint8",
                },
              ],
            },
          ],
          outputs: [
            {
              name: "tokenIds",
              type: "uint256[]",
              internalType: "uint256[]",
            },
          ],
          stateMutability: "nonpayable",
        },
        {
          type: "function",
          name: "deleteDefaultRoyalty",
          inputs: [],
          outputs: [],
          stateMutability: "nonpayable",
        },
        {
          type: "function",
          name: "fuseTrait",
          inputs: [
            {
              name: "tokenId",
              type: "uint256",
              internalType: "uint256",
            },
            {
              name: "traitId",
              type: "uint256",
              internalType: "uint256",
            },
          ],
          outputs: [],
          stateMutability: "nonpayable",
        },
        {
          type: "function",
          name: "getApproved",
          inputs: [
            {
              name: "tokenId",
              type: "uint256",
              internalType: "uint256",
            },
          ],
          outputs: [
            {
              name: "",
              type: "address",
              internalType: "address",
            },
          ],
          stateMutability: "view",
        },
        {
          type: "function",
          name: "getRoleAdmin",
          inputs: [
            {
              name: "role",
              type: "bytes32",
              internalType: "bytes32",
            },
          ],
          outputs: [
            {
              name: "",
              type: "bytes32",
              internalType: "bytes32",
            },
          ],
          stateMutability: "view",
        },
        {
          type: "function",
          name: "getTraits",
          inputs: [
            {
              name: "tokenId",
              type: "uint256",
              internalType: "uint256",
            },
          ],
          outputs: [
            {
              name: "",
              type: "uint256[]",
              internalType: "uint256[]",
            },
          ],
          stateMutability: "view",
        },
        {
          type: "function",
          name: "grantRole",
          inputs: [
            {
              name: "role",
              type: "bytes32",
              internalType: "bytes32",
            },
            {
              name: "account",
              type: "address",
              internalType: "address",
            },
          ],
          outputs: [],
          stateMutability: "nonpayable",
        },
        {
          type: "function",
          name: "hasRole",
          inputs: [
            {
              name: "role",
              type: "bytes32",
              internalType: "bytes32",
            },
            {
              name: "account",
              type: "address",
              internalType: "address",
            },
          ],
          outputs: [
            {
              name: "",
              type: "bool",
              internalType: "bool",
            },
          ],
          stateMutability: "view",
        },
        {
          type: "function",
          name: "imageBaseURI",
          inputs: [],
          outputs: [
            {
              name: "",
              type: "string",
              internalType: "string",
            },
          ],
          stateMutability: "view",
        },
        {
          type: "function",
          name: "isApprovedForAll",
          inputs: [
            {
              name: "owner",
              type: "address",
              internalType: "address",
            },
            {
              name: "operator",
              type: "address",
              internalType: "address",
            },
          ],
          outputs: [
            {
              name: "",
              type: "bool",
              internalType: "bool",
            },
          ],
          stateMutability: "view",
        },
        {
          type: "function",
          name: "mintCreature",
          inputs: [
            {
              name: "to",
              type: "address",
              internalType: "address",
            },
            {
              name: "creatureId",
              type: "uint8",
              internalType: "uint8",
            },
            {
              name: "atk",
              type: "uint8",
              internalType: "uint8",
            },
            {
              name: "def",
              type: "uint8",
              internalType: "uint8",
            },
            {
              name: "chg",
              type: "uint8",
              internalType: "uint8",
            },
            {
              name: "trk",
              type: "uint8",
              internalType: "uint8",
            },
          ],
          outputs: [
            {
              name: "tokenId",
              type: "uint256",
              internalType: "uint256",
            },
          ],
          stateMutability: "nonpayable",
        },
        {
          type: "function",
          name: "name",
          inputs: [],
          outputs: [
            {
              name: "",
              type: "string",
              internalType: "string",
            },
          ],
          stateMutability: "view",
        },
        {
          type: "function",
          name: "owner",
          inputs: [],
          outputs: [
            {
              name: "",
              type: "address",
              internalType: "address",
            },
          ],
          stateMutability: "view",
        },
        {
          type: "function",
          name: "ownerOf",
          inputs: [
            {
              name: "tokenId",
              type: "uint256",
              internalType: "uint256",
            },
          ],
          outputs: [
            {
              name: "",
              type: "address",
              internalType: "address",
            },
          ],
          stateMutability: "view",
        },
        {
          type: "function",
          name: "pendingOwner",
          inputs: [],
          outputs: [
            {
              name: "",
              type: "address",
              internalType: "address",
            },
          ],
          stateMutability: "view",
        },
        {
          type: "function",
          name: "renounceOwnership",
          inputs: [],
          outputs: [],
          stateMutability: "nonpayable",
        },
        {
          type: "function",
          name: "renounceRole",
          inputs: [
            {
              name: "role",
              type: "bytes32",
              internalType: "bytes32",
            },
            {
              name: "callerConfirmation",
              type: "address",
              internalType: "address",
            },
          ],
          outputs: [],
          stateMutability: "nonpayable",
        },
        {
          type: "function",
          name: "revokeRole",
          inputs: [
            {
              name: "role",
              type: "bytes32",
              internalType: "bytes32",
            },
            {
              name: "account",
              type: "address",
              internalType: "address",
            },
          ],
          outputs: [],
          stateMutability: "nonpayable",
        },
        {
          type: "function",
          name: "royaltyInfo",
          inputs: [
            {
              name: "tokenId",
              type: "uint256",
              internalType: "uint256",
            },
            {
              name: "salePrice",
              type: "uint256",
              internalType: "uint256",
            },
          ],
          outputs: [
            {
              name: "receiver",
              type: "address",
              internalType: "address",
            },
            {
              name: "amount",
              type: "uint256",
              internalType: "uint256",
            },
          ],
          stateMutability: "view",
        },
        {
          type: "function",
          name: "safeTransferFrom",
          inputs: [
            {
              name: "from",
              type: "address",
              internalType: "address",
            },
            {
              name: "to",
              type: "address",
              internalType: "address",
            },
            {
              name: "tokenId",
              type: "uint256",
              internalType: "uint256",
            },
          ],
          outputs: [],
          stateMutability: "nonpayable",
        },
        {
          type: "function",
          name: "safeTransferFrom",
          inputs: [
            {
              name: "from",
              type: "address",
              internalType: "address",
            },
            {
              name: "to",
              type: "address",
              internalType: "address",
            },
            {
              name: "tokenId",
              type: "uint256",
              internalType: "uint256",
            },
            {
              name: "data",
              type: "bytes",
              internalType: "bytes",
            },
          ],
          outputs: [],
          stateMutability: "nonpayable",
        },
        {
          type: "function",
          name: "setApprovalForAll",
          inputs: [
            {
              name: "operator",
              type: "address",
              internalType: "address",
            },
            {
              name: "approved",
              type: "bool",
              internalType: "bool",
            },
          ],
          outputs: [],
          stateMutability: "nonpayable",
        },
        {
          type: "function",
          name: "setDefaultRoyalty",
          inputs: [
            {
              name: "receiver",
              type: "address",
              internalType: "address",
            },
            {
              name: "feeBps",
              type: "uint96",
              internalType: "uint96",
            },
          ],
          outputs: [],
          stateMutability: "nonpayable",
        },
        {
          type: "function",
          name: "setImageBaseURI",
          inputs: [
            {
              name: "newBaseURI",
              type: "string",
              internalType: "string",
            },
          ],
          outputs: [],
          stateMutability: "nonpayable",
        },
        {
          type: "function",
          name: "stats",
          inputs: [
            {
              name: "",
              type: "uint256",
              internalType: "uint256",
            },
          ],
          outputs: [
            {
              name: "creatureId",
              type: "uint8",
              internalType: "uint8",
            },
            {
              name: "atk",
              type: "uint8",
              internalType: "uint8",
            },
            {
              name: "def",
              type: "uint8",
              internalType: "uint8",
            },
            {
              name: "chg",
              type: "uint8",
              internalType: "uint8",
            },
            {
              name: "trk",
              type: "uint8",
              internalType: "uint8",
            },
          ],
          stateMutability: "view",
        },
        {
          type: "function",
          name: "supportsInterface",
          inputs: [
            {
              name: "interfaceId",
              type: "bytes4",
              internalType: "bytes4",
            },
          ],
          outputs: [
            {
              name: "",
              type: "bool",
              internalType: "bool",
            },
          ],
          stateMutability: "view",
        },
        {
          type: "function",
          name: "symbol",
          inputs: [],
          outputs: [
            {
              name: "",
              type: "string",
              internalType: "string",
            },
          ],
          stateMutability: "view",
        },
        {
          type: "function",
          name: "tokenByIndex",
          inputs: [
            {
              name: "index",
              type: "uint256",
              internalType: "uint256",
            },
          ],
          outputs: [
            {
              name: "",
              type: "uint256",
              internalType: "uint256",
            },
          ],
          stateMutability: "view",
        },
        {
          type: "function",
          name: "tokenOfOwnerByIndex",
          inputs: [
            {
              name: "owner",
              type: "address",
              internalType: "address",
            },
            {
              name: "index",
              type: "uint256",
              internalType: "uint256",
            },
          ],
          outputs: [
            {
              name: "",
              type: "uint256",
              internalType: "uint256",
            },
          ],
          stateMutability: "view",
        },
        {
          type: "function",
          name: "tokenURI",
          inputs: [
            {
              name: "tokenId",
              type: "uint256",
              internalType: "uint256",
            },
          ],
          outputs: [
            {
              name: "",
              type: "string",
              internalType: "string",
            },
          ],
          stateMutability: "view",
        },
        {
          type: "function",
          name: "totalSupply",
          inputs: [],
          outputs: [
            {
              name: "",
              type: "uint256",
              internalType: "uint256",
            },
          ],
          stateMutability: "view",
        },
        {
          type: "function",
          name: "traitCount",
          inputs: [
            {
              name: "tokenId",
              type: "uint256",
              internalType: "uint256",
            },
          ],
          outputs: [
            {
              name: "",
              type: "uint256",
              internalType: "uint256",
            },
          ],
          stateMutability: "view",
        },
        {
          type: "function",
          name: "traits",
          inputs: [
            {
              name: "",
              type: "uint256",
              internalType: "uint256",
            },
            {
              name: "",
              type: "uint256",
              internalType: "uint256",
            },
          ],
          outputs: [
            {
              name: "",
              type: "uint256",
              internalType: "uint256",
            },
          ],
          stateMutability: "view",
        },
        {
          type: "function",
          name: "transferFrom",
          inputs: [
            {
              name: "from",
              type: "address",
              internalType: "address",
            },
            {
              name: "to",
              type: "address",
              internalType: "address",
            },
            {
              name: "tokenId",
              type: "uint256",
              internalType: "uint256",
            },
          ],
          outputs: [],
          stateMutability: "nonpayable",
        },
        {
          type: "function",
          name: "transferOwnership",
          inputs: [
            {
              name: "newOwner",
              type: "address",
              internalType: "address",
            },
          ],
          outputs: [],
          stateMutability: "nonpayable",
        },
        {
          type: "event",
          name: "Approval",
          inputs: [
            {
              name: "owner",
              type: "address",
              indexed: true,
              internalType: "address",
            },
            {
              name: "approved",
              type: "address",
              indexed: true,
              internalType: "address",
            },
            {
              name: "tokenId",
              type: "uint256",
              indexed: true,
              internalType: "uint256",
            },
          ],
          anonymous: false,
        },
        {
          type: "event",
          name: "ApprovalForAll",
          inputs: [
            {
              name: "owner",
              type: "address",
              indexed: true,
              internalType: "address",
            },
            {
              name: "operator",
              type: "address",
              indexed: true,
              internalType: "address",
            },
            {
              name: "approved",
              type: "bool",
              indexed: false,
              internalType: "bool",
            },
          ],
          anonymous: false,
        },
        {
          type: "event",
          name: "CreatureMinted",
          inputs: [
            {
              name: "tokenId",
              type: "uint256",
              indexed: true,
              internalType: "uint256",
            },
            {
              name: "to",
              type: "address",
              indexed: true,
              internalType: "address",
            },
            {
              name: "creatureId",
              type: "uint8",
              indexed: false,
              internalType: "uint8",
            },
            {
              name: "atk",
              type: "uint8",
              indexed: false,
              internalType: "uint8",
            },
            {
              name: "def",
              type: "uint8",
              indexed: false,
              internalType: "uint8",
            },
            {
              name: "chg",
              type: "uint8",
              indexed: false,
              internalType: "uint8",
            },
            {
              name: "trk",
              type: "uint8",
              indexed: false,
              internalType: "uint8",
            },
          ],
          anonymous: false,
        },
        {
          type: "event",
          name: "DefaultRoyaltyUpdated",
          inputs: [
            {
              name: "receiver",
              type: "address",
              indexed: false,
              internalType: "address",
            },
            {
              name: "feeBps",
              type: "uint96",
              indexed: false,
              internalType: "uint96",
            },
          ],
          anonymous: false,
        },
        {
          type: "event",
          name: "ImageBaseURIUpdated",
          inputs: [
            {
              name: "newBaseURI",
              type: "string",
              indexed: false,
              internalType: "string",
            },
          ],
          anonymous: false,
        },
        {
          type: "event",
          name: "OwnershipTransferStarted",
          inputs: [
            {
              name: "previousOwner",
              type: "address",
              indexed: true,
              internalType: "address",
            },
            {
              name: "newOwner",
              type: "address",
              indexed: true,
              internalType: "address",
            },
          ],
          anonymous: false,
        },
        {
          type: "event",
          name: "OwnershipTransferred",
          inputs: [
            {
              name: "previousOwner",
              type: "address",
              indexed: true,
              internalType: "address",
            },
            {
              name: "newOwner",
              type: "address",
              indexed: true,
              internalType: "address",
            },
          ],
          anonymous: false,
        },
        {
          type: "event",
          name: "PackOpened",
          inputs: [
            {
              name: "player",
              type: "address",
              indexed: true,
              internalType: "address",
            },
            {
              name: "tokenIds",
              type: "uint256[]",
              indexed: false,
              internalType: "uint256[]",
            },
          ],
          anonymous: false,
        },
        {
          type: "event",
          name: "RoleAdminChanged",
          inputs: [
            {
              name: "role",
              type: "bytes32",
              indexed: true,
              internalType: "bytes32",
            },
            {
              name: "previousAdminRole",
              type: "bytes32",
              indexed: true,
              internalType: "bytes32",
            },
            {
              name: "newAdminRole",
              type: "bytes32",
              indexed: true,
              internalType: "bytes32",
            },
          ],
          anonymous: false,
        },
        {
          type: "event",
          name: "RoleGranted",
          inputs: [
            {
              name: "role",
              type: "bytes32",
              indexed: true,
              internalType: "bytes32",
            },
            {
              name: "account",
              type: "address",
              indexed: true,
              internalType: "address",
            },
            {
              name: "sender",
              type: "address",
              indexed: true,
              internalType: "address",
            },
          ],
          anonymous: false,
        },
        {
          type: "event",
          name: "RoleRevoked",
          inputs: [
            {
              name: "role",
              type: "bytes32",
              indexed: true,
              internalType: "bytes32",
            },
            {
              name: "account",
              type: "address",
              indexed: true,
              internalType: "address",
            },
            {
              name: "sender",
              type: "address",
              indexed: true,
              internalType: "address",
            },
          ],
          anonymous: false,
        },
        {
          type: "event",
          name: "TraitFused",
          inputs: [
            {
              name: "tokenId",
              type: "uint256",
              indexed: true,
              internalType: "uint256",
            },
            {
              name: "traitId",
              type: "uint256",
              indexed: true,
              internalType: "uint256",
            },
          ],
          anonymous: false,
        },
        {
          type: "event",
          name: "Transfer",
          inputs: [
            {
              name: "from",
              type: "address",
              indexed: true,
              internalType: "address",
            },
            {
              name: "to",
              type: "address",
              indexed: true,
              internalType: "address",
            },
            {
              name: "tokenId",
              type: "uint256",
              indexed: true,
              internalType: "uint256",
            },
          ],
          anonymous: false,
        },
        {
          type: "error",
          name: "AccessControlBadConfirmation",
          inputs: [],
        },
        {
          type: "error",
          name: "AccessControlUnauthorizedAccount",
          inputs: [
            {
              name: "account",
              type: "address",
              internalType: "address",
            },
            {
              name: "neededRole",
              type: "bytes32",
              internalType: "bytes32",
            },
          ],
        },
        {
          type: "error",
          name: "ERC2981InvalidDefaultRoyalty",
          inputs: [
            {
              name: "numerator",
              type: "uint256",
              internalType: "uint256",
            },
            {
              name: "denominator",
              type: "uint256",
              internalType: "uint256",
            },
          ],
        },
        {
          type: "error",
          name: "ERC2981InvalidDefaultRoyaltyReceiver",
          inputs: [
            {
              name: "receiver",
              type: "address",
              internalType: "address",
            },
          ],
        },
        {
          type: "error",
          name: "ERC2981InvalidTokenRoyalty",
          inputs: [
            {
              name: "tokenId",
              type: "uint256",
              internalType: "uint256",
            },
            {
              name: "numerator",
              type: "uint256",
              internalType: "uint256",
            },
            {
              name: "denominator",
              type: "uint256",
              internalType: "uint256",
            },
          ],
        },
        {
          type: "error",
          name: "ERC2981InvalidTokenRoyaltyReceiver",
          inputs: [
            {
              name: "tokenId",
              type: "uint256",
              internalType: "uint256",
            },
            {
              name: "receiver",
              type: "address",
              internalType: "address",
            },
          ],
        },
        {
          type: "error",
          name: "ERC721EnumerableForbiddenBatchMint",
          inputs: [],
        },
        {
          type: "error",
          name: "ERC721IncorrectOwner",
          inputs: [
            {
              name: "sender",
              type: "address",
              internalType: "address",
            },
            {
              name: "tokenId",
              type: "uint256",
              internalType: "uint256",
            },
            {
              name: "owner",
              type: "address",
              internalType: "address",
            },
          ],
        },
        {
          type: "error",
          name: "ERC721InsufficientApproval",
          inputs: [
            {
              name: "operator",
              type: "address",
              internalType: "address",
            },
            {
              name: "tokenId",
              type: "uint256",
              internalType: "uint256",
            },
          ],
        },
        {
          type: "error",
          name: "ERC721InvalidApprover",
          inputs: [
            {
              name: "approver",
              type: "address",
              internalType: "address",
            },
          ],
        },
        {
          type: "error",
          name: "ERC721InvalidOperator",
          inputs: [
            {
              name: "operator",
              type: "address",
              internalType: "address",
            },
          ],
        },
        {
          type: "error",
          name: "ERC721InvalidOwner",
          inputs: [
            {
              name: "owner",
              type: "address",
              internalType: "address",
            },
          ],
        },
        {
          type: "error",
          name: "ERC721InvalidReceiver",
          inputs: [
            {
              name: "receiver",
              type: "address",
              internalType: "address",
            },
          ],
        },
        {
          type: "error",
          name: "ERC721InvalidSender",
          inputs: [
            {
              name: "sender",
              type: "address",
              internalType: "address",
            },
          ],
        },
        {
          type: "error",
          name: "ERC721NonexistentToken",
          inputs: [
            {
              name: "tokenId",
              type: "uint256",
              internalType: "uint256",
            },
          ],
        },
        {
          type: "error",
          name: "ERC721OutOfBoundsIndex",
          inputs: [
            {
              name: "owner",
              type: "address",
              internalType: "address",
            },
            {
              name: "index",
              type: "uint256",
              internalType: "uint256",
            },
          ],
        },
        {
          type: "error",
          name: "NonexistentToken",
          inputs: [
            {
              name: "tokenId",
              type: "uint256",
              internalType: "uint256",
            },
          ],
        },
        {
          type: "error",
          name: "OwnableInvalidOwner",
          inputs: [
            {
              name: "owner",
              type: "address",
              internalType: "address",
            },
          ],
        },
        {
          type: "error",
          name: "OwnableUnauthorizedAccount",
          inputs: [
            {
              name: "account",
              type: "address",
              internalType: "address",
            },
          ],
        },
        {
          type: "error",
          name: "PackSizeTooLarge",
          inputs: [
            {
              name: "requested",
              type: "uint256",
              internalType: "uint256",
            },
            {
              name: "max",
              type: "uint256",
              internalType: "uint256",
            },
          ],
        },
        {
          type: "error",
          name: "PackSizeZero",
          inputs: [],
        },
        {
          type: "error",
          name: "TraitLimitReached",
          inputs: [
            {
              name: "tokenId",
              type: "uint256",
              internalType: "uint256",
            },
            {
              name: "max",
              type: "uint256",
              internalType: "uint256",
            },
          ],
        },
        {
          type: "error",
          name: "ZeroAddressAdmin",
          inputs: [],
        },
      ],
    },
    PackShop: {
      address: "0x0000000000000000000000000000000000000000",
      abi: [
        {
          type: "constructor",
          inputs: [
            {
              name: "admin",
              type: "address",
              internalType: "address",
            },
            {
              name: "usdcToken",
              type: "address",
              internalType: "address",
            },
          ],
          stateMutability: "nonpayable",
        },
        {
          type: "function",
          name: "acceptOwnership",
          inputs: [],
          outputs: [],
          stateMutability: "nonpayable",
        },
        {
          type: "function",
          name: "addPack",
          inputs: [
            {
              name: "packType",
              type: "uint8",
              internalType: "uint8",
            },
            {
              name: "priceWei",
              type: "uint256",
              internalType: "uint256",
            },
            {
              name: "priceUsdc",
              type: "uint256",
              internalType: "uint256",
            },
            {
              name: "name",
              type: "string",
              internalType: "string",
            },
          ],
          outputs: [],
          stateMutability: "nonpayable",
        },
        {
          type: "function",
          name: "buyPack",
          inputs: [
            {
              name: "packType",
              type: "uint8",
              internalType: "uint8",
            },
          ],
          outputs: [],
          stateMutability: "payable",
        },
        {
          type: "function",
          name: "buyPackUSDC",
          inputs: [
            {
              name: "packType",
              type: "uint8",
              internalType: "uint8",
            },
          ],
          outputs: [],
          stateMutability: "nonpayable",
        },
        {
          type: "function",
          name: "buyerNonce",
          inputs: [
            {
              name: "",
              type: "address",
              internalType: "address",
            },
          ],
          outputs: [
            {
              name: "",
              type: "uint256",
              internalType: "uint256",
            },
          ],
          stateMutability: "view",
        },
        {
          type: "function",
          name: "getPack",
          inputs: [
            {
              name: "packType",
              type: "uint8",
              internalType: "uint8",
            },
          ],
          outputs: [
            {
              name: "",
              type: "tuple",
              internalType: "struct PackShop.PackType",
              components: [
                {
                  name: "priceWei",
                  type: "uint256",
                  internalType: "uint256",
                },
                {
                  name: "priceUsdc",
                  type: "uint256",
                  internalType: "uint256",
                },
                {
                  name: "active",
                  type: "bool",
                  internalType: "bool",
                },
                {
                  name: "name",
                  type: "string",
                  internalType: "string",
                },
              ],
            },
          ],
          stateMutability: "view",
        },
        {
          type: "function",
          name: "owner",
          inputs: [],
          outputs: [
            {
              name: "",
              type: "address",
              internalType: "address",
            },
          ],
          stateMutability: "view",
        },
        {
          type: "function",
          name: "packs",
          inputs: [
            {
              name: "",
              type: "uint8",
              internalType: "uint8",
            },
          ],
          outputs: [
            {
              name: "priceWei",
              type: "uint256",
              internalType: "uint256",
            },
            {
              name: "priceUsdc",
              type: "uint256",
              internalType: "uint256",
            },
            {
              name: "active",
              type: "bool",
              internalType: "bool",
            },
            {
              name: "name",
              type: "string",
              internalType: "string",
            },
          ],
          stateMutability: "view",
        },
        {
          type: "function",
          name: "pendingOwner",
          inputs: [],
          outputs: [
            {
              name: "",
              type: "address",
              internalType: "address",
            },
          ],
          stateMutability: "view",
        },
        {
          type: "function",
          name: "renounceOwnership",
          inputs: [],
          outputs: [],
          stateMutability: "nonpayable",
        },
        {
          type: "function",
          name: "revenueWallet",
          inputs: [],
          outputs: [
            {
              name: "",
              type: "address",
              internalType: "address",
            },
          ],
          stateMutability: "view",
        },
        {
          type: "function",
          name: "setPackActive",
          inputs: [
            {
              name: "packType",
              type: "uint8",
              internalType: "uint8",
            },
            {
              name: "active",
              type: "bool",
              internalType: "bool",
            },
          ],
          outputs: [],
          stateMutability: "nonpayable",
        },
        {
          type: "function",
          name: "setRevenueWallet",
          inputs: [
            {
              name: "newWallet",
              type: "address",
              internalType: "address",
            },
          ],
          outputs: [],
          stateMutability: "nonpayable",
        },
        {
          type: "function",
          name: "sweepEth",
          inputs: [],
          outputs: [],
          stateMutability: "nonpayable",
        },
        {
          type: "function",
          name: "sweepToken",
          inputs: [
            {
              name: "token",
              type: "address",
              internalType: "contract IERC20",
            },
          ],
          outputs: [],
          stateMutability: "nonpayable",
        },
        {
          type: "function",
          name: "transferOwnership",
          inputs: [
            {
              name: "newOwner",
              type: "address",
              internalType: "address",
            },
          ],
          outputs: [],
          stateMutability: "nonpayable",
        },
        {
          type: "function",
          name: "usdc",
          inputs: [],
          outputs: [
            {
              name: "",
              type: "address",
              internalType: "address",
            },
          ],
          stateMutability: "view",
        },
        {
          type: "event",
          name: "EthSwept",
          inputs: [
            {
              name: "to",
              type: "address",
              indexed: true,
              internalType: "address",
            },
            {
              name: "amount",
              type: "uint256",
              indexed: false,
              internalType: "uint256",
            },
          ],
          anonymous: false,
        },
        {
          type: "event",
          name: "OwnershipTransferStarted",
          inputs: [
            {
              name: "previousOwner",
              type: "address",
              indexed: true,
              internalType: "address",
            },
            {
              name: "newOwner",
              type: "address",
              indexed: true,
              internalType: "address",
            },
          ],
          anonymous: false,
        },
        {
          type: "event",
          name: "OwnershipTransferred",
          inputs: [
            {
              name: "previousOwner",
              type: "address",
              indexed: true,
              internalType: "address",
            },
            {
              name: "newOwner",
              type: "address",
              indexed: true,
              internalType: "address",
            },
          ],
          anonymous: false,
        },
        {
          type: "event",
          name: "PackActiveChanged",
          inputs: [
            {
              name: "packType",
              type: "uint8",
              indexed: true,
              internalType: "uint8",
            },
            {
              name: "active",
              type: "bool",
              indexed: false,
              internalType: "bool",
            },
          ],
          anonymous: false,
        },
        {
          type: "event",
          name: "PackPurchased",
          inputs: [
            {
              name: "buyer",
              type: "address",
              indexed: true,
              internalType: "address",
            },
            {
              name: "packType",
              type: "uint8",
              indexed: true,
              internalType: "uint8",
            },
            {
              name: "requestId",
              type: "bytes32",
              indexed: false,
              internalType: "bytes32",
            },
          ],
          anonymous: false,
        },
        {
          type: "event",
          name: "PackUpdated",
          inputs: [
            {
              name: "packType",
              type: "uint8",
              indexed: true,
              internalType: "uint8",
            },
            {
              name: "priceWei",
              type: "uint256",
              indexed: false,
              internalType: "uint256",
            },
            {
              name: "priceUsdc",
              type: "uint256",
              indexed: false,
              internalType: "uint256",
            },
            {
              name: "active",
              type: "bool",
              indexed: false,
              internalType: "bool",
            },
            {
              name: "name",
              type: "string",
              indexed: false,
              internalType: "string",
            },
          ],
          anonymous: false,
        },
        {
          type: "event",
          name: "RevenueWalletUpdated",
          inputs: [
            {
              name: "previous",
              type: "address",
              indexed: true,
              internalType: "address",
            },
            {
              name: "current",
              type: "address",
              indexed: true,
              internalType: "address",
            },
          ],
          anonymous: false,
        },
        {
          type: "event",
          name: "TokenSwept",
          inputs: [
            {
              name: "token",
              type: "address",
              indexed: true,
              internalType: "address",
            },
            {
              name: "to",
              type: "address",
              indexed: true,
              internalType: "address",
            },
            {
              name: "amount",
              type: "uint256",
              indexed: false,
              internalType: "uint256",
            },
          ],
          anonymous: false,
        },
        {
          type: "error",
          name: "EthForwardFailed",
          inputs: [],
        },
        {
          type: "error",
          name: "EthPurchaseDisabled",
          inputs: [
            {
              name: "packType",
              type: "uint8",
              internalType: "uint8",
            },
          ],
        },
        {
          type: "error",
          name: "InsufficientPayment",
          inputs: [
            {
              name: "sent",
              type: "uint256",
              internalType: "uint256",
            },
            {
              name: "required",
              type: "uint256",
              internalType: "uint256",
            },
          ],
        },
        {
          type: "error",
          name: "OwnableInvalidOwner",
          inputs: [
            {
              name: "owner",
              type: "address",
              internalType: "address",
            },
          ],
        },
        {
          type: "error",
          name: "OwnableUnauthorizedAccount",
          inputs: [
            {
              name: "account",
              type: "address",
              internalType: "address",
            },
          ],
        },
        {
          type: "error",
          name: "PackInactive",
          inputs: [
            {
              name: "packType",
              type: "uint8",
              internalType: "uint8",
            },
          ],
        },
        {
          type: "error",
          name: "ReentrancyGuardReentrantCall",
          inputs: [],
        },
        {
          type: "error",
          name: "RefundFailed",
          inputs: [],
        },
        {
          type: "error",
          name: "SafeERC20FailedOperation",
          inputs: [
            {
              name: "token",
              type: "address",
              internalType: "address",
            },
          ],
        },
        {
          type: "error",
          name: "SweepFailed",
          inputs: [],
        },
        {
          type: "error",
          name: "UsdcPurchaseDisabled",
          inputs: [
            {
              name: "packType",
              type: "uint8",
              internalType: "uint8",
            },
          ],
        },
        {
          type: "error",
          name: "ZeroAddress",
          inputs: [],
        },
      ],
    },
    TraitShop: {
      address: "0x0000000000000000000000000000000000000000",
      abi: [
        {
          type: "constructor",
          inputs: [
            {
              name: "admin",
              type: "address",
              internalType: "address",
            },
            {
              name: "cardAddr",
              type: "address",
              internalType: "address",
            },
          ],
          stateMutability: "nonpayable",
        },
        {
          type: "function",
          name: "acceptOwnership",
          inputs: [],
          outputs: [],
          stateMutability: "nonpayable",
        },
        {
          type: "function",
          name: "addTrait",
          inputs: [
            {
              name: "traitId",
              type: "uint256",
              internalType: "uint256",
            },
            {
              name: "priceWei",
              type: "uint256",
              internalType: "uint256",
            },
            {
              name: "metadataURI",
              type: "string",
              internalType: "string",
            },
          ],
          outputs: [],
          stateMutability: "nonpayable",
        },
        {
          type: "function",
          name: "buyTrait",
          inputs: [
            {
              name: "tokenId",
              type: "uint256",
              internalType: "uint256",
            },
            {
              name: "traitId",
              type: "uint256",
              internalType: "uint256",
            },
          ],
          outputs: [],
          stateMutability: "payable",
        },
        {
          type: "function",
          name: "card",
          inputs: [],
          outputs: [
            {
              name: "",
              type: "address",
              internalType: "address",
            },
          ],
          stateMutability: "view",
        },
        {
          type: "function",
          name: "getTrait",
          inputs: [
            {
              name: "traitId",
              type: "uint256",
              internalType: "uint256",
            },
          ],
          outputs: [
            {
              name: "",
              type: "tuple",
              internalType: "struct TraitShop.TraitInfo",
              components: [
                {
                  name: "priceWei",
                  type: "uint256",
                  internalType: "uint256",
                },
                {
                  name: "available",
                  type: "bool",
                  internalType: "bool",
                },
                {
                  name: "metadataURI",
                  type: "string",
                  internalType: "string",
                },
              ],
            },
          ],
          stateMutability: "view",
        },
        {
          type: "function",
          name: "owner",
          inputs: [],
          outputs: [
            {
              name: "",
              type: "address",
              internalType: "address",
            },
          ],
          stateMutability: "view",
        },
        {
          type: "function",
          name: "pendingOwner",
          inputs: [],
          outputs: [
            {
              name: "",
              type: "address",
              internalType: "address",
            },
          ],
          stateMutability: "view",
        },
        {
          type: "function",
          name: "renounceOwnership",
          inputs: [],
          outputs: [],
          stateMutability: "nonpayable",
        },
        {
          type: "function",
          name: "revenueWallet",
          inputs: [],
          outputs: [
            {
              name: "",
              type: "address",
              internalType: "address",
            },
          ],
          stateMutability: "view",
        },
        {
          type: "function",
          name: "setCard",
          inputs: [
            {
              name: "newCard",
              type: "address",
              internalType: "address",
            },
          ],
          outputs: [],
          stateMutability: "nonpayable",
        },
        {
          type: "function",
          name: "setRevenueWallet",
          inputs: [
            {
              name: "newWallet",
              type: "address",
              internalType: "address",
            },
          ],
          outputs: [],
          stateMutability: "nonpayable",
        },
        {
          type: "function",
          name: "setTraitAvailable",
          inputs: [
            {
              name: "traitId",
              type: "uint256",
              internalType: "uint256",
            },
            {
              name: "available",
              type: "bool",
              internalType: "bool",
            },
          ],
          outputs: [],
          stateMutability: "nonpayable",
        },
        {
          type: "function",
          name: "sweepEth",
          inputs: [],
          outputs: [],
          stateMutability: "nonpayable",
        },
        {
          type: "function",
          name: "sweepToken",
          inputs: [
            {
              name: "token",
              type: "address",
              internalType: "contract IERC20",
            },
          ],
          outputs: [],
          stateMutability: "nonpayable",
        },
        {
          type: "function",
          name: "traitCatalog",
          inputs: [
            {
              name: "",
              type: "uint256",
              internalType: "uint256",
            },
          ],
          outputs: [
            {
              name: "priceWei",
              type: "uint256",
              internalType: "uint256",
            },
            {
              name: "available",
              type: "bool",
              internalType: "bool",
            },
            {
              name: "metadataURI",
              type: "string",
              internalType: "string",
            },
          ],
          stateMutability: "view",
        },
        {
          type: "function",
          name: "transferOwnership",
          inputs: [
            {
              name: "newOwner",
              type: "address",
              internalType: "address",
            },
          ],
          outputs: [],
          stateMutability: "nonpayable",
        },
        {
          type: "event",
          name: "CardUpdated",
          inputs: [
            {
              name: "previous",
              type: "address",
              indexed: true,
              internalType: "address",
            },
            {
              name: "current",
              type: "address",
              indexed: true,
              internalType: "address",
            },
          ],
          anonymous: false,
        },
        {
          type: "event",
          name: "EthSwept",
          inputs: [
            {
              name: "to",
              type: "address",
              indexed: true,
              internalType: "address",
            },
            {
              name: "amount",
              type: "uint256",
              indexed: false,
              internalType: "uint256",
            },
          ],
          anonymous: false,
        },
        {
          type: "event",
          name: "OwnershipTransferStarted",
          inputs: [
            {
              name: "previousOwner",
              type: "address",
              indexed: true,
              internalType: "address",
            },
            {
              name: "newOwner",
              type: "address",
              indexed: true,
              internalType: "address",
            },
          ],
          anonymous: false,
        },
        {
          type: "event",
          name: "OwnershipTransferred",
          inputs: [
            {
              name: "previousOwner",
              type: "address",
              indexed: true,
              internalType: "address",
            },
            {
              name: "newOwner",
              type: "address",
              indexed: true,
              internalType: "address",
            },
          ],
          anonymous: false,
        },
        {
          type: "event",
          name: "RevenueWalletUpdated",
          inputs: [
            {
              name: "previous",
              type: "address",
              indexed: true,
              internalType: "address",
            },
            {
              name: "current",
              type: "address",
              indexed: true,
              internalType: "address",
            },
          ],
          anonymous: false,
        },
        {
          type: "event",
          name: "TokenSwept",
          inputs: [
            {
              name: "token",
              type: "address",
              indexed: true,
              internalType: "address",
            },
            {
              name: "to",
              type: "address",
              indexed: true,
              internalType: "address",
            },
            {
              name: "amount",
              type: "uint256",
              indexed: false,
              internalType: "uint256",
            },
          ],
          anonymous: false,
        },
        {
          type: "event",
          name: "TraitAdded",
          inputs: [
            {
              name: "traitId",
              type: "uint256",
              indexed: true,
              internalType: "uint256",
            },
            {
              name: "priceWei",
              type: "uint256",
              indexed: false,
              internalType: "uint256",
            },
            {
              name: "metadataURI",
              type: "string",
              indexed: false,
              internalType: "string",
            },
          ],
          anonymous: false,
        },
        {
          type: "event",
          name: "TraitAvailabilityChanged",
          inputs: [
            {
              name: "traitId",
              type: "uint256",
              indexed: true,
              internalType: "uint256",
            },
            {
              name: "available",
              type: "bool",
              indexed: false,
              internalType: "bool",
            },
          ],
          anonymous: false,
        },
        {
          type: "event",
          name: "TraitPurchased",
          inputs: [
            {
              name: "buyer",
              type: "address",
              indexed: true,
              internalType: "address",
            },
            {
              name: "tokenId",
              type: "uint256",
              indexed: true,
              internalType: "uint256",
            },
            {
              name: "traitId",
              type: "uint256",
              indexed: true,
              internalType: "uint256",
            },
            {
              name: "price",
              type: "uint256",
              indexed: false,
              internalType: "uint256",
            },
          ],
          anonymous: false,
        },
        {
          type: "error",
          name: "EthForwardFailed",
          inputs: [],
        },
        {
          type: "error",
          name: "InsufficientPayment",
          inputs: [
            {
              name: "sent",
              type: "uint256",
              internalType: "uint256",
            },
            {
              name: "required",
              type: "uint256",
              internalType: "uint256",
            },
          ],
        },
        {
          type: "error",
          name: "NotTokenOwner",
          inputs: [
            {
              name: "tokenId",
              type: "uint256",
              internalType: "uint256",
            },
            {
              name: "caller",
              type: "address",
              internalType: "address",
            },
          ],
        },
        {
          type: "error",
          name: "OwnableInvalidOwner",
          inputs: [
            {
              name: "owner",
              type: "address",
              internalType: "address",
            },
          ],
        },
        {
          type: "error",
          name: "OwnableUnauthorizedAccount",
          inputs: [
            {
              name: "account",
              type: "address",
              internalType: "address",
            },
          ],
        },
        {
          type: "error",
          name: "ReentrancyGuardReentrantCall",
          inputs: [],
        },
        {
          type: "error",
          name: "RefundFailed",
          inputs: [],
        },
        {
          type: "error",
          name: "SafeERC20FailedOperation",
          inputs: [
            {
              name: "token",
              type: "address",
              internalType: "address",
            },
          ],
        },
        {
          type: "error",
          name: "SweepFailed",
          inputs: [],
        },
        {
          type: "error",
          name: "TraitUnavailable",
          inputs: [
            {
              name: "traitId",
              type: "uint256",
              internalType: "uint256",
            },
          ],
        },
        {
          type: "error",
          name: "ZeroAddress",
          inputs: [],
        },
      ],
    },
  },
} as const;

export default deployedContracts satisfies GenericContractsDeclaration;
