/**
 * AI opponent — simple weighted-random behavior tree.
 *
 * Rules:
 *   - If momentum is low (<2) AND HP > 30: bias toward CHG (40%), ATK (40%), DEF (20%)
 *   - If HP < 30: bias toward DEF (50%), ATK (30%), CHG (20%)
 *   - If HP < 60 and we have momentum: bias toward ATK (50%), DEF (30%), CHG (20%)
 *   - Default: ATK 45%, DEF 30%, CHG 25%
 *
 * Momentum commit fires ~40% of the time when momentum > 0.
 */

import { CREATURE_TEMPLATES } from "./creatures.js";
import type { BattleAction, BattleSide, CreatureRecord, MomentumCommit } from "./types.js";

export type AiDeckTemplate = {
  name: string;
  /** Distribution-by-archetype weights — used to roll the AI's 4 creatures. */
  archetypes: ("attacker" | "defender" | "charger" | "tricker")[];
};

export const AI_DECKS: readonly AiDeckTemplate[] = [
  { name: "Wild Hunters", archetypes: ["attacker", "attacker", "charger", "tricker"] },
  { name: "Stone Wall", archetypes: ["defender", "defender", "tricker", "attacker"] },
  { name: "Storm Surge", archetypes: ["charger", "charger", "attacker", "tricker"] },
  { name: "Mystic Pack", archetypes: ["tricker", "tricker", "attacker", "charger"] },
];

const archetypeFilters: Record<AiDeckTemplate["archetypes"][number], (c: { atk: number; def: number; chg: number; trk: number }) => number> = {
  attacker: c => c.atk,
  defender: c => c.def,
  charger: c => c.chg,
  tricker: c => c.trk,
};

export const buildAiTeam = (deck: AiDeckTemplate): CreatureRecord[] => {
  const team: CreatureRecord[] = [];
  for (let i = 0; i < deck.archetypes.length; i++) {
    const archetype = deck.archetypes[i];
    if (!archetype) continue;
    const score = archetypeFilters[archetype];
    const sorted = [...CREATURE_TEMPLATES].sort((a, b) => score(b.base) - score(a.base));
    const top = sorted[i % Math.max(1, Math.min(4, sorted.length))] ?? sorted[0];
    if (!top) continue;
    team.push({
      tokenId: `ai-${deck.name}-${i}`,
      creatureId: top.id,
      atk: top.base.atk,
      def: top.base.def,
      chg: top.base.chg,
      trk: top.base.trk,
      traits: [],
    });
  }
  return team;
};

const weightedPick = <T extends string>(weights: Record<T, number>): T => {
  const entries = Object.entries(weights) as [T, number][];
  const total = entries.reduce((s, [, w]) => s + w, 0);
  let r = Math.random() * total;
  for (const [k, w] of entries) {
    r -= w;
    if (r <= 0) return k;
  }
  return entries[0]![0];
};

export const pickAiAction = (side: BattleSide): { action: BattleAction; momentumCommit: MomentumCommit } => {
  const lowHp = side.hp < 30;
  const midHp = side.hp < 60;
  const lowMomentum = side.momentum < 2;
  const hasMomentum = side.momentum > 0;

  let weights: Record<BattleAction, number>;
  if (lowHp) weights = { ATK: 30, DEF: 50, CHG: 20 };
  else if (midHp && hasMomentum) weights = { ATK: 50, DEF: 30, CHG: 20 };
  else if (lowMomentum) weights = { ATK: 40, DEF: 20, CHG: 40 };
  else weights = { ATK: 45, DEF: 30, CHG: 25 };

  const action = weightedPick(weights);

  let momentumCommit: MomentumCommit = null;
  if (hasMomentum && Math.random() < 0.4) {
    const commitWeights: Record<NonNullable<MomentumCommit>, number> =
      action === "ATK" ? { ATK: 60, DEF: 10, TRK: 30 }
      : action === "DEF" ? { ATK: 10, DEF: 60, TRK: 30 }
      : { ATK: 30, DEF: 30, TRK: 40 };
    momentumCommit = weightedPick(commitWeights);
  }

  return { action, momentumCommit };
};
