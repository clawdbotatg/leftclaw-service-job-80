/**
 * Creature template table — base stats and Trick effect per creatureId.
 *
 * Indexed by the uint8 `creatureId` from the AnimalKingdomCard contract
 * (matches the emoji map in `packages/nextjs/utils/animalKingdom.ts`).
 *
 * Trick effects fire on the side whose `activeTrickCreature` (highest-TRK on
 * the team) is the holder. Effects are server-authoritative — frontends never
 * apply them locally. Each effect receives a mutable `MatchState` plus which
 * `side` ("a" | "b") owns the trick, and the resolved actions for the turn.
 */

import type { BattleAction, MomentumCommit } from "./types.js";

export type TrickContext = {
  side: "a" | "b";
  yourAction: BattleAction;
  oppAction: BattleAction;
  yourCommit: MomentumCommit;
  oppCommit: MomentumCommit;
  /** Mutable damage numbers — adjust in-place to apply trick effects. */
  damageToYou: number;
  damageToOpp: number;
  healingToYou: number;
  healingToOpp: number;
};

export type TrickEffect = (ctx: TrickContext) => TrickContext;

export type CreatureTemplate = {
  id: number;
  name: string;
  base: { atk: number; def: number; chg: number; trk: number };
  trickName: string;
  trick: TrickEffect;
};

const passthrough: TrickEffect = ctx => ctx;

/** Trick: when defending, reflect 1 damage back to attacker. */
const reflectOnDef: TrickEffect = ctx => {
  if (ctx.yourAction === "DEF" && ctx.oppAction === "ATK" && ctx.damageToOpp >= 0) {
    ctx.damageToOpp += 1;
  }
  return ctx;
};

/** Trick: charging gives +1 momentum bonus on top of the standard +1. */
const chargeBonusMomentum: TrickEffect = ctx => {
  // Implemented as a marker — the engine reads the trick name and applies
  // the bonus directly. (Cannot mutate side.momentum from here without the
  // full state; the engine inspects the active trick name post-resolution.)
  return ctx;
};

/** Trick: attacking heals 1 HP back. */
const lifestealOnAtk: TrickEffect = ctx => {
  if (ctx.yourAction === "ATK" && ctx.damageToOpp > 0) {
    ctx.healingToYou += 1;
  }
  return ctx;
};

/** Trick: defend tick boosts your effective DEF by reducing incoming damage by 1. */
const armorOnDef: TrickEffect = ctx => {
  if (ctx.yourAction === "DEF" && ctx.damageToYou > 0) {
    ctx.damageToYou = Math.max(0, ctx.damageToYou - 1);
  }
  return ctx;
};

export const CREATURE_TEMPLATES: readonly CreatureTemplate[] = [
  {
    id: 0,
    name: "Lion",
    base: { atk: 7, def: 4, chg: 3, trk: 2 },
    trickName: "Roar",
    trick: lifestealOnAtk,
  },
  {
    id: 1,
    name: "Elephant",
    base: { atk: 4, def: 8, chg: 2, trk: 2 },
    trickName: "Stomp",
    trick: armorOnDef,
  },
  {
    id: 2,
    name: "Wolf",
    base: { atk: 6, def: 4, chg: 4, trk: 2 },
    trickName: "Howl",
    trick: chargeBonusMomentum,
  },
  {
    id: 3,
    name: "Dragon",
    base: { atk: 8, def: 5, chg: 2, trk: 5 },
    trickName: "Firebreath",
    trick: lifestealOnAtk,
  },
  {
    id: 4,
    name: "Eagle",
    base: { atk: 5, def: 3, chg: 5, trk: 3 },
    trickName: "Dive",
    trick: passthrough,
  },
  {
    id: 5,
    name: "Snake",
    base: { atk: 6, def: 3, chg: 3, trk: 4 },
    trickName: "Venom",
    trick: passthrough,
  },
  {
    id: 6,
    name: "Tiger",
    base: { atk: 7, def: 4, chg: 3, trk: 3 },
    trickName: "Pounce",
    trick: lifestealOnAtk,
  },
  {
    id: 7,
    name: "Fox",
    base: { atk: 4, def: 4, chg: 5, trk: 4 },
    trickName: "Trickster",
    trick: reflectOnDef,
  },
  {
    id: 8,
    name: "Bear",
    base: { atk: 6, def: 6, chg: 2, trk: 2 },
    trickName: "Maul",
    trick: armorOnDef,
  },
  {
    id: 9,
    name: "Deer",
    base: { atk: 3, def: 4, chg: 6, trk: 3 },
    trickName: "Sprint",
    trick: chargeBonusMomentum,
  },
  {
    id: 10,
    name: "Rhino",
    base: { atk: 7, def: 6, chg: 2, trk: 1 },
    trickName: "Charge",
    trick: armorOnDef,
  },
  {
    id: 11,
    name: "Hippo",
    base: { atk: 5, def: 7, chg: 2, trk: 2 },
    trickName: "Wallow",
    trick: armorOnDef,
  },
  {
    id: 12,
    name: "Crocodile",
    base: { atk: 6, def: 6, chg: 2, trk: 3 },
    trickName: "Deathroll",
    trick: lifestealOnAtk,
  },
  {
    id: 13,
    name: "Shark",
    base: { atk: 7, def: 4, chg: 3, trk: 3 },
    trickName: "Frenzy",
    trick: lifestealOnAtk,
  },
  {
    id: 14,
    name: "Turtle",
    base: { atk: 2, def: 9, chg: 3, trk: 2 },
    trickName: "Shell",
    trick: armorOnDef,
  },
  {
    id: 15,
    name: "Owl",
    base: { atk: 4, def: 4, chg: 4, trk: 5 },
    trickName: "Insight",
    trick: reflectOnDef,
  },
];

export const getCreatureTemplate = (creatureId: number): CreatureTemplate => {
  const t = CREATURE_TEMPLATES[creatureId % CREATURE_TEMPLATES.length];
  if (!t) throw new Error(`No creature template for id ${creatureId}`);
  return t;
};

/**
 * Roll variance applied to base stats during pack opening. Each stat shifts by
 * up to ±1 from the template base, clamped to [1, 10] (matches the on-chain
 * uint8 cap and the game-design intent of single-digit stats).
 */
export const rollStat = (base: number): number => {
  const delta = Math.floor(Math.random() * 3) - 1; // -1, 0, +1
  return Math.max(1, Math.min(10, base + delta));
};

/**
 * Pack-type to creature-count map. Mirrors the on-chain pack catalog seeded
 * by `scripts/seed-pack-pool.ts`. PackType ids are uint8.
 */
export const PACK_TYPE_TO_COUNT: Record<number, number> = {
  1: 3, // Starter — 3 creatures
  2: 5, // Standard — 5 creatures
  3: 7, // Premium — 7 creatures
  4: 10, // Legendary — 10 creatures (caps at MAX_PACK_SIZE)
};
