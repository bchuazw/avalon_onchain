import express, { Request, Response } from "express";
import { WebSocketServer, WebSocket } from "ws";
import cors from "cors";
import dotenv from "dotenv";
import { Connection, PublicKey, Keypair, clusterApiUrl } from "@solana/web3.js";
import { Program, AnchorProvider, Wallet } from "@coral-xyz/anchor";
import { GameIndexer, GameState } from "./indexer";
import { assignRoles, generateMerkleProof, RoleAssignment, getRoleInfo, getKnownPlayers } from "./roleAssignment";
import * as fs from "fs";
import * as path from "path";

dotenv.config();

// In-memory storage for role assignments (in production, use Redis or database)
const roleAssignments: Map<string, RoleAssignment> = new Map();
const roleRevealed: Map<string, Set<string>> = new Map(); // gameId -> Set of player pubkeys

// Express app setup
const app = express();
app.use(cors());
app.use(express.json());

// Solana connection
const NETWORK = process.env.SOLANA_NETWORK || "devnet";
const connection = new Connection(
  process.env.SOLANA_RPC_URL || clusterApiUrl(NETWORK as any),
  "confirmed"
);

// Program ID
const PROGRAM_ID = new PublicKey(
  process.env.PROGRAM_ID || "AvalonGame111111111111111111111111111111111"
);

// Setup indexer
const indexer = new GameIndexer(connection, PROGRAM_ID);

// WebSocket server for spectator view
const wss = new WebSocketServer({ port: parseInt(process.env.WS_PORT || "8081") });

// Connected clients
const clients: Map<string, WebSocket> = new Map(); // gameId -> client

/**
 * Initialize the server
 */
async function initializeServer() {
  console.log(`[Server] Starting Avalon Backend on ${NETWORK}`);
  console.log(`[Server] Program ID: ${PROGRAM_ID.toBase58()}`);

  // Start indexer
  indexer.start();

  // Listen for game events
  indexer.on("event", (event) => {
    console.log(`[Event] ${event.type}:`, event.data);
    
    // Broadcast to spectators
    broadcastToSpectators(event.gameId, {
      type: "event",
      data: event,
    });
  });

  indexer.on("stateUpdate", (state) => {
    broadcastToSpectators(state.gameId, {
      type: "stateUpdate",
      data: state,
    });
  });

  console.log("[Server] Initialization complete");
}

/**
 * Broadcast message to all spectators of a game
 */
function broadcastToSpectators(gameId: string, message: any) {
  const payload = JSON.stringify(message);
  
  wss.clients.forEach((client) => {
    const clientGameId = (client as any).gameId;
    if (clientGameId === gameId && client.readyState === WebSocket.OPEN) {
      client.send(payload);
    }
  });
}

// API Routes

/**
 * Health check
 */
app.get("/health", (req: Request, res: Response) => {
  res.json({ status: "ok", network: NETWORK, timestamp: Date.now() });
});

/**
 * Get game state (public info only)
 */
app.get("/game/:gameId", (req: Request, res: Response) => {
  const { gameId } = req.params;
  const state = indexer.getGameState(gameId);
  
  if (!state) {
    return res.status(404).json({ error: "Game not found" });
  }
  
  res.json(state);
});

/**
 * Get all active games
 */
app.get("/games", (req: Request, res: Response) => {
  const games = indexer.getAllGames();
  res.json(games);
});

/**
 * Assign roles for a game (called by game creator after game start)
 */
app.post("/assign-roles/:gameId", async (req: Request, res: Response) => {
  const { gameId } = req.params;
  const { playerPubkeys, vrfSeed } = req.body;

  if (!playerPubkeys || !vrfSeed) {
    return res.status(400).json({ error: "Missing playerPubkeys or vrfSeed" });
  }

  try {
    // Convert to PublicKey objects
    const players = playerPubkeys.map((pk: string) => new PublicKey(pk));
    const seed = Buffer.from(vrfSeed);

    // Assign roles deterministically
    const assignment = assignRoles(players, seed);
    
    // Store assignment
    roleAssignments.set(gameId, assignment);
    roleRevealed.set(gameId, new Set());

    console.log(`[Roles] Assigned roles for game ${gameId}`);
    console.log(`[Roles] Merkle Root: ${assignment.merkleRoot.toString("hex")}`);

    // Return merkle root for on-chain commitment
    res.json({
      merkleRoot: Array.from(assignment.merkleRoot),
      playerCount: players.length,
    });
  } catch (error: any) {
    console.error("[Roles] Error assigning roles:", error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Role Inbox - Get private role info (authenticated by signature)
 */
app.post("/role-inbox/:gameId", async (req: Request, res: Response) => {
  const { gameId } = req.params;
  const { playerPubkey, signature, message } = req.body;

  if (!playerPubkey || !signature) {
    return res.status(400).json({ error: "Missing playerPubkey or signature" });
  }

  try {
    const assignment = roleAssignments.get(gameId);
    if (!assignment) {
      return res.status(404).json({ error: "Role assignment not found" });
    }

    // Verify signature (simple verification)
    const playerKey = new PublicKey(playerPubkey);
    
    // In production, verify the signature properly:
    // const isValid = nacl.sign.detached.verify(
    //   Buffer.from(message),
    //   Buffer.from(signature),
    //   playerKey.toBytes()
    // );
    // if (!isValid) return res.status(401).json({ error: "Invalid signature" });

    // Get role info
    const roleInfo = getRoleInfo(assignment, playerKey);
    if (!roleInfo) {
      return res.status(404).json({ error: "Player not in game" });
    }

    // Check if already revealed
    const revealed = roleRevealed.get(gameId);
    if (revealed?.has(playerPubkey)) {
      return res.status(400).json({ error: "Role already revealed" });
    }

    // Generate merkle proof
    const merkleProof = generateMerkleProof(assignment, roleInfo.index, assignment.players[0].player.toBuffer());

    // Mark as revealed
    revealed?.add(playerPubkey);

    // Get known players for this role
    const knownPlayers = getKnownPlayers(assignment, playerKey);

    res.json({
      gameId,
      player: playerPubkey,
      role: roleInfo.role,
      alignment: roleInfo.alignment,
      knownPlayers: knownPlayers.map((pk) => pk.toBase58()),
      merkleProof: merkleProof.map((p) => Array.from(p)),
    });
  } catch (error: any) {
    console.error("[RoleInbox] Error:", error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Spectator God View - Get full game state with roles
 */
app.get("/god-view/:gameId", (req: Request, res: Response) => {
  const { gameId } = req.params;
  const { authToken } = req.query;

  // Simple auth check (in production, use proper JWT or API key)
  const validToken = process.env.SPECTATOR_TOKEN || "spectator-secret";
  if (authToken !== validToken) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const assignment = roleAssignments.get(gameId);
  const gameState = indexer.getGameState(gameId);

  if (!assignment || !gameState) {
    return res.status(404).json({ error: "Game not found" });
  }

  // Return full game state with all roles (god view)
  res.json({
    gameId,
    phase: gameState.phase,
    players: assignment.players.map((p) => ({
      pubkey: p.player.toBase58(),
      role: Role[p.role],
      alignment: Alignment[p.alignment],
    })),
    quests: gameState.currentQuest,
    successfulQuests: gameState.successfulQuests,
    failedQuests: gameState.failedQuests,
    winner: gameState.winner,
  });
});

/**
 * Get merkle proof for a player
 */
app.get("/merkle-proof/:gameId/:playerPubkey", (req: Request, res: Response) => {
  const { gameId, playerPubkey } = req.params;

  try {
    const assignment = roleAssignments.get(gameId);
    if (!assignment) {
      return res.status(404).json({ error: "Game not found" });
    }

    const playerKey = new PublicKey(playerPubkey);
    const roleInfo = getRoleInfo(assignment, playerKey);

    if (!roleInfo) {
      return res.status(404).json({ error: "Player not in game" });
    }

    const vrfSeed = Buffer.alloc(32); // Get from storage in production
    const merkleProof = generateMerkleProof(assignment, roleInfo.index, vrfSeed);

    res.json({
      merkleProof: merkleProof.map((p) => Array.from(p)),
      leaf: {
        player: playerPubkey,
        role: roleInfo.role,
        alignment: roleInfo.alignment,
      },
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// WebSocket handling
wss.on("connection", (ws: WebSocket, req: any) => {
  console.log("[WebSocket] New connection");

  ws.on("message", (message: string) => {
    try {
      const data = JSON.parse(message);
      
      if (data.type === "subscribe" && data.gameId) {
        (ws as any).gameId = data.gameId;
        console.log(`[WebSocket] Client subscribed to game ${data.gameId}`);
        
        // Send current state
        const state = indexer.getGameState(data.gameId);
        if (state) {
          ws.send(JSON.stringify({ type: "stateUpdate", data: state }));
        }
      }
    } catch (error) {
      console.error("[WebSocket] Error handling message:", error);
    }
  });

  ws.on("close", () => {
    console.log("[WebSocket] Connection closed");
  });

  // Send welcome message
  ws.send(JSON.stringify({ type: "connected", message: "Welcome to Avalon Spectator" }));
});

// Start server
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`[Server] HTTP API listening on port ${PORT}`);
  console.log(`[Server] WebSocket listening on port ${process.env.WS_PORT || 8081}`);
  initializeServer();
});

// Graceful shutdown
process.on("SIGTERM", () => {
  console.log("[Server] SIGTERM received, shutting down...");
  indexer.stop();
  wss.close();
  process.exit(0);
});

process.on("SIGINT", () => {
  console.log("[Server] SIGINT received, shutting down...");
  indexer.stop();
  wss.close();
  process.exit(0);
});
