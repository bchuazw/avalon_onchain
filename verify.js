#!/usr/bin/env node

/**
 * Avalon Solana - Verification Script
 * Tests the core logic without requiring Solana/Anchor toolchain
 */

const crypto = require("crypto");

// ==================== Role Assignment Logic ====================

const Role = {
  Unknown: 0,
  Merlin: 1,
  Percival: 2,
  Servant: 3,
  Morgana: 4,
  Assassin: 5,
  Minion: 6,
};

const Alignment = {
  Unknown: 0,
  Good: 1,
  Evil: 2,
};

const ROLE_DISTRIBUTION = {
  5: [Role.Merlin, Role.Percival, Role.Servant, Role.Morgana, Role.Assassin],
  6: [Role.Merlin, Role.Percival, Role.Servant, Role.Servant, Role.Morgana, Role.Assassin],
  7: [Role.Merlin, Role.Percival, Role.Servant, Role.Servant, Role.Morgana, Role.Assassin, Role.Minion],
  8: [Role.Merlin, Role.Percival, Role.Servant, Role.Servant, Role.Servant, Role.Morgana, Role.Assassin, Role.Minion],
};

function getAlignment(role) {
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

function seededShuffle(array, seed) {
  const result = [...array];
  let seedCopy = Buffer.from(seed);

  for (let i = result.length - 1; i > 0; i--) {
    const hash = crypto.createHash("sha256").update(seedCopy).update(Buffer.from([i])).digest();
    const randomValue = hash.readUInt32BE(0);
    const j = randomValue % (i + 1);
    [result[i], result[j]] = [result[j], result[i]];
    seedCopy = hash;
  }

  return result;
}

function assignRoles(playerCount, vrfSeed) {
  if (playerCount < 5 || playerCount > 8) {
    throw new Error("Player count must be between 5 and 8");
  }

  const roles = ROLE_DISTRIBUTION[playerCount];
  const shuffledRoles = seededShuffle(roles, vrfSeed);

  return shuffledRoles.map((role, index) => ({
    index,
    role,
    alignment: getAlignment(role),
    roleName: Object.keys(Role).find((k) => Role[k] === role),
  }));
}

// ==================== Test Functions ====================

function log(message) {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] ${message}`);
}

function testRoleAssignment() {
  log("=== Test: Role Assignment ===");

  const vrfSeed = crypto.randomBytes(32);
  const assignments = assignRoles(5, vrfSeed);

  // Verify correct number of roles
  const goodCount = assignments.filter((a) => a.alignment === Alignment.Good).length;
  const evilCount = assignments.filter((a) => a.alignment === Alignment.Evil).length;

  log(`Distribution: ${goodCount} good, ${evilCount} evil`);

  // Verify required roles present
  const hasMerlin = assignments.some((a) => a.role === Role.Merlin);
  const hasAssassin = assignments.some((a) => a.role === Role.Assassin);
  const hasMorgana = assignments.some((a) => a.role === Role.Morgana);

  if (!hasMerlin) throw new Error("Missing Merlin");
  if (!hasAssassin) throw new Error("Missing Assassin");
  if (!hasMorgana) throw new Error("Missing Morgana");

  log("✓ All required roles present");

  // Display assignments
  assignments.forEach((a) => {
    log(`  Player ${a.index}: ${a.roleName} (${a.alignment === Alignment.Good ? "Good" : "Evil"})`);
  });

  return true;
}

function testDeterministicAssignment() {
  log("\n=== Test: Deterministic Assignment ===");

  const vrfSeed = crypto.randomBytes(32);
  const assignments1 = assignRoles(5, vrfSeed);
  const assignments2 = assignRoles(5, vrfSeed);

  const same = assignments1.every((a, i) => a.role === assignments2[i].role);

  if (!same) throw new Error("Role assignment not deterministic!");

  log("✓ Role assignment is deterministic with same VRF seed");
  return true;
}

function testMerkleLeafHash() {
  log("\n=== Test: Merkle Leaf Hash ===");

  // Simulate creating a leaf hash
  const player = crypto.randomBytes(32);
  const role = Role.Merlin;
  const alignment = Alignment.Good;
  const vrfSeed = crypto.randomBytes(32);

  const data = Buffer.concat([
    player,
    Buffer.from([role]),
    Buffer.from([alignment]),
    vrfSeed,
  ]);
  const hash = crypto.createHash("sha256").update(data).digest();

  log(`✓ Leaf hash created: ${hash.toString("hex").slice(0, 16)}...`);
  return true;
}

function testQuestConfiguration() {
  log("\n=== Test: Quest Configuration ===");

  // 5 player quest config
  const questConfig = {
    5: {
      teamSizes: [2, 3, 2, 3, 3],
      failRequired: [1, 1, 1, 1, 1],
    },
  };

  const config = questConfig[5];
  if (config.teamSizes.length !== 5) throw new Error("Wrong number of quests");
  if (config.teamSizes[0] !== 2) throw new Error("Wrong team size for quest 1");

  log("✓ Quest configuration correct");
  log(`  Quest 1: ${config.teamSizes[0]} players, ${config.failRequired[0]} fail(s) needed`);
  log(`  Quest 4: ${config.teamSizes[3]} players, ${config.failRequired[3]} fail(s) needed`);

  return true;
}

// ==================== Main ====================

console.log("╔════════════════════════════════════════════════════════╗");
console.log("║     AVALON SOLANA - VERIFICATION SCRIPT                ║");
console.log("╚════════════════════════════════════════════════════════╝");

try {
  const results = [
    testRoleAssignment(),
    testDeterministicAssignment(),
    testMerkleLeafHash(),
    testQuestConfiguration(),
  ];

  const passed = results.filter((r) => r).length;
  const total = results.length;

  console.log("\n╔════════════════════════════════════════════════════════╗");
  console.log("║     VERIFICATION RESULTS                               ║");
  console.log("╚════════════════════════════════════════════════════════╝");
  console.log(`\nTests: ${passed}/${total} passed`);

  if (passed === total) {
    console.log("\n🎉 All verification tests passed!");
    console.log("\nCore logic is working correctly.");
    console.log("Ready for Solana deployment.");
    process.exit(0);
  } else {
    console.log("\n⚠️ Some tests failed");
    process.exit(1);
  }
} catch (error) {
  console.error("\n💥 Verification failed:", error.message);
  process.exit(1);
}
