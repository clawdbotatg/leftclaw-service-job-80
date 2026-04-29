/**
 * Trait template table — name, default ETH price, and metadata URI scaffolding.
 *
 * Indexed by the uint256 `traitId` from TraitShop.traitCatalog. Server-side
 * the table is only used for naming / progression rewards; the canonical
 * source of truth for prices is the on-chain TraitShop catalog.
 */

export type TraitTemplate = {
  id: number;
  name: string;
  /** Default price in wei. The seed script writes this into TraitShop. */
  priceWei: bigint;
  /** Metadata URI, ipfs://... or https://... */
  metadataURI: string;
};

export const TRAIT_TEMPLATES: readonly TraitTemplate[] = [
  { id: 1, name: "Crown", priceWei: 1_000_000_000_000_000n, metadataURI: "ipfs://placeholder/traits/crown.json" }, // 0.001 ETH
  { id: 2, name: "Cape", priceWei: 1_000_000_000_000_000n, metadataURI: "ipfs://placeholder/traits/cape.json" },
  { id: 3, name: "Glasses", priceWei: 500_000_000_000_000n, metadataURI: "ipfs://placeholder/traits/glasses.json" },
  { id: 4, name: "Scar", priceWei: 750_000_000_000_000n, metadataURI: "ipfs://placeholder/traits/scar.json" },
  { id: 5, name: "Halo", priceWei: 2_000_000_000_000_000n, metadataURI: "ipfs://placeholder/traits/halo.json" },
  { id: 6, name: "Wings", priceWei: 3_000_000_000_000_000n, metadataURI: "ipfs://placeholder/traits/wings.json" },
  { id: 7, name: "Tattoo", priceWei: 600_000_000_000_000n, metadataURI: "ipfs://placeholder/traits/tattoo.json" },
  { id: 8, name: "Goldfang", priceWei: 1_500_000_000_000_000n, metadataURI: "ipfs://placeholder/traits/goldfang.json" },
];

export const getTraitTemplate = (traitId: number): TraitTemplate | undefined =>
  TRAIT_TEMPLATES.find(t => t.id === traitId);
