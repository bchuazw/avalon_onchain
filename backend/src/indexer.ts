import { Connection, PublicKey, ConfirmedSignatureInfo, ParsedInstruction } from "@solana/web3.js";
import { Program, AnchorProvider, EventParser, BN } from "@coral-xyz/anchor";
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
  proposedTeam?: string[];  // Team members selected for current quest
  votes?: Record<string, boolean>;  // Voting results: player pubkey -> approve (true) / reject (false)
}

/**
 * Indexer that subscribes to on-chain game events
 */
export class GameIndexer extends EventEmitter {
  private connection: Connection;
  private programId: PublicKey;
  private lastSignature: string | null = null;
  private pollingInterval: NodeJS.Timeout | null = null;
  private scanInterval: NodeJS.Timeout | null = null;
  private gameStates: Map<string, GameState> = new Map();
  private program: Program<any> | null = null;

  constructor(connection: Connection, programId: PublicKey, program?: Program<any>) {
    super();
    this.connection = connection;
    this.programId = programId;
    this.program = program || null;
  }

  /**
   * Start polling for game events and scanning accounts
   */
  start(pollIntervalMs: number = 2000, scanIntervalMs: number = 3000): void {
    console.log("[Indexer] Starting polling for game events...");
    
    // Poll for new transactions
    this.pollingInterval = setInterval(async () => {
      try {
        await this.pollForEvents();
      } catch (error) {
        console.error("[Indexer] Error polling events:", error);
      }
    }, pollIntervalMs);

    // Periodically scan for all game accounts
    this.scanInterval = setInterval(async () => {
      try {
        await this.scanGameAccounts();
      } catch (error) {
        console.error("[Indexer] Error scanning accounts:", error);
      }
    }, scanIntervalMs);

    // Initial scan
    this.scanGameAccounts();
  }

  /**
   * Stop polling and scanning
   */
  stop(): void {
    if (this.pollingInterval) {
      clearInterval(this.pollingInterval);
      this.pollingInterval = null;
    }
    if (this.scanInterval) {
      clearInterval(this.scanInterval);
      this.scanInterval = null;
    }
    console.log("[Indexer] Stopped polling and scanning");
  }

  /**
   * Scan for all game state accounts
   */
  private async scanGameAccounts(): Promise<void> {
    if (!this.program) {
      console.log("[Indexer] No program instance, skipping account scan");
      return;
    }

    try {
      console.log("[Indexer] Scanning for game accounts...");
      // Use type assertion to access account namespace
      const accounts = await (this.program.account as any).gameState.all();
      console.log(`[Indexer] Found ${accounts.length} game accounts`);
      
      for (const account of accounts) {
        try {
          const gameId = account.account.gameId.toString();
          this.updateGameStateFromAccount(gameId, account.account);
        } catch (error) {
          console.error(`[Indexer] Error processing account ${account.publicKey.toBase58()}:`, error);
        }
      }
    } catch (error) {
      console.error("[Indexer] Error fetching game accounts:", error);
    }
  }

  /**
   * Update game state from account data
   */
  private updateGameStateFromAccount(gameId: string, account: any): void {
    // Parse phase enum (Anchor returns objects like { teamBuilding: {} })
    const phaseObj = account.phase || {};
    let phaseStr = "Lobby";
    if (phaseObj.lobby !== undefined) phaseStr = "Lobby";
    else if (phaseObj.roleAssignment !== undefined) phaseStr = "RoleAssignment";
    else if (phaseObj.teamBuilding !== undefined) phaseStr = "TeamBuilding";
    else if (phaseObj.voting !== undefined) phaseStr = "Voting";
    else if (phaseObj.quest !== undefined) phaseStr = "Quest";
    else if (phaseObj.assassination !== undefined) phaseStr = "Assassination";
    else if (phaseObj.ended !== undefined) {
      phaseStr = "Ended";
      console.log(`[Indexer] Game ${gameId} has ENDED phase detected`);
    }
    
    // Debug: Log phase detection for ended games
    if (phaseStr === "Ended") {
      console.log(`[Indexer] Game ${gameId} phase object:`, JSON.stringify(phaseObj));
    }

    // Extract players
    const players: string[] = [];
    if (account.players && Array.isArray(account.players)) {
      for (const p of account.players) {
        if (p && p.pubkey) {
          players.push(p.pubkey.toBase58());
        }
      }
    }

    // Parse winner enum (Anchor Option<Winner> format)
    // Option can be: null, undefined, or { some: Winner }
    let winnerStr: string | null = null;
    let winnerObj = account.winner;
    
    // Handle Anchor Option format: { some: Winner } or null/undefined
    if (winnerObj && typeof winnerObj === 'object') {
      if (winnerObj.some !== undefined) {
        winnerObj = winnerObj.some; // Extract the actual Winner enum
      }
    }
    
    // Parse Winner enum: { good: {} } or { evil: {} }
    if (winnerObj && typeof winnerObj === 'object') {
      if (winnerObj.good !== undefined) winnerStr = "Good";
      else if (winnerObj.evil !== undefined) winnerStr = "Evil";
    }

    // Get leader pubkey
    let leaderPubkey = "";
    if (account.leaderIndex !== undefined && account.players && account.players[account.leaderIndex]) {
      const leaderPlayer = account.players[account.leaderIndex];
      if (leaderPlayer && leaderPlayer.pubkey) {
        leaderPubkey = leaderPlayer.pubkey.toBase58();
      }
    }

    // Extract proposed team and votes from current quest
    const currentQuestIdx = account.currentQuest || 0;
    let proposedTeam: string[] | undefined = undefined;
    let votes: Record<string, boolean> | undefined = undefined;

    if (account.quests && account.quests[currentQuestIdx]) {
      const quest = account.quests[currentQuestIdx];
      
      // Extract proposed team members
      // Anchor Option<Pubkey> can be: { some: Pubkey } or null/undefined
      if (quest.proposedTeam && Array.isArray(quest.proposedTeam)) {
        proposedTeam = [];
        for (const member of quest.proposedTeam) {
          if (!member || member === null) continue;
          
          // Handle Anchor Option format: { some: Pubkey }
          if (typeof member === 'object') {
            if (member.some) {
              // Option::Some(Pubkey)
              const pubkey = member.some;
              if (pubkey && pubkey.toBase58) {
                proposedTeam.push(pubkey.toBase58());
              } else if (typeof pubkey === 'string') {
                proposedTeam.push(pubkey);
              }
            } else if (member.pubkey) {
              // Direct Pubkey object
              proposedTeam.push(member.pubkey.toBase58());
            } else if (typeof member === 'string') {
              // Already a string
              proposedTeam.push(member);
            }
          }
        }
        // Filter out empty entries
        proposedTeam = proposedTeam.filter(p => p && p.length > 0);
        if (proposedTeam.length === 0) proposedTeam = undefined;
      }

      // Extract votes
      // Anchor Option<bool> can be: { some: bool } or null/undefined
      if (quest.votes && Array.isArray(quest.votes) && account.players && Array.isArray(account.players)) {
        votes = {};
        for (let i = 0; i < quest.votes.length && i < account.players.length; i++) {
          const voteOption = quest.votes[i];
          const player = account.players[i];
          
          if (!player || !player.pubkey) continue;
          
          // Handle Anchor Option format: { some: bool } or null/undefined
          let voteValue: boolean | null = null;
          if (voteOption !== null && voteOption !== undefined) {
            if (typeof voteOption === 'object' && voteOption.some !== undefined) {
              voteValue = voteOption.some === true;
            } else if (typeof voteOption === 'boolean') {
              voteValue = voteOption;
            }
          }
          
          if (voteValue !== null) {
            const playerPubkey = player.pubkey.toBase58();
            votes[playerPubkey] = voteValue;
          }
        }
        // Only include if there are actual votes
        if (Object.keys(votes).length === 0) votes = undefined;
      }
    }

    const gameState: GameState = {
      gameId,
      phase: phaseStr,
      playerCount: account.playerCount || 0,
      players,
      currentQuest: account.currentQuest || 0,
      successfulQuests: account.successfulQuests || 0,
      failedQuests: account.failedQuests || 0,
      leader: leaderPubkey,
      winner: winnerStr,
      proposedTeam,
      votes,
    };

    const existing = this.gameStates.get(gameId);
    const isNewGame = !existing;
    const existingStr = existing ? JSON.stringify(existing) : "";
    const newStr = JSON.stringify(gameState);
    
    if (!existing || existingStr !== newStr) {
      const phaseChanged = existing && existing.phase !== phaseStr;
      console.log(`[Indexer] Updating game ${gameId}: ${phaseStr}, ${account.playerCount || 0} players, ${account.successfulQuests || 0} successes, ${account.failedQuests || 0} failures`);
      
      if (phaseChanged && phaseStr === "Ended") {
        console.log(`[Indexer] ⚠️ Game ${gameId} phase changed to ENDED! Previous phase: ${existing.phase}`);
        console.log(`[Indexer] Final state - Successes: ${account.successfulQuests || 0}, Failures: ${account.failedQuests || 0}, Winner: ${winnerStr || 'None'}`);
      }
      
      // Emit event for new game creation
      if (isNewGame) {
        console.log(`[Indexer] New game detected: ${gameId}`);
        this.emit("newGame", gameState);
      }
      
      // Detect new votes and broadcast as chat messages
      if (gameState.votes && existing && existing.votes) {
        const existingVotes = existing.votes || {};
        const newVotes = gameState.votes || {};
        
        // Find votes that are new (not in existing)
        for (const [playerPubkey, voteValue] of Object.entries(newVotes)) {
          if (!(playerPubkey in existingVotes)) {
            // New vote detected - broadcast as chat message
            const playerIndex = gameState.players.findIndex((p: string) => p === playerPubkey);
            if (playerIndex >= 0) {
              const voteText = voteValue 
                ? "✅ I approve this team!" 
                : "❌ I reject this team!";
              
              // Emit vote as chat message event
              this.emit("voteChat", {
                gameId,
                playerIndex,
                playerPubkey,
                vote: voteValue,
                text: voteText,
                timestamp: Date.now(),
              });
            }
          }
        }
      }
      
      this.gameStates.set(gameId, gameState);
      this.emit("stateUpdate", gameState);
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
      // Format: "Program log: <message>" or "Program log: Game <id> created by..."
      // Extract game ID from various log formats
      let gameId: string | null = null;
      
      // Try to extract game ID from log messages
      const gameIdMatch = log.match(/Game (\d+)/);
      if (gameIdMatch) {
        gameId = gameIdMatch[1];
      }
      
      // Parse structured events
      const match = log.match(/Program log: (\w+): (.+)/);
      if (match) {
        const [, eventType, dataStr] = match;
        try {
          const data = JSON.parse(dataStr);
          events.push({
            gameId: data.gameId || gameId || data.game_id || "unknown",
            type: eventType,
            data,
            timestamp: Date.now(),
            signature,
          });
        } catch {
          // Non-JSON log, extract game ID from message
          const msgGameIdMatch = dataStr.match(/Game (\d+)/);
          const extractedGameId = msgGameIdMatch ? msgGameIdMatch[1] : (gameId || "unknown");
          
          events.push({
            gameId: extractedGameId,
            type: eventType,
            data: { message: dataStr },
            timestamp: Date.now(),
            signature,
          });
        }
      } else {
        // Try to extract game ID from any log mentioning a game
        if (gameId) {
          // Determine event type from log content
          let eventType = "GameEvent";
          if (log.includes("created")) eventType = "GameCreated";
          else if (log.includes("joined")) eventType = "PlayerJoined";
          else if (log.includes("started")) eventType = "GameStarted";
          else if (log.includes("proposed")) eventType = "TeamProposed";
          else if (log.includes("voted")) eventType = "VotingComplete";
          else if (log.includes("Quest") && (log.includes("succeeded") || log.includes("failed"))) eventType = "QuestResolved";
          else if (log.includes("assassinated") || log.includes("Assassin")) eventType = "Assassination";
          else if (log.includes("wins") || log.includes("ended")) eventType = "GameEnded";
          
          events.push({
            gameId,
            type: eventType,
            data: { message: log },
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
        proposedTeam: undefined,
        votes: undefined,
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
