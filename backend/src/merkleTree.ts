import * as crypto from "crypto";
import { PlayerAssignment } from "./roleAssignment";

/**
 * Hash a role assignment leaf (matches the on-chain hash_role_leaf function).
 *
 * Leaf = SHA256(player_pubkey_bytes || role_byte || alignment_byte || vrf_seed)
 */
export function hashLeaf(
  playerPubkeyBytes: Buffer,
  role: number,
  alignment: number,
  vrfSeed: Buffer
): Buffer {
  const data = Buffer.concat([
    playerPubkeyBytes,
    Buffer.from([role]),
    Buffer.from([alignment]),
    vrfSeed,
  ]);
  return crypto.createHash("sha256").update(data).digest();
}

/**
 * Combine two sibling hashes into a parent hash (sorted order, matching on-chain logic).
 */
function hashPair(left: Buffer, right: Buffer): Buffer {
  // Sort so that smaller hash comes first (matches on-chain compute_merkle_root)
  const [first, second] = left.compare(right) <= 0 ? [left, right] : [right, left];
  return crypto
    .createHash("sha256")
    .update(Buffer.concat([first, second]))
    .digest();
}

/**
 * Build a Merkle tree from leaves and return the root + proofs for each leaf.
 */
export function buildMerkleTree(leaves: Buffer[]): {
  root: Buffer;
  proofs: Buffer[][];
} {
  if (leaves.length === 0) {
    return { root: Buffer.alloc(32), proofs: [] };
  }

  if (leaves.length === 1) {
    return { root: leaves[0], proofs: [[]] };
  }

  // Pad to next power of 2 with zero-hashes
  const paddedLeaves = [...leaves];
  while (paddedLeaves.length & (paddedLeaves.length - 1)) {
    paddedLeaves.push(Buffer.alloc(32));
  }

  // Build tree bottom-up
  const layers: Buffer[][] = [paddedLeaves];
  let currentLayer = paddedLeaves;

  while (currentLayer.length > 1) {
    const nextLayer: Buffer[] = [];
    for (let i = 0; i < currentLayer.length; i += 2) {
      nextLayer.push(hashPair(currentLayer[i], currentLayer[i + 1]));
    }
    layers.push(nextLayer);
    currentLayer = nextLayer;
  }

  const root = layers[layers.length - 1][0];

  // Generate proofs for each original leaf
  const proofs: Buffer[][] = [];
  for (let leafIdx = 0; leafIdx < leaves.length; leafIdx++) {
    const proof: Buffer[] = [];
    let idx = leafIdx;

    for (let layerIdx = 0; layerIdx < layers.length - 1; layerIdx++) {
      const siblingIdx = idx % 2 === 0 ? idx + 1 : idx - 1;
      if (siblingIdx < layers[layerIdx].length) {
        proof.push(layers[layerIdx][siblingIdx]);
      }
      idx = Math.floor(idx / 2);
    }

    proofs.push(proof);
  }

  return { root, proofs };
}

/**
 * Create leaves and build a Merkle tree for a set of role assignments.
 */
export function createRolesMerkleTree(
  assignments: PlayerAssignment[],
  vrfSeed: number[]
): {
  merkleRoot: Buffer;
  proofs: Buffer[][];
  leaves: Buffer[];
} {
  const vrfSeedBuf = Buffer.from(vrfSeed);

  const leaves = assignments.map((a) => {
    // Convert base58 pubkey to 32-byte buffer
    // For simplicity, we use a SHA256 hash of the pubkey string as a stand-in
    // In production, decode the base58 to raw bytes
    const pubkeyBytes = pubkeyToBytes(a.playerPubkey);
    return hashLeaf(pubkeyBytes, a.role, a.alignment, vrfSeedBuf);
  });

  const { root, proofs } = buildMerkleTree(leaves);

  return {
    merkleRoot: root,
    proofs,
    leaves,
  };
}

/**
 * Convert a base58 Solana pubkey string to a 32-byte Buffer.
 */
function pubkeyToBytes(pubkey: string): Buffer {
  // Simple base58 decode
  const ALPHABET = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
  let num = BigInt(0);
  for (const char of pubkey) {
    const idx = ALPHABET.indexOf(char);
    if (idx === -1) throw new Error(`Invalid base58 character: ${char}`);
    num = num * BigInt(58) + BigInt(idx);
  }

  // Convert BigInt to 32-byte buffer
  const hex = num.toString(16).padStart(64, "0");
  return Buffer.from(hex, "hex");
}
