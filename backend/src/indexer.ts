import { Connection, PublicKey, ConfirmedSignatureInfo, ParsedInstruction } from "@solana/web3.js";
import { Program, AnchorProvider, EventParser } from "@coral-xyz/anchor";
import { EventEmitter } from "events";

// Game event types
export interface GameEvent {
  gameId: string;
  type: string;
  data: any;
  timestamp: number;
  signature: string;
}

export interface GameState {
  gameId: string;
  phase: string;
  playerCount: number;
  players: string[];
  currentQuest: number;
  successfulQuests: number;
  failedQuests: number;
  leader: string;
  winner: string | null;
}

/**
 * Indexer that subscribes to on-chain game events
 */
export class GameIndexer extends EventEmitter {
  private connection: Connection;
  private programId: PublicKey;
  private lastSignature: string | null = null;
  private pollingInterval: NodeJS.Timeout | null = null;
  private gameStates: Map<string, GameState> = new Map();

  constructor(connection: Connection, programId: PublicKey) {
    super();
    this.connection = connection;
    this.programId = programId;
  }

  /**
   * Start polling for game events
   */
  start(pollIntervalMs: number = 2000): void {
    console.log("[Indexer] Starting polling for game events...");
    
    this.pollingInterval = setInterval(async () => {
      try {
        await this.pollForEvents();
      } catch (error) {
        console.error("[Indexer] Error polling events:", error);
      }
    }, pollIntervalMs);
  }

  /**
   * Stop polling
   */
  stop(): void {
    if (this.pollingInterval) {
      clearInterval(this.pollingInterval);
      this.pollingInterval = null;
      console.log("[Indexer] Stopped polling");
    }
  }

  /**
   * Poll for new game events
   */
  private async pollForEvents(): Promise<void> {
    const options: any = { limit: 100 };
    if (this.lastSignature) {
      options.until = this.lastSignature;
    }

    const signatures = await this.connection.getSignaturesForAddress(
      this.programId,
      options,
      "confirmed"
    );

    if (signatures.length === 0) return;

    // Process new signatures (oldest first)
    for (const sigInfo of signatures.reverse()) {
      if (sigInfo.signature !== this.lastSignature) {
        await this.processTransaction(sigInfo);
      }
    }

    this.lastSignature = signatures[signatures.length - 1].signature;
  }

  /**
   * Process a single transaction
   */
  private async processTransaction(sigInfo: ConfirmedSignatureInfo): Promise<void> {
    try {
      const tx = await this.connection.getParsedTransaction(sigInfo.signature, {
        commitment: "confirmed",
        maxSupportedTransactionVersion: 0,
      });

      if (!tx || !tx.meta) return;

      // Check if this is a game transaction
      const isGameTx = tx.transaction.message.instructions.some((ix: any) => {
        if (ix.programId) {
          return ix.programId.equals(this.programId);
        }
        return false;
      });

      if (!isGameTx) return;

      // Extract events from logs
      const logs = tx.meta.logMessages || [];
      const events = this.parseEventsFromLogs(logs, sigInfo.signature);

      for (const event of events) {
        this.emit("event", event);
        this.updateGameState(event);
      }
    } catch (error) {
      console.error("[Indexer] Error processing transaction:", error);
    }
  }

  /**
   * Parse events from transaction logs
   */
  private parseEventsFromLogs(logs: string[], signature: string): GameEvent[] {
    const events: GameEvent[] = [];

    for (const log of logs) {
      // Parse program events from logs
      // Format: "Program log: <event_type>: <data>"
      const match = log.match(/Program log: (\w+): (.+)/);
      if (match) {
        const [, eventType, dataStr] = match;
        try {
          const data = JSON.parse(dataStr);
          events.push({
            gameId: data.gameId || "unknown",
            type: eventType,
            data,
            timestamp: Date.now(),
            signature,
          });
        } catch {
          // Non-JSON log, treat as simple message
          events.push({
            gameId: "unknown",
            type: eventType,
            data: { message: dataStr },
            timestamp: Date.now(),
            signature,
          });
        }
      }
    }

    return events;
  }

  /**
   * Update internal game state based on events
   */
  private updateGameState(event: GameEvent): void {
    const gameId = event.gameId;
    
    if (!this.gameStates.has(gameId)) {
      this.gameStates.set(gameId, {
        gameId,
        phase: "Lobby",
        playerCount: 0,
        players: [],
        currentQuest: 0,
        successfulQuests: 0,
        failedQuests: 0,
        leader: "",
        winner: null,
      });
    }

    const state = this.gameStates.get(gameId)!;

    switch (event.type) {
      case "GameCreated":
        state.playerCount = 0;
        state.phase = "Lobby";
        break;
      case "PlayerJoined":
        state.playerCount++;
        if (event.data.player) {
          state.players.push(event.data.player);
        }
        break;
      case "GameStarted":
        state.phase = "RoleAssignment";
        break;
      case "TeamProposed":
        state.phase = "Voting";
        break;
      case "VotingComplete":
        if (event.data.approved) {
          state.phase = "Quest";
        }
        break;
      case "QuestResolved":
        state.currentQuest++;
        if (event.data.success) {
          state.successfulQuests++;
        } else {
          state.failedQuests++;
        }
        if (state.successfulQuests >= 3) {
          state.phase = "Assassination";
        } else if (state.failedQuests >= 3) {
          state.phase = "Ended";
          state.winner = "Evil";
        } else {
          state.phase = "TeamBuilding";
        }
        break;
      case "GameEnded":
        state.phase = "Ended";
        state.winner = event.data.winner;
        break;
    }

    this.emit("stateUpdate", state);
  }

  /**
   * Get current game state
   */
  getGameState(gameId: string): GameState | undefined {
    return this.gameStates.get(gameId);
  }

  /**
   * Get all tracked games
   */
  getAllGames(): GameState[] {
    return Array.from(this.gameStates.values());
  }
}
