import * as crypto from "crypto";

// ==================== Enums ====================

export enum Role {
  Unknown = 0,
  Merlin = 1,
  Percival = 2,
  Servant = 3,
  Morgana = 4,
  Assassin = 5,
  Minion = 6,
}

export enum Alignment {
  Unknown = 0,
  Good = 1,
  Evil = 2,
}

// ==================== Role Distribution ====================

const ROLE_DISTRIBUTION: Record<number, Role[]> = {
  5: [Role.Merlin, Role.Percival, Role.Servant, Role.Morgana, Role.Assassin],
  6: [Role.Merlin, Role.Percival, Role.Servant, Role.Servant, Role.Morgana, Role.Assassin],
  7: [Role.Merlin, Role.Percival, Role.Servant, Role.Servant, Role.Morgana, Role.Assassin, Role.Minion],
  8: [Role.Merlin, Role.Percival, Role.Servant, Role.Servant, Role.Servant, Role.Morgana, Role.Assassin, Role.Minion],
  9: [Role.Merlin, Role.Percival, Role.Servant, Role.Servant, Role.Servant, Role.Servant, Role.Morgana, Role.Assassin, Role.Minion],
  10: [Role.Merlin, Role.Percival, Role.Servant, Role.Servant, Role.Servant, Role.Servant, Role.Morgana, Role.Assassin, Role.Minion, Role.Minion],
};

// ==================== Helpers ====================

export function getAlignment(role: Role): Alignment {
  switch (role) {
    case Role.Merlin:
    case Role.Percival:
    case Role.Servant:
      return Alignment.Good;
    case Role.Morgana:
    case Role.Assassin:
    case Role.Minion:
      return Alignment.Evil;
    default:
      return Alignment.Unknown;
  }
}

/**
 * Deterministic Fisher-Yates shuffle using a VRF seed.
 * The same seed always produces the same permutation.
 */
function seededShuffle<T>(array: T[], seed: Buffer): T[] {
  const result = [...array];
  let seedState = Buffer.from(seed);

  for (let i = result.length - 1; i > 0; i--) {
    const hash = crypto
      .createHash("sha256")
      .update(seedState)
      .update(Buffer.from([i]))
      .digest();
    const randomValue = hash.readUInt32BE(0);
    const j = randomValue % (i + 1);
    [result[i], result[j]] = [result[j], result[i]];
    seedState = hash;
  }

  return result;
}

// ==================== Public API ====================

export interface PlayerAssignment {
  playerPubkey: string;
  playerIndex: number;
  role: Role;
  alignment: Alignment;
  knownPlayers: string[];  // Pubkeys this player can see
}

/**
 * Assign roles to players deterministically from a VRF seed.
 */
export function assignRoles(
  playerPubkeys: string[],
  vrfSeed: number[]
): PlayerAssignment[] {
  const playerCount = playerPubkeys.length;
  if (playerCount < 5 || playerCount > 10) {
    throw new Error(`Invalid player count: ${playerCount}. Must be 5-10.`);
  }

  const roles = ROLE_DISTRIBUTION[playerCount];
  const seedBuffer = Buffer.from(vrfSeed);
  const shuffledRoles = seededShuffle(roles, seedBuffer);

  const assignments: PlayerAssignment[] = shuffledRoles.map((role, index) => ({
    playerPubkey: playerPubkeys[index],
    playerIndex: index,
    role,
    alignment: getAlignment(role),
    knownPlayers: [],
  }));

  // Populate known players for each role
  for (const assignment of assignments) {
    assignment.knownPlayers = determineKnownPlayers(assignment, assignments);
  }

  return assignments;
}

/**
 * Determine which other players a given player can see, based on their role.
 */
function determineKnownPlayers(
  player: PlayerAssignment,
  allPlayers: PlayerAssignment[]
): string[] {
  switch (player.role) {
    case Role.Merlin:
      // Merlin sees all evil players
      return allPlayers
        .filter((p) => p.alignment === Alignment.Evil)
        .map((p) => p.playerPubkey);

    case Role.Percival:
      // Percival sees Merlin and Morgana (but doesn't know which is which)
      return allPlayers
        .filter((p) => p.role === Role.Merlin || p.role === Role.Morgana)
        .map((p) => p.playerPubkey);

    case Role.Morgana:
    case Role.Assassin:
    case Role.Minion:
      // Evil players see other evil players
      return allPlayers
        .filter(
          (p) =>
            p.alignment === Alignment.Evil &&
            p.playerPubkey !== player.playerPubkey
        )
        .map((p) => p.playerPubkey);

    default:
      // Servants see nothing special
      return [];
  }
}
