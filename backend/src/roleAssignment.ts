import { PublicKey } from "@solana/web3.js";
import { MerkleTree } from "merkletreejs";
import keccak256 from "keccak256";
import crypto from "crypto";

// Role definitions
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

export interface PlayerRole {
  player: PublicKey;
  role: Role;
  alignment: Alignment;
  index: number;
}

export interface RoleAssignment {
  players: PlayerRole[];
  merkleRoot: Buffer;
  tree: MerkleTree;
}

// Role distribution for different player counts
const ROLE_DISTRIBUTION: { [count: number]: Role[] } = {
  5: [Role.Merlin, Role.Percival, Role.Servant, Role.Morgana, Role.Assassin],
  6: [Role.Merlin, Role.Percival, Role.Servant, Role.Servant, Role.Morgana, Role.Assassin],
  7: [Role.Merlin, Role.Percival, Role.Servant, Role.Servant, Role.Morgana, Role.Assassin, Role.Minion],
  8: [Role.Merlin, Role.Percival, Role.Servant, Role.Servant, Role.Servant, Role.Morgana, Role.Assassin, Role.Minion],
  9: [Role.Merlin, Role.Percival, Role.Servant, Role.Servant, Role.Servant, Role.Servant, Role.Morgana, Role.Assassin, Role.Minion],
  10: [Role.Merlin, Role.Percival, Role.Servant, Role.Servant, Role.Servant, Role.Servant, Role.Morgana, Role.Morgana, Role.Assassin, Role.Minion],
};

function getAlignment(role: Role): Alignment {
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
 * Deterministically shuffle array using Fisher-Yates with seeded random
 */
function seededShuffle<T>(array: T[], seed: Buffer): T[] {
  const result = [...array];
  let seedCopy = Buffer.from(seed);
  
  for (let i = result.length - 1; i > 0; i--) {
    // Generate random number from seed
    const hash = crypto.createHash("sha256").update(seedCopy).update(Buffer.from([i])).digest();
    const randomValue = hash.readUInt32BE(0);
    const j = randomValue % (i + 1);
    
    [result[i], result[j]] = [result[j], result[i]];
    seedCopy = hash;
  }
  
  return result;
}

/**
 * Create a leaf hash for the merkle tree
 */
export function createLeafHash(player: PublicKey, role: Role, alignment: Alignment, vrfSeed: Buffer): Buffer {
  const data = Buffer.concat([
    player.toBuffer(),
    Buffer.from([role]),
    Buffer.from([alignment]),
    vrfSeed,
  ]);
  return keccak256(data);
}

/**
 * Assign roles to players deterministically based on VRF seed
 */
export function assignRoles(
  playerPubkeys: PublicKey[],
  vrfSeed: Buffer
): RoleAssignment {
  const playerCount = playerPubkeys.length;
  
  if (playerCount < 5 || playerCount > 10) {
    throw new Error("Player count must be between 5 and 10");
  }
  
  // Get role distribution for this player count
  const roles = ROLE_DISTRIBUTION[playerCount];
  if (!roles) {
    throw new Error(`No role distribution for ${playerCount} players`);
  }
  
  // Shuffle roles deterministically
  const shuffledRoles = seededShuffle(roles, vrfSeed);
  
  // Assign roles to players
  const playerRoles: PlayerRole[] = playerPubkeys.map((pubkey, index) => ({
    player: pubkey,
    role: shuffledRoles[index],
    alignment: getAlignment(shuffledRoles[index]),
    index,
  }));
  
  // Create merkle tree
  const leaves = playerRoles.map((pr) =>
    createLeafHash(pr.player, pr.role, pr.alignment, vrfSeed)
  );
  
  const tree = new MerkleTree(leaves, keccak256, { sortPairs: true });
  const merkleRoot = tree.getRoot();
  
  return {
    players: playerRoles,
    merkleRoot,
    tree,
  };
}

/**
 * Generate merkle proof for a specific player
 */
export function generateMerkleProof(
  assignment: RoleAssignment,
  playerIndex: number,
  vrfSeed: Buffer
): Buffer[] {
  const playerRole = assignment.players[playerIndex];
  const leaf = createLeafHash(
    playerRole.player,
    playerRole.role,
    playerRole.alignment,
    vrfSeed
  );
  
  const proof = assignment.tree.getProof(leaf);
  return proof.map((p) => p.data);
}

/**
 * Get role information for a player (spectator view - god mode)
 */
export function getRoleInfo(
  assignment: RoleAssignment,
  playerPubkey: PublicKey
): PlayerRole | undefined {
  return assignment.players.find((p) => p.player.equals(playerPubkey));
}

/**
 * Get all known players for a given role
 */
export function getKnownPlayers(
  assignment: RoleAssignment,
  playerPubkey: PublicKey
): PublicKey[] {
  const player = assignment.players.find((p) => p.player.equals(playerPubkey));
  if (!player) return [];
  
  const known: PublicKey[] = [];
  
  switch (player.role) {
    case Role.Merlin:
      // Merlin sees all evil
      assignment.players.forEach((p) => {
        if (p.alignment === Alignment.Evil) {
          known.push(p.player);
        }
      });
      break;
      
    case Role.Percival:
      // Percival sees Merlin and Morgana
      assignment.players.forEach((p) => {
        if (p.role === Role.Merlin || p.role === Role.Morgana) {
          known.push(p.player);
        }
      });
      break;
      
    case Role.Morgana:
    case Role.Assassin:
    case Role.Minion:
      // Evil sees other evil
      assignment.players.forEach((p) => {
        if (p.alignment === Alignment.Evil && !p.player.equals(playerPubkey)) {
          known.push(p.player);
        }
      });
      break;
      
    default:
      // Servants see no one
      break;
  }
  
  return known;
}
