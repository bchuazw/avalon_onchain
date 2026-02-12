import { Connection, PublicKey, Keypair, SystemProgram, clusterApiUrl, Transaction, VersionedTransaction } from "@solana/web3.js";
import * as anchor from "@coral-xyz/anchor";
import { Program, AnchorProvider, BN } from "@coral-xyz/anchor";
import { AvalonGame } from "../../target/types/avalon_game";
import { assignRoles, generateMerkleProof, Role, Alignment } from "./roleAssignment";
import * as crypto from "crypto";
import * as fs from "fs";
import * as path from "path";
import dotenv from "dotenv";

dotenv.config();

const NETWORK = process.env.SOLANA_NETWORK || "localnet";
const RPC_URL = process.env.SOLANA_RPC_URL || (NETWORK === "localnet" ? "http://localhost:8899" : clusterApiUrl(NETWORK as any));
const PROGRAM_ID = new PublicKey(process.env.PROGRAM_ID || "8FrTvMZ3VhKzpvMJJfmgwLbnkR9wT97Rni2m8j6bhKr1");

// Load or create wallet
function getWallet(): Keypair {
  const walletPath = process.env.WALLET_PATH || path.join(process.env.HOME || "", ".config", "solana", "id.json");
  
  if (fs.existsSync(walletPath)) {
    const keypairBytes = JSON.parse(fs.readFileSync(walletPath, "utf-8"));
    return Keypair.fromSecretKey(Uint8Array.from(keypairBytes));
  }
  
  // Generate new wallet if not found
  console.log(`[Sim] Wallet not found at ${walletPath}, generating new wallet...`);
  const newWallet = Keypair.generate();
  console.log(`[Sim] New wallet pubkey: ${newWallet.publicKey.toBase58()}`);
  console.log(`[Sim] Please fund this wallet with SOL before running the simulation`);
  return newWallet;
}

async function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Send chat message to spectators via backend API
async function sendChatMessage(
  gameId: string,
  playerIndex: number,
  role: string,
  text: string
): Promise<void> {
  try {
    const backendUrl = process.env.BACKEND_URL || "http://localhost:3000";
    await fetch(`${backendUrl}/chat/${gameId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ playerIndex, role, text }),
    });
  } catch (error) {
    console.warn(`[Sim] Failed to send chat message: ${error}`);
  }
}

async function airdropIfNeeded(connection: Connection, pubkey: PublicKey, amount: number = 2): Promise<void> {
  if (NETWORK !== "localnet") return;
  
  try {
    const balance = await connection.getBalance(pubkey);
    const required = amount * 1e9; // SOL to lamports
    
    if (balance < required) {
      console.log(`[Sim] Airdropping ${amount} SOL to ${pubkey.toBase58().slice(0, 8)}...`);
      const sig = await connection.requestAirdrop(pubkey, required);
      await connection.confirmTransaction(sig, "confirmed");
      console.log(`[Sim] ✓ Airdrop confirmed`);
    }
  } catch (error) {
    console.warn(`[Sim] Airdrop failed (may need manual funding):`, error);
  }
}

interface SimulatedPlayer {
  keypair: Keypair;
  role: Role;
  alignment: Alignment;
  merkleProof: number[][];
}

// Helper function to create a provider for a player
function createPlayerProvider(player: Keypair, connection: Connection, idl: any): Program<AvalonGame> {
  const playerProvider = new AnchorProvider(
    connection,
    {
      publicKey: player.publicKey,
      signTransaction: async <T extends Transaction | VersionedTransaction>(tx: T): Promise<T> => {
        if (tx instanceof Transaction) {
          tx.sign(player);
        }
        return tx;
      },
      signAllTransactions: async <T extends Transaction | VersionedTransaction>(txs: T[]): Promise<T[]> => {
        return txs.map(tx => {
          if (tx instanceof Transaction) {
            tx.sign(player);
          }
          return tx;
        });
      },
    },
    { commitment: "confirmed" }
  );
  
  return new Program(idl, playerProvider) as Program<AvalonGame>;
}

async function runGameSimulation() {
  console.log("=".repeat(70));
  console.log("AVALON GAME SIMULATION");
  console.log("=".repeat(70));
  console.log(`Network: ${NETWORK}`);
  console.log(`RPC: ${RPC_URL}`);
  console.log(`Program: ${PROGRAM_ID.toBase58()}`);
  console.log();
  console.log("⚠️  Make sure:");
  console.log("  1. Backend server is running (npm run dev)");
  console.log("  2. Solana test validator is running (for localnet)");
  console.log("  3. Wallet has sufficient SOL");
  console.log();

  // Setup connection and provider
  const connection = new Connection(RPC_URL, "confirmed");
  const wallet = getWallet();
  const provider = new AnchorProvider(
    connection,
    {
      publicKey: wallet.publicKey,
      signTransaction: async <T extends Transaction | VersionedTransaction>(tx: T): Promise<T> => {
        if (tx instanceof Transaction) {
          tx.sign(wallet);
        } else if ('sign' in tx && typeof (tx as any).sign === 'function') {
          // VersionedTransaction - would need different signing logic
          // For now, just return as-is (shouldn't be used in this context)
        }
        return tx;
      },
      signAllTransactions: async <T extends Transaction | VersionedTransaction>(txs: T[]): Promise<T[]> => {
        return txs.map(tx => {
          if (tx instanceof Transaction) {
            tx.sign(wallet);
          }
          return tx;
        });
      },
    },
    { commitment: "confirmed" }
  );
  anchor.setProvider(provider);

  // Load program
  let idl = JSON.parse(
    fs.readFileSync(path.join(__dirname, "../../target/idl/avalon_game.json"), "utf-8")
  );
  // Force IDL address to match our program ID (in case it's different)
  idl.address = PROGRAM_ID.toBase58();
  console.log(`[Sim] Using Program ID: ${PROGRAM_ID.toBase58()}`);
  console.log(`[Sim] IDL address: ${idl.address}`);
  // Create program - Anchor 0.30.1 uses (idl, provider) and reads program ID from IDL address
  const program = new Program(idl, provider) as Program<AvalonGame>;

  // Airdrop to wallet
  await airdropIfNeeded(connection, wallet.publicKey, 5);

  // Create 5 players
  console.log("🎮 STEP 1: Creating Players");
  console.log("-".repeat(70));
  const players: Keypair[] = [];
  for (let i = 0; i < 5; i++) {
    const player = Keypair.generate();
    players.push(player);
    await airdropIfNeeded(connection, player.publicKey, 2);
    console.log(`  Player ${i + 1}: ${player.publicKey.toBase58().slice(0, 20)}...`);
  }
  console.log();

  // Create game
  console.log("🎮 STEP 2: Creating Game");
  console.log("-".repeat(70));
  const gameId = new BN(Date.now());
  const [gamePDA, gameBump] = PublicKey.findProgramAddressSync(
    [Buffer.from("game"), gameId.toArrayLike(Buffer, "le", 8)],
    PROGRAM_ID
  );

  console.log(`  Game ID: ${gameId.toString()}`);
  console.log(`  Game PDA: ${gamePDA.toBase58()}`);

  await program.methods
    .createGame(gameId)
    .accounts({
      creator: wallet.publicKey,
    })
    .signers([wallet])
    .rpc();

  console.log(`  ✓ Game created`);
  await sleep(1000);
  console.log();

  // Players join
  console.log("🎮 STEP 3: Players Joining");
  console.log("-".repeat(70));
  for (let i = 0; i < players.length; i++) {
    const playerProgram = createPlayerProvider(players[i], connection, idl);
    
    await playerProgram.methods
      .joinGame()
      .accounts({
        player: players[i].publicKey,
        gameState: gamePDA,
      })
      .rpc();

    console.log(`  ✓ Player ${i + 1} joined`);
    await sleep(500);
  }
  console.log();

  // Generate VRF seed and assign roles
  console.log("🎭 STEP 4: Assigning Roles");
  console.log("-".repeat(70));
  const vrfSeed = crypto.randomBytes(32);
  const playerPubkeys = players.map(p => p.publicKey);
  const assignment = assignRoles(playerPubkeys, vrfSeed);

  console.log("  Role Distribution:");
  assignment.players.forEach((p, i) => {
    const roleName = Role[p.role];
    const alignmentName = Alignment[p.alignment];
    const emoji = alignmentName === "Good" ? "🟢" : "🔴";
    console.log(`    ${emoji} Player ${i + 1}: ${roleName} (${alignmentName})`);
  });
  console.log(`  Merkle Root: ${assignment.merkleRoot.toString("hex").slice(0, 20)}...`);
  console.log();

  // Start game
  console.log("🎮 STEP 5: Starting Game");
  console.log("-".repeat(70));
  await program.methods
    .startGame(Array.from(vrfSeed), Array.from(assignment.merkleRoot))
    .accounts({
      creator: wallet.publicKey,
      gameState: gamePDA,
    })
    .signers([wallet])
    .rpc();

  console.log(`  ✓ Game started`);
  await sleep(1000);
  console.log();

  // Players reveal roles
  console.log("📬 STEP 6: Players Revealing Roles");
  console.log("-".repeat(70));
  const simulatedPlayers: SimulatedPlayer[] = [];

  for (let i = 0; i < players.length; i++) {
    const player = players[i];
    const playerRole = assignment.players[i];
    const roleName = Role[playerRole.role];
    const alignmentName = Alignment[playerRole.alignment];

    const [playerRolePDA] = PublicKey.findProgramAddressSync(
      [
        Buffer.from("player_role"),
        gamePDA.toBuffer(),
        player.publicKey.toBuffer(),
      ],
      PROGRAM_ID
    );

    const merkleProof = generateMerkleProof(assignment, i, vrfSeed);

    // Convert role and alignment to Anchor enum format
    // Anchor expects lowercase first letter: merlin, percival, etc.
    const roleEnum: any = {};
    const roleKey = roleName.charAt(0).toLowerCase() + roleName.slice(1);
    roleEnum[roleKey] = {};

    const alignmentEnum: any = {};
    const alignmentKey = alignmentName.charAt(0).toLowerCase() + alignmentName.slice(1);
    alignmentEnum[alignmentKey] = {};

    const merkleProofArray = merkleProof.map(p => Array.from(p));

    const playerProgram = createPlayerProvider(player, connection, idl);

    await playerProgram.methods
      .submitRoleReveal(
        roleEnum,
        alignmentEnum,
        merkleProofArray
      )
      .accounts({
        player: player.publicKey,
        gameState: gamePDA,
        playerRole: playerRolePDA,
      } as any)
      .rpc();

    simulatedPlayers.push({
      keypair: player,
      role: playerRole.role,
      alignment: playerRole.alignment,
      merkleProof: merkleProofArray,
    });

    console.log(`  ✓ Player ${i + 1} revealed: ${roleName} (${alignmentName})`);
    await sleep(500);
  }
  console.log();

  // Get game state to check current quest
  let gameState = await program.account.gameState.fetch(gamePDA);
  console.log(`  Current Phase: ${JSON.stringify(gameState.phase)}`);
  console.log(`  Current Quest: ${gameState.currentQuest}`);
  console.log();

  // Simulate game flow through quests
  console.log("🎮 STEP 7: Simulating Game Flow");
  console.log("-".repeat(70));

  // Store gameId as string for chat messages
  const gameIdStr = gameId.toString();

  const questTeamSizes = [2, 3, 2, 3, 3]; // For 5 players
  let questAttempts = 0;
  const maxAttempts = 5;

  while (gameState.currentQuest < 5 && questAttempts < maxAttempts) {
    const questNum = gameState.currentQuest;
    const teamSize = questTeamSizes[questNum];
    const leaderIdx = gameState.leaderIndex;

    console.log(`\n  Quest ${questNum + 1} (Team size: ${teamSize})`);
    console.log(`  Leader: Player ${leaderIdx + 1}`);

    // Leader proposes team (select first N players including leader)
    const team: PublicKey[] = [];
    for (let i = 0; i < teamSize; i++) {
      const playerIdx = (leaderIdx + i) % players.length;
      team.push(players[playerIdx].publicKey);
    }

    console.log(`  Proposed team: ${team.map(p => `Player ${players.findIndex(pl => pl.publicKey.equals(p)) + 1}`).join(", ")}`);

    // Propose team
    const leaderProgram = createPlayerProvider(players[leaderIdx], connection, idl);
    await leaderProgram.methods
      .proposeTeam(team)
      .accounts({
        player: players[leaderIdx].publicKey,
        gameState: gamePDA,
      })
      .rpc();

    console.log(`  ✓ Team proposed`);

    // CONVERSATION PHASE: Fixed time for agents to discuss before voting
    const CONVERSATION_DURATION_MS = 30000; // 30 seconds
    const CONVERSATION_MESSAGE_COUNT = 8; // Number of messages during conversation
    const MESSAGE_INTERVAL = CONVERSATION_DURATION_MS / CONVERSATION_MESSAGE_COUNT;

    console.log(`  💬 Conversation phase (${CONVERSATION_DURATION_MS / 1000}s)...`);
    
    // Conversation dialogue templates
    const conversationMessages = [
      "I think this team looks solid.",
      "Hmm, I'm not sure about this selection...",
      "We need to be careful here.",
      "This team should work well together.",
      "I have some concerns about this proposal.",
      "Let's trust the leader's judgment.",
      "We must choose wisely.",
      "Time to make a decision.",
      "I support this team.",
      "Something feels off...",
      "This is a critical moment.",
      "Let's proceed with caution.",
    ];

    // Send conversation messages
    for (let i = 0; i < CONVERSATION_MESSAGE_COUNT; i++) {
      await sleep(MESSAGE_INTERVAL);
      
      // Pick a random player (not necessarily the leader)
      const speakerIdx = Math.floor(Math.random() * players.length);
      const speaker = simulatedPlayers[speakerIdx];
      const roleName = Role[speaker.role];
      const message = conversationMessages[Math.floor(Math.random() * conversationMessages.length)];
      
      await sendChatMessage(gameIdStr, speakerIdx, roleName, message);
    }

    // Wait a bit more to ensure all messages are displayed
    await sleep(2000);
    console.log(`  ✓ Conversation phase ended`);

    // All players vote
    console.log(`  Voting...`);
    let approveVotes = 0;
    let rejectVotes = 0;

    for (let i = 0; i < players.length; i++) {
      // Good players approve, evil players sometimes reject
      const player = simulatedPlayers[i];
      const vote = player.alignment === Alignment.Good || Math.random() > 0.3; // Evil rejects 30% of the time

      const voterProgram = createPlayerProvider(players[i], connection, idl);
      await voterProgram.methods
        .voteTeam(vote)
        .accounts({
          player: players[i].publicKey,
          gameState: gamePDA,
        })
        .rpc();

      // Announce vote as chat message
      const roleName = Role[player.role];
      const voteText = vote 
        ? "I approve this team!" 
        : "I reject this team!";
      await sendChatMessage(gameIdStr, i, roleName, voteText);
      
      // Stagger vote announcements so spectators can read them
      await sleep(1500);

      if (vote) approveVotes++;
      else rejectVotes++;
    }

    console.log(`  Votes: ${approveVotes} approve, ${rejectVotes} reject`);

    // Check if team was approved
    gameState = await program.account.gameState.fetch(gamePDA);
    const phase = JSON.stringify(gameState.phase);

    if (phase.includes("quest")) {
      // Team approved, proceed to quest
      console.log(`  ✓ Team approved, starting quest...`);

      // Quest members vote
      const questVotes: boolean[] = [];
      for (let i = 0; i < team.length; i++) {
        const playerPubkey = team[i];
        const playerIdx = players.findIndex(p => p.publicKey.equals(playerPubkey));
        const player = simulatedPlayers[playerIdx];

        // Only evil can fail quests
        const questVote = player.alignment === Alignment.Good ? true : Math.random() > 0.5; // Evil fails 50% of the time

        // Get player role PDA for quest vote
        const [questPlayerRolePDA] = PublicKey.findProgramAddressSync(
          [
            Buffer.from("player_role"),
            gamePDA.toBuffer(),
            playerPubkey.toBuffer(),
          ],
          PROGRAM_ID
        );

        const questVoterProgram = createPlayerProvider(players[playerIdx], connection, idl);
        await questVoterProgram.methods
          .submitQuestVote(questVote)
          .accounts({
            player: playerPubkey,
            gameState: gamePDA,
            playerRole: questPlayerRolePDA,
          } as any)
          .rpc();

        questVotes.push(questVote);
        await sleep(300);
      }

      const failCount = questVotes.filter(v => !v).length;
      const quest = gameState.quests[questNum];
      const requiredFails = quest.failRequired;
      const questPassed = failCount < requiredFails;

      console.log(`  Quest votes: ${questVotes.filter(v => v).length} success, ${failCount} fail`);
      console.log(`  Quest ${questPassed ? "PASSED" : "FAILED"}`);

      // Advance phase to resolve quest
      await program.methods
        .advancePhase()
        .accounts({
          caller: wallet.publicKey,
          gameState: gamePDA,
        })
        .signers([wallet])
        .rpc();

      await sleep(1000);

      gameState = await program.account.gameState.fetch(gamePDA);
      const newPhase = JSON.stringify(gameState.phase);

      if (newPhase.includes("assassination")) {
        console.log(`\n  🎯 ASSASSINATION PHASE`);
        console.log(`  Evil must guess Merlin...`);

        // Find assassin
        const assassinIdx = simulatedPlayers.findIndex(p => p.role === Role.Assassin);
        const assassin = players[assassinIdx];

        // Find Merlin
        const merlinIdx = simulatedPlayers.findIndex(p => p.role === Role.Merlin);
        const merlin = players[merlinIdx];

        // Assassin guesses (random guess for demo)
        const guess = Math.random() > 0.5 ? merlin.publicKey : players[Math.floor(Math.random() * players.length)].publicKey;
        const correct = guess.equals(merlin.publicKey);

        const assassinProgram = createPlayerProvider(assassin, connection, idl);
        await assassinProgram.methods
          .assassinGuess(guess)
          .accounts({
            assassin: assassin.publicKey,
            gameState: gamePDA,
          })
          .rpc();

        console.log(`  Assassin guessed: ${correct ? "CORRECT (Merlin)" : "WRONG"}`);
        console.log(`  ${correct ? "🔴 EVIL WINS!" : "🟢 GOOD WINS!"}`);

        await sleep(1000);
        break;
      } else if (newPhase.includes("ended")) {
        console.log(`  Game ended!`);
        break;
      } else {
        console.log(`  Moving to next quest...`);
      }
    } else {
      // Team rejected
      console.log(`  ✗ Team rejected, trying again...`);
      questAttempts++;
      await sleep(500);
    }

    await sleep(1000);
  }

  // Final state
  gameState = await program.account.gameState.fetch(gamePDA);
  // Final state
  gameState = await program.account.gameState.fetch(gamePDA);
  console.log("\n" + "=".repeat(70));
  console.log("SIMULATION COMPLETE");
  console.log("=".repeat(70));
  console.log(`Game ID: ${gameId.toString()}`);
  console.log(`Game PDA: ${gamePDA.toBase58()}`);
  console.log(`Final Phase: ${JSON.stringify(gameState.phase)}`);
  console.log(`Successful Quests: ${gameState.successfulQuests}`);
  console.log(`Failed Quests: ${gameState.failedQuests}`);
  console.log(`Winner: ${gameState.winner ? JSON.stringify(gameState.winner) : "None"}`);
  console.log();
  console.log("=".repeat(70));
  console.log("VIEW IN SPECTATOR MODE");
  console.log("=".repeat(70));
  console.log(`1. Open http://localhost:5173`);
  console.log(`2. Click "SPECTATOR" button`);
  console.log(`3. Enter Game ID: ${gameId.toString()}`);
  console.log();
  console.log("The game will appear in the game list automatically");
  console.log("as the indexer picks up the on-chain events.");
  console.log();
}

// Run simulation
runGameSimulation().catch((error) => {
  console.error("Simulation error:", error);
  process.exit(1);
});
