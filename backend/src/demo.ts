import { assignRoles, Role, Alignment, generateMerkleProof, createLeafHash } from "./roleAssignment";
import { PublicKey, Keypair } from "@solana/web3.js";
import crypto from "crypto";

/**
 * Local demo of the Avalon role assignment system
 * Run this to see how the three-plane architecture works
 */

console.log("=".repeat(70));
console.log("AVALON ON SOLANA - LOCAL DEMO");
console.log("=".repeat(70));
console.log();

// Step 1: Create 5 simulated players
console.log("🎮 STEP 1: Creating 5 Players");
console.log("-".repeat(70));

const players = Array.from({ length: 5 }, (_, i) => {
  const keypair = Keypair.generate();
  return {
    name: `Player ${i + 1}`,
    pubkey: keypair.publicKey,
    keypair, // Keep keypair for signing simulation
  };
});

players.forEach((p, i) => {
  console.log(`  ${i + 1}. ${p.name}: ${p.pubkey.toBase58().slice(0, 20)}...`);
});
console.log();

// Step 2: Generate VRF seed (in production, this comes from Switchboard VRF)
console.log("🎲 STEP 2: Generating VRF Seed");
console.log("-".repeat(70));
const vrfSeed = crypto.randomBytes(32);
console.log(`  VRF Seed: ${vrfSeed.toString("hex").slice(0, 40)}...`);
console.log("  (In production, this comes from Switchboard VRF oracle)");
console.log();

// Step 3: Assign roles deterministically
console.log("🎭 STEP 3: Assigning Roles (Deterministic)");
console.log("-".repeat(70));

const playerPubkeys = players.map((p) => p.pubkey);
const assignment = assignRoles(playerPubkeys, vrfSeed);

console.log("  Role Distribution:");
assignment.players.forEach((p) => {
  const roleName = Role[p.role];
  const alignmentName = Alignment[p.alignment];
  const emoji = alignmentName === "Good" ? "🟢" : "🔴";
  console.log(`    ${emoji} ${roleName.padEnd(10)} (${alignmentName})`);
});
console.log();

// Step 4: Generate Merkle Root
console.log("🌳 STEP 4: Merkle Tree Commitment");
console.log("-".repeat(70));
console.log(`  Merkle Root: ${assignment.merkleRoot.toString("hex")}`);
console.log("  (This root is posted on-chain for verification)");
console.log();

// Step 5: Simulate each player fetching their role
console.log("📬 STEP 5: Role Inbox - Each Player Fetches Their Role");
console.log("-".repeat(70));

assignment.players.forEach((playerRole, index) => {
  const player = players[index];
  const roleInfo = {
    player: player.pubkey.toBase58(),
    role: Role[playerRole.role],
    alignment: Alignment[playerRole.alignment],
  };

  // Generate merkle proof
  const merkleProof = generateMerkleProof(assignment, index, vrfSeed);

  console.log(`\n  ${player.name} (${player.pubkey.toBase58().slice(0, 20)}...)`);
  console.log(`    Role: ${roleInfo.role} (${roleInfo.alignment})`);
  console.log(`    Merkle Proof: ${merkleProof.length} hashes`);
  console.log(`    Can prove role without revealing others: ✅`);
});
console.log();

// Step 6: Spectator God View
console.log("👁️  STEP 6: Spectator God View (All Roles Visible)");
console.log("-".repeat(70));
console.log("  (This view is available to spectators with auth token)");
console.log();

console.log("  Player          | Role      | Alignment | Public Key");
console.log("  " + "-".repeat(66));
assignment.players.forEach((p, i) => {
  const name = players[i].name.padEnd(15);
  const role = Role[p.role].padEnd(9);
  const align = Alignment[p.alignment].padEnd(9);
  const pk = p.player.toBase58().slice(0, 20) + "...";
  console.log(`  ${name}| ${role}| ${align}| ${pk}`);
});
console.log();

// Step 7: Game Flow Simulation
console.log("🎮 STEP 7: Simulated Game Flow");
console.log("-".repeat(70));

const gamePhases = [
  "Lobby: Players joining...",
  "RoleAssignment: Roles assigned via Merkle tree",
  "TeamBuilding: Leader proposes a team",
  "Voting: Players vote on the team",
  "Quest: Selected players vote on quest success/failure",
  "TeamBuilding: Next leader proposes a team",
  "Voting: Players vote on the team",
  "Quest: Selected players vote on quest success/failure",
  "Assassination: Evil tries to guess Merlin",
  "Ended: Game over - Good wins!",
];

gamePhases.forEach((phase, i) => {
  setTimeout(() => {
    console.log(`  ${i + 1}. ${phase}`);
  }, i * 100);
});

setTimeout(() => {
  console.log();
  console.log("=".repeat(70));
  console.log("DEMO COMPLETE!");
  console.log("=".repeat(70));
  console.log();
  console.log("Key Takeaways:");
  console.log("  ✅ Roles assigned deterministically from VRF seed");
  console.log("  ✅ Merkle root committed on-chain for verification");
  console.log("  ✅ Each player only knows their own role");
  console.log("  ✅ Spectators can see all roles (God view)");
  console.log("  ✅ No trusted game master needed!");
  console.log();
  console.log("Architecture: Three-Plane Design");
  console.log("  Plane A (On-chain): Game state, voting, Merkle root");
  console.log("  Plane B (Off-chain): Role assignment, role inbox");
  console.log("  Plane C (Agents): Wallet, strategy, on-chain interactions");
  console.log();
}, gamePhases.length * 100 + 100);
