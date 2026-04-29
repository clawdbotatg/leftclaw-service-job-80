/**
 * Battle engine — server-authoritative turn loop + damage formula.
 *
 * Damage formula (single source of truth — Stage 5 audit verifies this matches):
 *
 *   Effective ATK = side.teamStats.atk + (momentumCommit === "ATK" ? momentumBonus : 0)
 *   Effective DEF = side.teamStats.def + (momentumCommit === "DEF" ? momentumBonus : 0)
 *
 *   ATK vs DEF (attacker chose ATK, defender chose DEF):
 *     netDamage = max(0, attackerATK - defenderDEF)
 *     If netDamage == 0 AND defenderDEF > attackerATK:
 *       defender heals min(25, defenderDEF - attackerATK)
 *
 *   ATK vs ATK: both deal their full ATK to the other.
 *   ATK vs CHG: attacker dealt damage as ATK vs base DEF (=0); chg side gains +1 momentum.
 *   DEF vs DEF: no damage; no momentum.
 *   DEF vs CHG: chg side gains +1 momentum; def side gains nothing.
 *   CHG vs CHG: both gain +1 momentum, no damage.
 *
 *   Trick effects fire AFTER raw damage calc, applied via the active-trick
 *   creature's `trick` callback (see creatures.ts). Tricks may mutate damage
 *   numbers OR healing. The "chargeBonusMomentum" trick is a marker; engine
 *   reads the trick name and applies +1 momentum on CHG turns.
 *
 *   CHG counter bonus (match-start, one-time): for each opponent creature
 *   whose highest base stat is CHG, your team gets +1 ATK to teamStats.atk.
 *
 * Each side starts at 100 HP, 0 momentum. Momentum is consumed when committed
 * and regained at +1 per CHG turn (+2 if active trick is chargeBonusMomentum).
 *
 * Server-authoritative: client only submits action choice. Server validates
 * the player still owns each creature in the deck (lookup in creatures_cache).
 */

import { randomUUID } from "node:crypto";

import { getCreatureTemplate } from "./creatures.js";
import { logger } from "./logger.js";
import type {
  BattleAction,
  BattleSide,
  CreatureRecord,
  MatchEndedMessage,
  MomentumCommit,
  TurnRevealMessage,
} from "./types.js";

const STARTING_HP = 100;
const TURN_SECONDS = 30;
const MOMENTUM_BONUS = 2; // +2 to the lane when momentum is committed
const MAX_HEAL_PER_TURN = 25;
const MAX_TURNS = 30;

// -------------------------------------------------------------------------
// Match state object — one per active match
// -------------------------------------------------------------------------

export type Match = {
  id: string;
  turn: number;
  a: BattleSide;
  b: BattleSide;
  startedAt: Date;
  ended: boolean;
};

// -------------------------------------------------------------------------
// Helpers — team stat aggregation + active trick selection
// -------------------------------------------------------------------------

const aggregateTeamStats = (team: CreatureRecord[]) => {
  return team.reduce(
    (s, c) => ({
      atk: s.atk + c.atk,
      def: s.def + c.def,
      chg: s.chg + c.chg,
      trk: s.trk + c.trk,
    }),
    { atk: 0, def: 0, chg: 0, trk: 0 },
  );
};

const highestTrkCreature = (team: CreatureRecord[]): CreatureRecord => {
  if (team.length === 0) throw new Error("empty team");
  return team.reduce((max, c) => (c.trk > max.trk ? c : max), team[0]!);
};

/** Highest of a creature's four base stats. */
const dominantStat = (c: { atk: number; def: number; chg: number; trk: number }): "ATK" | "DEF" | "CHG" | "TRK" => {
  const pairs: ["ATK" | "DEF" | "CHG" | "TRK", number][] = [
    ["ATK", c.atk],
    ["DEF", c.def],
    ["CHG", c.chg],
    ["TRK", c.trk],
  ];
  pairs.sort((a, b) => b[1] - a[1]);
  return pairs[0]![0];
};

/** CHG counter bonus: +1 ATK for each opponent creature whose dominant stat is CHG. */
const computeChgCounterBonus = (opponentTeam: CreatureRecord[]): number => {
  let bonus = 0;
  for (const c of opponentTeam) {
    if (dominantStat(c) === "CHG") bonus += 1;
  }
  return bonus;
};

// -------------------------------------------------------------------------
// Match construction
// -------------------------------------------------------------------------

export type SideInit = {
  userId: string;
  isAi: boolean;
  team: CreatureRecord[];
};

export const createMatch = (a: SideInit, b: SideInit): Match => {
  const aBase = aggregateTeamStats(a.team);
  const bBase = aggregateTeamStats(b.team);

  // CHG counter bonus applied at match start.
  const aTeamStats = { ...aBase, atk: aBase.atk + computeChgCounterBonus(b.team) };
  const bTeamStats = { ...bBase, atk: bBase.atk + computeChgCounterBonus(a.team) };

  const aTrickCreature = highestTrkCreature(a.team);
  const bTrickCreature = highestTrkCreature(b.team);

  const sideA: BattleSide = {
    userId: a.userId,
    isAi: a.isAi,
    hp: STARTING_HP,
    momentum: 0,
    team: a.team,
    teamStats: aTeamStats,
    activeTrickCreature: aTrickCreature,
    pendingAction: null,
    pendingMomentum: null,
    totalDamageDealt: 0,
    totalDamageTaken: 0,
    damageByTokenId: {},
  };

  const sideB: BattleSide = {
    userId: b.userId,
    isAi: b.isAi,
    hp: STARTING_HP,
    momentum: 0,
    team: b.team,
    teamStats: bTeamStats,
    activeTrickCreature: bTrickCreature,
    pendingAction: null,
    pendingMomentum: null,
    totalDamageDealt: 0,
    totalDamageTaken: 0,
    damageByTokenId: {},
  };

  return {
    id: randomUUID(),
    turn: 1,
    a: sideA,
    b: sideB,
    startedAt: new Date(),
    ended: false,
  };
};

// -------------------------------------------------------------------------
// Turn submission
// -------------------------------------------------------------------------

export const submitAction = (
  match: Match,
  who: "a" | "b",
  action: BattleAction,
  momentumCommit: MomentumCommit,
): void => {
  const side = match[who];
  if (side.pendingAction !== null) return; // idempotent — keep first
  // Validate momentum
  if (momentumCommit && side.momentum < 1) {
    momentumCommit = null;
  }
  side.pendingAction = action;
  side.pendingMomentum = momentumCommit;
};

/** True iff both sides have committed an action. */
export const isReadyToResolve = (match: Match): boolean => {
  return match.a.pendingAction !== null && match.b.pendingAction !== null;
};

/**
 * Apply server-side timeout: any side that didn't submit defends automatically.
 */
export const autoDefendUnsubmitted = (match: Match): void => {
  if (match.a.pendingAction === null) {
    match.a.pendingAction = "DEF";
    match.a.pendingMomentum = null;
  }
  if (match.b.pendingAction === null) {
    match.b.pendingAction = "DEF";
    match.b.pendingMomentum = null;
  }
};

// -------------------------------------------------------------------------
// Damage resolution
// -------------------------------------------------------------------------

type ResolvedTurn = {
  damageToA: number;
  damageToB: number;
  healingToA: number;
  healingToB: number;
  momentumDeltaA: number;
  momentumDeltaB: number;
};

const computeRawDamage = (
  attackerAction: BattleAction,
  defenderAction: BattleAction,
  attackerEffectiveAtk: number,
  defenderEffectiveDef: number,
): { damageToDefender: number; healingToDefender: number } => {
  // ATK vs ATK — both deal full ATK to the other (handled at the call sites).
  if (attackerAction === "ATK" && defenderAction === "DEF") {
    if (defenderEffectiveDef >= attackerEffectiveAtk) {
      const heal = Math.min(MAX_HEAL_PER_TURN, defenderEffectiveDef - attackerEffectiveAtk);
      return { damageToDefender: 0, healingToDefender: heal };
    }
    return { damageToDefender: attackerEffectiveAtk - defenderEffectiveDef, healingToDefender: 0 };
  }
  if (attackerAction === "ATK" && defenderAction === "CHG") {
    // Defender is charging — they have base DEF=0 effectively against the attack.
    return { damageToDefender: attackerEffectiveAtk, healingToDefender: 0 };
  }
  return { damageToDefender: 0, healingToDefender: 0 };
};

const effectiveLane = (side: BattleSide, lane: "ATK" | "DEF" | "TRK"): number => {
  const base =
    lane === "ATK" ? side.teamStats.atk
    : lane === "DEF" ? side.teamStats.def
    : side.teamStats.trk;
  if (side.pendingMomentum === lane) {
    return base + MOMENTUM_BONUS;
  }
  return base;
};

const resolveTurn = (match: Match): ResolvedTurn => {
  const a = match.a;
  const b = match.b;

  const aAction = a.pendingAction!;
  const bAction = b.pendingAction!;

  let damageToA = 0;
  let damageToB = 0;
  let healingToA = 0;
  let healingToB = 0;
  let momentumDeltaA = 0;
  let momentumDeltaB = 0;

  // Momentum consumption — committed momentum is spent regardless of outcome.
  if (a.pendingMomentum) momentumDeltaA -= 1;
  if (b.pendingMomentum) momentumDeltaB -= 1;

  // Resolve action vs action
  if (aAction === "ATK" && bAction === "ATK") {
    // Both sides dealt full ATK to the other.
    damageToB += effectiveLane(a, "ATK");
    damageToA += effectiveLane(b, "ATK");
  } else if (aAction === "ATK") {
    const r = computeRawDamage(aAction, bAction, effectiveLane(a, "ATK"), effectiveLane(b, "DEF"));
    damageToB += r.damageToDefender;
    healingToB += r.healingToDefender;
    if (bAction === "CHG") momentumDeltaB += 1;
  } else if (bAction === "ATK") {
    const r = computeRawDamage(bAction, aAction, effectiveLane(b, "ATK"), effectiveLane(a, "DEF"));
    damageToA += r.damageToDefender;
    healingToA += r.healingToDefender;
    if (aAction === "CHG") momentumDeltaA += 1;
  } else if (aAction === "CHG" && bAction === "CHG") {
    momentumDeltaA += 1;
    momentumDeltaB += 1;
  } else if (aAction === "CHG" && bAction === "DEF") {
    momentumDeltaA += 1;
  } else if (bAction === "CHG" && aAction === "DEF") {
    momentumDeltaB += 1;
  }
  // DEF vs DEF: nothing happens.

  // Apply trick effects (active trick of each side).
  // Trick "chargeBonusMomentum" — read by name; +1 extra momentum on CHG turns.
  if (a.activeTrickCreature) {
    const tplA = getCreatureTemplate(a.activeTrickCreature.creatureId);
    if (tplA.trickName === "Howl" || tplA.trickName === "Sprint") {
      if (aAction === "CHG") momentumDeltaA += 1;
    }
    const ctxA = tplA.trick({
      side: "a",
      yourAction: aAction,
      oppAction: bAction,
      yourCommit: a.pendingMomentum,
      oppCommit: b.pendingMomentum,
      damageToYou: damageToA,
      damageToOpp: damageToB,
      healingToYou: healingToA,
      healingToOpp: healingToB,
    });
    damageToA = ctxA.damageToYou;
    damageToB = ctxA.damageToOpp;
    healingToA = ctxA.healingToYou;
    healingToB = ctxA.healingToOpp;
  }
  if (b.activeTrickCreature) {
    const tplB = getCreatureTemplate(b.activeTrickCreature.creatureId);
    if (tplB.trickName === "Howl" || tplB.trickName === "Sprint") {
      if (bAction === "CHG") momentumDeltaB += 1;
    }
    const ctxB = tplB.trick({
      side: "b",
      yourAction: bAction,
      oppAction: aAction,
      yourCommit: b.pendingMomentum,
      oppCommit: a.pendingMomentum,
      damageToYou: damageToB,
      damageToOpp: damageToA,
      healingToYou: healingToB,
      healingToOpp: healingToA,
    });
    damageToB = ctxB.damageToYou;
    damageToA = ctxB.damageToOpp;
    healingToB = ctxB.healingToYou;
    healingToA = ctxB.healingToOpp;
  }

  return {
    damageToA,
    damageToB,
    healingToA,
    healingToB,
    momentumDeltaA,
    momentumDeltaB,
  };
};

// -------------------------------------------------------------------------
// Public: resolve current turn and produce reveal messages for both sides
// -------------------------------------------------------------------------

export type ResolveOutput = {
  revealForA: TurnRevealMessage;
  revealForB: TurnRevealMessage;
  matchEnded: MatchEndedMessage | null;
};

export const resolveAndAdvance = (match: Match): ResolveOutput => {
  if (!isReadyToResolve(match)) {
    throw new Error("resolveAndAdvance called before both sides committed");
  }
  const r = resolveTurn(match);
  const a = match.a;
  const b = match.b;

  // Apply HP / momentum changes
  const newHpA = Math.max(0, Math.min(STARTING_HP + 50, a.hp - r.damageToA + r.healingToA));
  const newHpB = Math.max(0, Math.min(STARTING_HP + 50, b.hp - r.damageToB + r.healingToB));
  a.hp = newHpA;
  b.hp = newHpB;
  a.momentum = Math.max(0, a.momentum + r.momentumDeltaA);
  b.momentum = Math.max(0, b.momentum + r.momentumDeltaB);

  // Track stats
  a.totalDamageDealt += r.damageToB;
  a.totalDamageTaken += r.damageToA;
  b.totalDamageDealt += r.damageToA;
  b.totalDamageTaken += r.damageToB;

  // MVP attribution — split damage equally across team for now (no per-creature
  // resolution in the simple v1 engine).
  for (const c of a.team) {
    a.damageByTokenId[c.tokenId] = (a.damageByTokenId[c.tokenId] ?? 0) + r.damageToB / a.team.length;
  }
  for (const c of b.team) {
    b.damageByTokenId[c.tokenId] = (b.damageByTokenId[c.tokenId] ?? 0) + r.damageToA / b.team.length;
  }

  const aAction = a.pendingAction!;
  const bAction = b.pendingAction!;
  const aCommit = a.pendingMomentum;
  const bCommit = b.pendingMomentum;

  const turn = match.turn;

  const revealForA: TurnRevealMessage = {
    type: "turn_reveal",
    matchId: match.id,
    turn,
    you: {
      action: aAction,
      momentumCommit: aCommit,
      damageTaken: r.damageToA,
      healing: r.healingToA,
      hp: a.hp,
      momentum: a.momentum,
    },
    opponent: {
      action: bAction,
      momentumCommit: bCommit,
      damageDealt: r.damageToA,
      healing: r.healingToB,
      hp: b.hp,
      momentum: b.momentum,
    },
  };

  const revealForB: TurnRevealMessage = {
    type: "turn_reveal",
    matchId: match.id,
    turn,
    you: {
      action: bAction,
      momentumCommit: bCommit,
      damageTaken: r.damageToB,
      healing: r.healingToB,
      hp: b.hp,
      momentum: b.momentum,
    },
    opponent: {
      action: aAction,
      momentumCommit: aCommit,
      damageDealt: r.damageToB,
      healing: r.healingToA,
      hp: a.hp,
      momentum: a.momentum,
    },
  };

  // Reset for next turn
  a.pendingAction = null;
  a.pendingMomentum = null;
  b.pendingAction = null;
  b.pendingMomentum = null;
  match.turn += 1;

  // Check end conditions
  let matchEnded: MatchEndedMessage | null = null;
  const aDead = a.hp <= 0;
  const bDead = b.hp <= 0;
  const turnLimit = match.turn > MAX_TURNS;
  if (aDead || bDead || turnLimit) {
    match.ended = true;
    let winner: "you" | "opponent" | "draw";
    if (aDead && bDead) winner = "draw";
    else if (aDead) winner = "opponent";
    else if (bDead) winner = "you";
    else winner = a.hp > b.hp ? "you" : a.hp < b.hp ? "opponent" : "draw";

    // For each side, "you" / "opponent" is mirrored.
    const summaryA = {
      turns: match.turn - 1,
      damageDealt: a.totalDamageDealt,
      damageTaken: a.totalDamageTaken,
      mvpTokenId: pickMvp(a.damageByTokenId),
      mvpName: pickMvpName(a),
    };

    matchEnded = {
      type: "match_ended",
      matchId: match.id,
      winner,
      summary: summaryA,
    };
  }

  logger.debug({ matchId: match.id, turn, hpA: a.hp, hpB: b.hp }, "turn resolved");

  return { revealForA, revealForB, matchEnded };
};

const pickMvp = (damageByTokenId: Record<string, number>): string | undefined => {
  const entries = Object.entries(damageByTokenId);
  if (entries.length === 0) return undefined;
  entries.sort((x, y) => y[1] - x[1]);
  return entries[0]![0];
};

const pickMvpName = (side: BattleSide): string | undefined => {
  const id = pickMvp(side.damageByTokenId);
  if (!id) return undefined;
  const c = side.team.find(c => c.tokenId === id);
  if (!c) return undefined;
  const tpl = getCreatureTemplate(c.creatureId);
  return tpl.name;
};

export { TURN_SECONDS };
