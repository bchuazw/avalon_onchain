import { assignRoles, Role, Alignment, generateMerkleProof, createLeafHash } from "./roleAssignment";
import { PublicKey, Keypair } from "@solana/web3.js";
import crypto from "crypto";
import WebSocket from "ws";

/**
 * Local demo of the Avalon role assignment system
 * Sends real-time updates to frontend via WebSocket
 */

const WS_URL = process.env.WS_URL || "ws://localhost:8081";
const DEMO_GAME_ID = "demo-game-001";

// Connect to WebSocket server
const ws = new WebSocket(WS_URL);

ws.on("open", () => {
  console.log("=".repeat(70));
  console.log("AVALON ON SOLANA - LOCAL DEMO");
  console.log("=".repeat(70));
  console.log();
  console.log(`[Demo] Connected to WebSocket server at ${WS_URL}`);
  console.log(`[Demo] WebSocket readyState: ${ws.readyState} (1=OPEN)`);
  console.log(`[Demo] Broadcasting updates to frontend...`);
  console.log();
  
  // Subscribe to demo game
  ws.send(JSON.stringify({ type: "subscribe", gameId: DEMO_GAME_ID }));
  
  // Wait a moment for connection to stabilize and frontend to connect, then start demo
  setTimeout(() => {
    console.log(`[Demo] Starting demo... WebSocket state: ${ws.readyState}`);
    runDemo();
  }, 1000);
});

ws.on("error", (error) => {
  console.error("WebSocket error:", error);
  console.log("Note: Make sure the backend server is running (npm run dev)");
  process.exit(1);
});

async function sendUpdate(type: string, data: any) {
  if (ws.readyState === WebSocket.OPEN) {
    const message = {
      type: "demoUpdate",
      gameId: DEMO_GAME_ID,
      updateType: type,
      data: data,
      timestamp: Date.now()
    };
    console.log(`[Demo] Sending update: ${type} (WebSocket state: ${ws.readyState})`);
    try {
      const messageStr = JSON.stringify(message);
      ws.send(messageStr);
      console.log(`[Demo] ✓ Sent update: ${type} (${messageStr.length} bytes)`);
      // Small delay to ensure message is sent
      await new Promise(resolve => setTimeout(resolve, 50));
    } catch (error) {
      console.error(`[Demo] ✗ Error sending update ${type}:`, error);
    }
  } else {
    console.warn(`[Demo] ⚠ WebSocket not open (state: ${ws.readyState}), cannot send update: ${type}`);
  }
}

async function runDemo() {
  // Step 1: Create 5 simulated players
  console.log("🎮 STEP 1: Creating 5 Players");
  console.log("-".repeat(70));

  const players = Array.from({ length: 5 }, (_, i) => {
    const keypair = Keypair.generate();
    return {
      name: `Player ${i + 1}`,
      pubkey: keypair.publicKey,
      keypair,
    };
  });

  players.forEach((p, i) => {
    console.log(`  ${i + 1}. ${p.name}: ${p.pubkey.toBase58().slice(0, 20)}...`);
  });
  
  await sendUpdate("playersCreated", {
    players: players.map(p => ({
      name: p.name,
      pubkey: p.pubkey.toBase58()
    }))
  });
  
  await sleep(1000);
  console.log();

  // Step 2: Generate VRF seed
  console.log("🎲 STEP 2: Generating VRF Seed");
  console.log("-".repeat(70));
  const vrfSeed = crypto.randomBytes(32);
  console.log(`  VRF Seed: ${vrfSeed.toString("hex").slice(0, 40)}...`);
  console.log("  (In production, this comes from Switchboard VRF oracle)");
  
  await sendUpdate("vrfSeedGenerated", {
    seed: Array.from(vrfSeed)
  });
  
  await sleep(1000);
  console.log();

  // Step 3: Assign roles deterministically
  console.log("🎭 STEP 3: Assigning Roles (Deterministic)");
  console.log("-".repeat(70));

  const playerPubkeys = players.map((p) => p.pubkey);
  const assignment = assignRoles(playerPubkeys, vrfSeed);

  console.log("  Role Distribution:");
  const roleAssignments = assignment.players.map((p, i) => {
    const roleName = Role[p.role];
    const alignmentName = Alignment[p.alignment];
    const emoji = alignmentName === "Good" ? "🟢" : "🔴";
    console.log(`    ${emoji} ${roleName.padEnd(10)} (${alignmentName})`);
    return {
      player: players[i].name,
      pubkey: players[i].pubkey.toBase58(),
      role: roleName,
      alignment: alignmentName,
      emoji
    };
  });
  
  await sendUpdate("rolesAssigned", {
    assignments: roleAssignments
  });
  
  await sleep(1500);
  console.log();

  // Step 4: Generate Merkle Root
  console.log("🌳 STEP 4: Merkle Tree Commitment");
  console.log("-".repeat(70));
  console.log(`  Merkle Root: ${assignment.merkleRoot.toString("hex")}`);
  console.log("  (This root is posted on-chain for verification)");
  
  await sendUpdate("merkleRootGenerated", {
    merkleRoot: assignment.merkleRoot.toString("hex")
  });
  
  await sleep(1000);
  console.log();

  // Step 5: Simulate each player fetching their role
  console.log("📬 STEP 5: Role Inbox - Each Player Fetches Their Role");
  console.log("-".repeat(70));

  for (let index = 0; index < assignment.players.length; index++) {
    const playerRole = assignment.players[index];
    const player = players[index];
    const roleInfo = {
      player: player.pubkey.toBase58(),
      role: Role[playerRole.role],
      alignment: Alignment[playerRole.alignment],
    };

    const merkleProof = generateMerkleProof(assignment, index, vrfSeed);

    console.log(`\n  ${player.name} (${player.pubkey.toBase58().slice(0, 20)}...)`);
    console.log(`    Role: ${roleInfo.role} (${roleInfo.alignment})`);
    console.log(`    Merkle Proof: ${merkleProof.length} hashes`);
    console.log(`    Can prove role without revealing others: ✅`);
    
    await sendUpdate("roleFetched", {
      player: player.name,
      pubkey: player.pubkey.toBase58(),
      role: roleInfo.role,
      alignment: roleInfo.alignment,
      merkleProofLength: merkleProof.length
    });
    
    await sleep(800);
  }
  console.log();

  // Step 6: Spectator God View
  console.log("👁️  STEP 6: Spectator God View (All Roles Visible)");
  console.log("-".repeat(70));
  console.log("  (This view is available to spectators with auth token)");
  console.log();

  console.log("  Player          | Role      | Alignment | Public Key");
  console.log("  " + "-".repeat(66));
  const godView = assignment.players.map((p, i) => {
    const name = players[i].name.padEnd(15);
    const role = Role[p.role].padEnd(9);
    const align = Alignment[p.alignment].padEnd(9);
    const pk = p.player.toBase58().slice(0, 20) + "...";
    console.log(`  ${name}| ${role}| ${align}| ${pk}`);
    return {
      name: players[i].name,
      pubkey: p.player.toBase58(),
      role: Role[p.role],
      alignment: Alignment[p.alignment]
    };
  });
  
  await sendUpdate("godView", {
    players: godView
  });
  
  await sleep(1500);
  console.log();

  // Step 7: Game Flow Simulation
  console.log("🎮 STEP 7: Simulated Game Flow");
  console.log("-".repeat(70));

  const gamePhases = [
    { phase: "Lobby", description: "Players joining..." },
    { phase: "RoleAssignment", description: "Roles assigned via Merkle tree" },
    { phase: "TeamBuilding", description: "Leader proposes a team" },
    { phase: "Voting", description: "Players vote on the team" },
    { phase: "Quest", description: "Selected players vote on quest success/failure" },
    { phase: "TeamBuilding", description: "Next leader proposes a team" },
    { phase: "Voting", description: "Players vote on the team" },
    { phase: "Quest", description: "Selected players vote on quest success/failure" },
    { phase: "Assassination", description: "Evil tries to guess Merlin" },
    { phase: "Ended", description: "Game over - Good wins!" },
  ];

  for (let i = 0; i < gamePhases.length; i++) {
    const { phase, description } = gamePhases[i];
    console.log(`  ${i + 1}. ${phase}: ${description}`);
    
    await sendUpdate("gamePhase", {
      phase,
      description,
      step: i + 1,
      total: gamePhases.length
    });
    
    await sleep(1000);
  }
  console.log();

  // Final summary
  await sleep(500);
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
  
  await sendUpdate("demoComplete", {
    summary: {
      players: players.length,
      rolesAssigned: assignment.players.length,
      merkleRoot: assignment.merkleRoot.toString("hex")
    }
  });
  
  await sleep(2000);
  ws.close();
  process.exit(0);
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}
