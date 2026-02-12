import express from "express";
import cors from "cors";
import { WebSocketServer, WebSocket } from "ws";
import * as http from "http";
import * as crypto from "crypto";
import { assignRoles, PlayerAssignment, Role, Alignment } from "./roleAssignment";
import { createRolesMerkleTree } from "./merkleTree";

// ==================== Configuration ====================

const PORT = parseInt(process.env.PORT || "3000", 10);
const WS_PORT = parseInt(process.env.WS_PORT || "8081", 10);
const SPECTATOR_TOKEN = process.env.SPECTATOR_TOKEN || "spectator-secret";
const CORS_ORIGIN = process.env.CORS_ORIGIN || "*";

// ==================== In-Memory Store ====================

interface GameData {
  gameId: string;
  assignments: PlayerAssignment[];
  vrfSeed: number[];
  merkleRoot: string;  // hex
  proofs: string[][];  // hex arrays
  createdAt: number;
  gamePDA?: string;
}

const gamesStore = new Map<string, GameData>();
const wsClients = new Set<WebSocket>();

// ==================== Express App ====================

const app = express();
app.use(cors({ origin: CORS_ORIGIN }));
app.use(express.json());

// ---- Health Check ----

app.get("/health", (_req, res) => {
  res.json({
    status: "ok",
    uptime: process.uptime(),
    games: gamesStore.size,
    timestamp: new Date().toISOString(),
  });
});

// ---- List Games ----

app.get("/games", (_req, res) => {
  const games = Array.from(gamesStore.values()).map((g) => ({
    gameId: g.gameId,
    playerCount: g.assignments.length,
    createdAt: g.createdAt,
    gamePDA: g.gamePDA,
  }));
  res.json({ games });
});

// ---- Get Game (public state) ----

app.get("/game/:gameIdOrPDA", (req, res) => {
  const { gameIdOrPDA } = req.params;

  // Try to find by gameId first, then by PDA
  let game = gamesStore.get(gameIdOrPDA);
  if (!game) {
    game = Array.from(gamesStore.values()).find((g) => g.gamePDA === gameIdOrPDA);
  }

  if (!game) {
    return res.status(404).json({ error: "Game not found" });
  }

  // Return public state only (no role details)
  res.json({
    gameId: game.gameId,
    playerCount: game.assignments.length,
    players: game.assignments.map((a) => ({
      pubkey: a.playerPubkey,
      index: a.playerIndex,
    })),
    merkleRoot: game.merkleRoot,
    createdAt: game.createdAt,
    gamePDA: game.gamePDA,
  });
});

// ---- Assign Roles (backend-initiated) ----

app.post("/assign-roles/:gameId", (req, res) => {
  const { gameId } = req.params;
  const { playerPubkeys, vrfSeed, gamePDA } = req.body;

  if (!playerPubkeys || !Array.isArray(playerPubkeys)) {
    return res.status(400).json({ error: "playerPubkeys array required" });
  }

  if (!vrfSeed || !Array.isArray(vrfSeed) || vrfSeed.length !== 32) {
    return res.status(400).json({ error: "vrfSeed must be 32-byte array" });
  }

  try {
    // Assign roles deterministically
    const assignments = assignRoles(playerPubkeys, vrfSeed);

    // Build merkle tree
    const { merkleRoot, proofs } = createRolesMerkleTree(assignments, vrfSeed);

    // Store game data
    const gameData: GameData = {
      gameId,
      assignments,
      vrfSeed,
      merkleRoot: merkleRoot.toString("hex"),
      proofs: proofs.map((p) => p.map((b) => b.toString("hex"))),
      createdAt: Date.now(),
      gamePDA,
    };

    gamesStore.set(gameId, gameData);

    console.log(`[ROLES] Game ${gameId}: Assigned ${assignments.length} roles`);
    assignments.forEach((a) => {
      console.log(
        `  Player ${a.playerIndex}: ${Role[a.role]} (${Alignment[a.alignment]})`
      );
    });

    // Broadcast to spectators
    broadcastToSpectators({
      type: "roles_assigned",
      gameId,
      playerCount: assignments.length,
    });

    res.json({
      gameId,
      merkleRoot: Array.from(merkleRoot),
      playerCount: assignments.length,
      // Do NOT return roles here - they go through the inbox
    });
  } catch (error: any) {
    console.error(`[ROLES] Error assigning roles:`, error);
    res.status(500).json({ error: error.message });
  }
});

// ---- Role Inbox (authenticated per-player) ----

app.post("/role-inbox/:gameId", (req, res) => {
  const { gameId } = req.params;
  const { playerPubkey, timestamp, signature } = req.body;

  if (!playerPubkey || !timestamp || !signature) {
    return res.status(400).json({ error: "playerPubkey, timestamp, signature required" });
  }

  const game = gamesStore.get(gameId);
  if (!game) {
    return res.status(404).json({ error: "Game not found" });
  }

  // Find player assignment
  const assignment = game.assignments.find(
    (a) => a.playerPubkey === playerPubkey
  );

  if (!assignment) {
    return res.status(404).json({ error: "Player not found in this game" });
  }

  // Verify request freshness (within 60 seconds)
  const ts = parseInt(timestamp, 10);
  if (Math.abs(Date.now() - ts) > 60_000) {
    return res.status(401).json({ error: "Request expired" });
  }

  // For MVP, we trust the signature field (in production, verify with ed25519)
  // The signature is a hash of the challenge + part of the player's secret key
  // Since we can't verify the secret key server-side without it, we accept
  // any request that includes a valid playerPubkey that's in the game.
  // Production would use ed25519 signature verification.

  console.log(
    `[INBOX] Player ${playerPubkey.slice(0, 8)}... fetched role for game ${gameId}: ${Role[assignment.role]}`
  );

  // Return role info + merkle proof
  const proofIndex = assignment.playerIndex;
  const proof = game.proofs[proofIndex] || [];

  res.json({
    role: assignment.role,
    alignment: assignment.alignment,
    knownPlayers: assignment.knownPlayers,
    merkleProof: proof.map((hex) => Array.from(Buffer.from(hex, "hex"))),
  });
});

// ---- God View (spectator only, requires auth) ----

app.get("/god-view/:gameId", (req, res) => {
  const { gameId } = req.params;
  const authToken =
    (req.query.authToken as string) ||
    req.headers.authorization?.replace("Bearer ", "");

  if (!authToken || authToken !== SPECTATOR_TOKEN) {
    return res.status(401).json({ error: "Unauthorized. Valid spectator token required." });
  }

  const game = gamesStore.get(gameId);
  if (!game) {
    return res.status(404).json({ error: "Game not found" });
  }

  // Full game state with all roles visible (spectator only)
  res.json({
    gameId: game.gameId,
    assignments: game.assignments.map((a) => ({
      playerPubkey: a.playerPubkey,
      playerIndex: a.playerIndex,
      role: Role[a.role],
      alignment: Alignment[a.alignment],
      knownPlayers: a.knownPlayers,
    })),
    merkleRoot: game.merkleRoot,
    vrfSeed: game.vrfSeed,
    createdAt: game.createdAt,
    gamePDA: game.gamePDA,
  });
});

// ==================== WebSocket Server (Spectator) ====================

const wsServer = new WebSocketServer({ port: WS_PORT });

wsServer.on("connection", (ws, req) => {
  console.log(`[WS] Spectator connected from ${req.socket.remoteAddress}`);
  wsClients.add(ws);

  ws.on("close", () => {
    wsClients.delete(ws);
    console.log("[WS] Spectator disconnected");
  });

  ws.on("error", (err) => {
    console.error("[WS] Error:", err);
    wsClients.delete(ws);
  });

  // Send welcome message
  ws.send(
    JSON.stringify({
      type: "connected",
      activeGames: gamesStore.size,
      timestamp: new Date().toISOString(),
    })
  );
});

function broadcastToSpectators(data: any) {
  const message = JSON.stringify(data);
  for (const client of wsClients) {
    if (client.readyState === WebSocket.OPEN) {
      client.send(message);
    }
  }
}

// ==================== Start Server ====================

app.listen(PORT, () => {
  console.log("╔════════════════════════════════════════════════════════╗");
  console.log("║     AVALON SOLANA - BACKEND SERVER                      ║");
  console.log("╚════════════════════════════════════════════════════════╝");
  console.log(`  HTTP API:    http://localhost:${PORT}`);
  console.log(`  WebSocket:   ws://localhost:${WS_PORT}`);
  console.log(`  Environment: ${process.env.NODE_ENV || "development"}`);
  console.log("");
  console.log("Endpoints:");
  console.log(`  GET  /health                - Health check`);
  console.log(`  GET  /games                 - List all games`);
  console.log(`  GET  /game/:id              - Get game (public state)`);
  console.log(`  POST /assign-roles/:gameId  - Assign roles`);
  console.log(`  POST /role-inbox/:gameId    - Fetch private role`);
  console.log(`  GET  /god-view/:gameId      - Full state (spectator)`);
  console.log("");
});

export default app;
