import {
  Connection,
  PublicKey,
  Keypair,
  Transaction,
  SystemProgram,
  LAMPORTS_PER_SOL,
  Commitment,
} from "@solana/web3.js";
import { Program, AnchorProvider, Wallet, BN, Idl } from "@coral-xyz/anchor";
import axios from "axios";
import bs58 from "bs58";
import nacl from "tweetnacl";

// Program IDL (simplified - in production, import from file)
export const AVALON_IDL: any = {
  version: "0.1.0",
  name: "avalon_game",
  instructions: [
    {
      name: "createGame",
      accounts: [
        { name: "creator", isMut: true, isSigner: true },
        { name: "gameState", isMut: true, isSigner: false },
        { name: "systemProgram", isMut: false, isSigner: false },
      ],
      args: [{ name: "gameId", type: "u64" }],
    },
    {
      name: "joinGame",
      accounts: [
        { name: "player", isMut: true, isSigner: true },
        { name: "gameState", isMut: true, isSigner: false },
        { name: "systemProgram", isMut: false, isSigner: false },
      ],
      args: [],
    },
    {
      name: "startGame",
      accounts: [
        { name: "creator", isMut: false, isSigner: true },
        { name: "gameState", isMut: true, isSigner: false },
      ],
      args: [
        { name: "vrfSeed", type: { array: ["u8", 32] } },
        { name: "rolesCommitment", type: { array: ["u8", 32] } },
      ],
    },
    {
      name: "submitRoleReveal",
      accounts: [
        { name: "player", isMut: true, isSigner: true },
        { name: "gameState", isMut: true, isSigner: false },
        { name: "playerRole", isMut: true, isSigner: false },
        { name: "systemProgram", isMut: false, isSigner: false },
      ],
      args: [
        { name: "role", type: "u8" },
        { name: "alignment", type: "u8" },
        { name: "merkleProof", type: { vec: { array: ["u8", 32] } } },
      ],
    },
    {
      name: "proposeTeam",
      accounts: [
        { name: "player", isMut: false, isSigner: true },
        { name: "gameState", isMut: true, isSigner: false },
      ],
      args: [{ name: "team", type: { vec: "publicKey" } }],
    },
    {
      name: "voteTeam",
      accounts: [
        { name: "player", isMut: false, isSigner: true },
        { name: "gameState", isMut: true, isSigner: false },
      ],
      args: [{ name: "approve", type: "bool" }],
    },
    {
      name: "submitQuestVote",
      accounts: [
        { name: "player", isMut: false, isSigner: true },
        { name: "gameState", isMut: true, isSigner: false },
        { name: "playerRole", isMut: false, isSigner: false },
      ],
      args: [{ name: "success", type: "bool" }],
    },
    {
      name: "assassinGuess",
      accounts: [
        { name: "assassin", isMut: false, isSigner: true },
        { name: "gameState", isMut: true, isSigner: false },
      ],
      args: [{ name: "target", type: "publicKey" }],
    },
    {
      name: "advancePhase",
      accounts: [
        { name: "caller", isMut: false, isSigner: true },
        { name: "gameState", isMut: true, isSigner: false },
      ],
      args: [],
    },
  ],
  accounts: [
    {
      name: "GameState",
      type: {
        kind: "struct",
        fields: [
          { name: "gameId", type: "u64" },
          { name: "creator", type: "publicKey" },
          { name: "phase", type: "u8" },
          { name: "playerCount", type: "u8" },
          { name: "currentQuest", type: "u8" },
          { name: "leaderIndex", type: "u8" },
          { name: "successfulQuests", type: "u8" },
          { name: "failedQuests", type: "u8" },
          { name: "winner", type: { option: "u8" } },
          { name: "vrfSeed", type: { array: ["u8", 32] } },
          { name: "rolesCommitment", type: { array: ["u8", 32] } },
        ],
      },
    },
    {
      name: "PlayerRole",
      type: {
        kind: "struct",
        fields: [
          { name: "gameId", type: "u64" },
          { name: "player", type: "publicKey" },
          { name: "role", type: "u8" },
          { name: "alignment", type: "u8" },
        ],
      },
    },
  ],
};

// Enums
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

export enum GamePhase {
  Lobby = 0,
  RoleAssignment = 1,
  TeamBuilding = 2,
  Voting = 3,
  Quest = 4,
  Assassination = 5,
  Ended = 6,
}

// Types
export interface PlayerInfo {
  pubkey: PublicKey;
  role: Role;
  alignment: Alignment;
}

export interface RoleInboxResponse {
  gameId: string;
  player: string;
  role: Role;
  alignment: Alignment;
  knownPlayers: string[];
  merkleProof: number[][];
}

export interface AvalonAgentConfig {
  connection: Connection;
  programId: PublicKey;
  backendUrl: string;
  commitment?: Commitment;
  idl?: Idl; // Optional: provide custom IDL, otherwise uses built-in AVALON_IDL
}

/**
 * Avalon Agent SDK - For AI agents to play Avalon on Solana
 */
export class AvalonAgent {
  private connection: Connection;
  private program: Program;
  private wallet: Wallet;
  private backendUrl: string;
  private roleInfo: RoleInboxResponse | null = null;

  constructor(
    keypair: Keypair,
    config: AvalonAgentConfig
  ) {
    this.connection = config.connection;
    this.backendUrl = config.backendUrl;
    this.wallet = new Wallet(keypair);

    const provider = new AnchorProvider(
      config.connection,
      this.wallet,
      { commitment: config.commitment || "confirmed" }
    );

    // Use provided IDL or fall back to built-in
    const idl = config.idl || AVALON_IDL;
    
    // Create program with IDL and provider (Anchor 0.30.1 format)
    // Anchor 0.30.1 expects: new Program(idl, provider)
    // The program ID is read from idl.metadata.address or can be set explicitly
    const idlWithAddress = { ...idl };
    if (!(idlWithAddress as any).metadata) {
      (idlWithAddress as any).metadata = {};
    }
    (idlWithAddress as any).metadata.address = config.programId.toBase58();
    
    this.program = new Program(idlWithAddress as Idl, provider) as any;
  }

  /**
   * Get the agent's public key
   */
  get publicKey(): PublicKey {
    return this.wallet.publicKey;
  }

  /**
   * Get the agent's keypair (for signing)
   */
  get keypair(): Keypair {
    return (this.wallet as any).payer;
  }

  // ==================== Wallet Management ====================

  /**
   * Create a new wallet
   */
  static createWallet(): Keypair {
    return Keypair.generate();
  }

  /**
   * Import wallet from private key (base58 encoded)
   */
  static importWallet(privateKeyBase58: string): Keypair {
    const secretKey = bs58.decode(privateKeyBase58);
    return Keypair.fromSecretKey(secretKey);
  }

  /**
   * Export wallet to base58 private key
   */
  static exportWallet(keypair: Keypair): string {
    return bs58.encode(keypair.secretKey);
  }

  /**
   * Fund wallet with SOL (from faucet)
   */
  async fundWallet(lamports: number = LAMPORTS_PER_SOL): Promise<string> {
    const signature = await this.connection.requestAirdrop(
      this.publicKey,
      lamports
    );
    await this.connection.confirmTransaction(signature);
    return signature;
  }

  /**
   * Get wallet balance
   */
  async getBalance(): Promise<number> {
    return await this.connection.getBalance(this.publicKey);
  }

  // ==================== Game Actions ====================

  /**
   * Create a new game
   */
  async createGame(gameId: BN): Promise<{ gamePDA: PublicKey; signature: string }> {
    const [gamePDA] = PublicKey.findProgramAddressSync(
      [Buffer.from("game"), gameId.toArrayLike(Buffer, "le", 8)],
      this.program.programId
    );

    const tx = await this.program.methods
      .createGame(gameId)
      .accounts({
        creator: this.publicKey,
        gameState: gamePDA,
        systemProgram: SystemProgram.programId,
      })
      .rpc();

    return { gamePDA, signature: tx };
  }

  /**
   * Join an existing game
   */
  async joinGame(gamePDA: PublicKey): Promise<string> {
    const tx = await this.program.methods
      .joinGame()
      .accounts({
        player: this.publicKey,
        gameState: gamePDA,
        systemProgram: SystemProgram.programId,
      })
      .rpc();

    return tx;
  }

  /**
   * Start the game (creator only)
   */
  async startGame(
    gamePDA: PublicKey,
    vrfSeed: Buffer,
    rolesCommitment: Buffer
  ): Promise<string> {
    const tx = await this.program.methods
      .startGame(Array.from(vrfSeed), Array.from(rolesCommitment))
      .accounts({
        creator: this.publicKey,
        gameState: gamePDA,
      })
      .rpc();

    return tx;
  }

  // ==================== Role Management ====================

  /**
   * Fetch role from role inbox (private)
   */
  async fetchRole(gameId: string): Promise<RoleInboxResponse> {
    // Create authentication message
    const message = `Reveal role for game ${gameId}`;
    const messageBytes = Buffer.from(message);
    
    // Sign message
    const signature = nacl.sign.detached(
      messageBytes,
      this.keypair.secretKey
    );

    // Call role inbox
    const response = await axios.post(`${this.backendUrl}/role-inbox/${gameId}`, {
      playerPubkey: this.publicKey.toBase58(),
      signature: Array.from(signature),
      message,
    });

    this.roleInfo = response.data as RoleInboxResponse;
    return this.roleInfo;
  }

  /**
   * Submit role reveal to on-chain
   */
  async submitRoleReveal(gamePDA: PublicKey): Promise<string> {
    if (!this.roleInfo) {
      throw new Error("Role not fetched. Call fetchRole first.");
    }

    const [playerRolePDA] = PublicKey.findProgramAddressSync(
      [
        Buffer.from("player_role"),
        gamePDA.toBuffer(),
        this.publicKey.toBuffer(),
      ],
      this.program.programId
    );

    // Convert Role number to enum name, then to Anchor enum format
    const roleNames: { [key: number]: string } = {
      0: "unknown",
      1: "merlin",
      2: "percival",
      3: "servant",
      4: "morgana",
      5: "assassin",
      6: "minion",
    };
    const roleEnum: any = {};
    const roleKey = roleNames[this.roleInfo.role] || "unknown";
    roleEnum[roleKey] = {};

    // Convert Alignment number to enum name, then to Anchor enum format
    const alignmentNames: { [key: number]: string } = {
      0: "unknown",
      1: "good",
      2: "evil",
    };
    const alignmentEnum: any = {};
    const alignmentKey = alignmentNames[this.roleInfo.alignment] || "unknown";
    alignmentEnum[alignmentKey] = {};

    const tx = await this.program.methods
      .submitRoleReveal(
        roleEnum,
        alignmentEnum,
        this.roleInfo.merkleProof.map((p) => Array.from(Buffer.from(p)))
      )
      .accounts({
        player: this.publicKey,
        gameState: gamePDA,
        playerRole: playerRolePDA,
        systemProgram: SystemProgram.programId,
      })
      .rpc();

    return tx;
  }

  /**
   * Get my role (only available after fetchRole)
   */
  get myRole(): Role | null {
    return this.roleInfo?.role ?? null;
  }

  /**
   * Get my alignment (only available after fetchRole)
   */
  get myAlignment(): Alignment | null {
    return this.roleInfo?.alignment ?? null;
  }

  /**
   * Get players I know (only available after fetchRole)
   */
  get knownPlayers(): string[] {
    return this.roleInfo?.knownPlayers ?? [];
  }

  /**
   * Check if I'm evil
   */
  get isEvil(): boolean {
    return this.myAlignment === Alignment.Evil;
  }

  /**
   * Check if I'm good
   */
  get isGood(): boolean {
    return this.myAlignment === Alignment.Good;
  }

  // ==================== Gameplay ====================

  /**
   * Propose a team (leader only)
   */
  async proposeTeam(gamePDA: PublicKey, team: PublicKey[]): Promise<string> {
    const tx = await this.program.methods
      .proposeTeam(team)
      .accounts({
        player: this.publicKey,
        gameState: gamePDA,
      })
      .rpc();

    return tx;
  }

  /**
   * Vote on proposed team
   */
  async voteTeam(gamePDA: PublicKey, approve: boolean): Promise<string> {
    const tx = await this.program.methods
      .voteTeam(approve)
      .accounts({
        player: this.publicKey,
        gameState: gamePDA,
      })
      .rpc();

    return tx;
  }

  /**
   * Submit quest vote
   */
  async submitQuestVote(gamePDA: PublicKey, success: boolean): Promise<string> {
    const [playerRolePDA] = PublicKey.findProgramAddressSync(
      [
        Buffer.from("player_role"),
        gamePDA.toBuffer(),
        this.publicKey.toBuffer(),
      ],
      this.program.programId
    );

    const tx = await this.program.methods
      .submitQuestVote(success)
      .accounts({
        player: this.publicKey,
        gameState: gamePDA,
        playerRole: playerRolePDA,
      })
      .rpc();

    return tx;
  }

  /**
   * Assassin attempts to kill Merlin
   */
  async assassinGuess(gamePDA: PublicKey, target: PublicKey): Promise<string> {
    const tx = await this.program.methods
      .assassinGuess(target)
      .accounts({
        assassin: this.publicKey,
        gameState: gamePDA,
      })
      .rpc();

    return tx;
  }

  /**
   * Advance phase manually (for timeouts/debugging)
   * Can be called by any player to advance stuck phases
   */
  async advancePhase(gamePDA: PublicKey): Promise<string> {
    const tx = await this.program.methods
      .advancePhase()
      .accounts({
        caller: this.publicKey,
        gameState: gamePDA,
      })
      .rpc();

    return tx;
  }

  // ==================== Game State ====================

  /**
   * Get game state from on-chain account
   */
  async getGameState(gamePDA: PublicKey): Promise<any> {
    return await (this.program.account as any).gameState.fetch(gamePDA);
  }

  /**
   * Get public game info from backend
   */
  async getPublicGameInfo(gameId: string): Promise<any> {
    const response = await axios.get(`${this.backendUrl}/game/${gameId}`);
    return response.data;
  }

  /**
   * Get all active games from backend
   */
  async getAllGames(): Promise<any[]> {
    const response = await axios.get(`${this.backendUrl}/games`);
    return response.data;
  }

  /**
   * Check if I am the current leader
   */
  async isLeader(gamePDA: PublicKey): Promise<boolean> {
    const gameState = await this.getGameState(gamePDA);
    if (!gameState.players || !gameState.players[gameState.leaderIndex]) {
      return false;
    }
    const leader = gameState.players[gameState.leaderIndex];
    return leader && leader.pubkey.equals(this.publicKey);
  }

  /**
   * Check if I am on the proposed team for current quest
   */
  async isOnProposedTeam(gamePDA: PublicKey): Promise<boolean> {
    const gameState = await this.getGameState(gamePDA);
    const currentQuest = gameState.currentQuest;
    const quest = gameState.quests[currentQuest];
    
    if (!quest || !quest.proposedTeam) {
      return false;
    }

    for (const member of quest.proposedTeam) {
      if (member && member.equals && member.equals(this.publicKey)) {
        return true;
      }
      // Handle case where member is already a PublicKey object
      if (member && typeof member === 'object' && member.pubkey && member.pubkey.equals(this.publicKey)) {
        return true;
      }
    }
    return false;
  }

  /**
   * Get current game phase
   */
  async getGamePhase(gamePDA: PublicKey): Promise<GamePhase> {
    const gameState = await this.getGameState(gamePDA);
    // Anchor returns phase as object like { teamBuilding: {} }
    const phaseObj = gameState.phase || {};
    if (phaseObj.lobby !== undefined) return GamePhase.Lobby;
    if (phaseObj.roleAssignment !== undefined) return GamePhase.RoleAssignment;
    if (phaseObj.teamBuilding !== undefined) return GamePhase.TeamBuilding;
    if (phaseObj.voting !== undefined) return GamePhase.Voting;
    if (phaseObj.quest !== undefined) return GamePhase.Quest;
    if (phaseObj.assassination !== undefined) return GamePhase.Assassination;
    if (phaseObj.ended !== undefined) return GamePhase.Ended;
    return GamePhase.Lobby;
  }

  /**
   * Get proposed team for current quest
   */
  async getProposedTeam(gamePDA: PublicKey): Promise<PublicKey[]> {
    const gameState = await this.getGameState(gamePDA);
    const currentQuest = gameState.currentQuest;
    const quest = gameState.quests[currentQuest];
    
    if (!quest || !quest.proposedTeam) {
      return [];
    }

    return quest.proposedTeam
      .filter((member: any) => member !== null && member !== undefined)
      .map((member: any) => {
        // Handle both PublicKey objects and pubkey properties
        if (member.pubkey) {
          return new PublicKey(member.pubkey);
        }
        return new PublicKey(member);
      });
  }

  /**
   * Get all players in the game
   */
  async getPlayers(gamePDA: PublicKey): Promise<PublicKey[]> {
    const gameState = await this.getGameState(gamePDA);
    if (!gameState.players) {
      return [];
    }

    return gameState.players
      .filter((p: any) => p !== null && p !== undefined)
      .map((p: any) => {
        if (p.pubkey) {
          return new PublicKey(p.pubkey);
        }
        return new PublicKey(p);
      });
  }

  // ==================== Strategy Helpers ====================

  /**
   * Decide whether to approve a team (AI strategy)
   */
  shouldApproveTeam(team: string[], questNumber: number, failedQuests: number): boolean {
    if (!this.roleInfo) {
      // No role info, use heuristics
      return true;
    }

    const teamSize = team.length;
    
    if (this.isEvil) {
      // Evil strategy: approve teams with evil players on them
      const knownEvilOnTeam = team.filter((p) => this.knownPlayers.includes(p));
      return knownEvilOnTeam.length > 0;
    } else {
      // Good strategy: be cautious
      // If we know someone is evil and they're on the team, reject
      const knownEvilOnTeam = team.filter((p) => this.knownPlayers.includes(p));
      if (knownEvilOnTeam.length > 0) {
        return false;
      }
      
      // For later quests, be more selective
      if (questNumber >= 3 && failedQuests >= 1) {
        // Only approve if we trust the leader
        return Math.random() > 0.3; // Replace with actual trust logic
      }
      
      return true;
    }
  }

  /**
   * Decide quest vote (only evil can fail)
   */
  shouldFailQuest(questNumber: number, teamSize: number): boolean {
    if (!this.isEvil) {
      return false; // Good must succeed
    }

    // Evil strategy: fail when beneficial
    // Early quests: sometimes succeed to gain trust
    // Later quests: more likely to fail
    const failProbability = questNumber >= 3 ? 0.8 : 0.4;
    return Math.random() < failProbability;
  }

  /**
   * Decide assassination target (assassin only)
   */
  chooseAssassinationTarget(players: string[]): string | null {
    if (this.myRole !== Role.Assassin) {
      return null;
    }

    // Strategy: If we have info about Merlin, target them
    // Otherwise, target the player who seems most knowledgeable
    // For now, random choice among non-evil
    const nonKnownEvil = players.filter((p) => !this.knownPlayers.includes(p));
    if (nonKnownEvil.length > 0) {
      return nonKnownEvil[Math.floor(Math.random() * nonKnownEvil.length)];
    }
    
    return players[Math.floor(Math.random() * players.length)];
  }
}

// Export types and utilities
export { PublicKey, Keypair, BN };
export default AvalonAgent;
