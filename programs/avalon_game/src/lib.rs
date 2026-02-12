use anchor_lang::prelude::*;
use anchor_lang::solana_program::hash::hash;

// Program ID - will be updated after deployment
declare_id!("AvalonGame111111111111111111111111111111111");

/// Maximum players in a game
pub const MAX_PLAYERS: usize = 10;
/// Minimum players to start
pub const MIN_PLAYERS: usize = 5;
/// Number of quests in a game
pub const NUM_QUESTS: usize = 5;

/// Game phases
#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, Debug, PartialEq)]
pub enum GamePhase {
    Lobby,           // Waiting for players
    RoleAssignment,  // Roles assigned, not yet revealed
    TeamBuilding,    // Leader proposing team
    Voting,          // Players voting on team
    Quest,           // Quest in progress
    Assassination,   // Evil trying to assassinate Merlin
    Ended,           // Game over
}

/// Player roles
#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, Debug, PartialEq)]
pub enum Role {
    Unknown,     // Not yet revealed
    Merlin,      // Good, knows evil
    Percival,    // Good, sees Merlin/Morgana
    Servant,     // Good, normal
    Morgana,     // Evil, appears as Merlin to Percival
    Assassin,    // Evil, can kill Merlin
    Minion,      // Evil, normal
}

/// Team alignment
#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, Debug, PartialEq)]
pub enum Alignment {
    Unknown,
    Good,
    Evil,
}

/// Quest state
#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, Debug, Default)]
pub struct QuestState {
    pub required_players: u8,
    pub fail_required: u8,  // Number of fails needed (1 for most, 2 for quest 4 with 7+ players)
    pub proposed_team: [Option<Pubkey>; MAX_PLAYERS],
    pub team_size: u8,
    pub votes: [Option<bool>; MAX_PLAYERS],  // true = approve, false = reject
    pub quest_votes: [Option<bool>; MAX_PLAYERS],  // true = success, false = fail (only evil can fail)
    pub passed: Option<bool>,  // None = not resolved yet
    pub vote_attempts: u8,  // How many voting rounds for this quest
}

/// Player state
#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, Debug, Default)]
pub struct PlayerState {
    pub pubkey: Pubkey,
    pub role: Role,
    pub alignment: Alignment,
    pub is_ready: bool,
    pub team_votes_cast: u8,
    pub quests_participated: u8,
}

/// Game state account
#[account]
pub struct GameState {
    pub game_id: u64,
    pub creator: Pubkey,
    pub phase: GamePhase,
    pub players: [Option<PlayerState>; MAX_PLAYERS],
    pub player_count: u8,
    pub current_quest: u8,  // 0-4
    pub quests: [QuestState; NUM_QUESTS],
    pub leader_index: u8,
    pub successful_quests: u8,
    pub failed_quests: u8,
    pub winner: Option<Alignment>,  // None = game ongoing
    pub created_at: i64,
    pub last_action_at: i64,
    pub vrf_seed: [u8; 32],  // Randomness seed for role assignment
    pub roles_commitment: [u8; 32],  // Merkle root of role assignments
    pub bump: u8,
}

impl GameState {
    pub const LEN: usize = 8 +  // discriminator
        8 +   // game_id
        32 +  // creator
        1 +   // phase
        (1 + (32 + 1 + 1 + 1 + 1 + 1)) * MAX_PLAYERS + 1 +  // players (Option tag + PlayerState)
        1 +   // player_count
        1 +   // current_quest
        (1 + MAX_PLAYERS * (1 + 32) + 1 + (1 + 1) * MAX_PLAYERS + (1 + 1) * MAX_PLAYERS + 1 + 1 + 1) * NUM_QUESTS +  // quests
        1 +   // leader_index
        1 +   // successful_quests
        1 +   // failed_quests
        1 + 1 +  // winner (Option + Alignment)
        8 +   // created_at
        8 +   // last_action_at
        32 +  // vrf_seed
        32 +  // roles_commitment
        1;    // bump
}

/// Player role account (stores private role info)
#[account]
pub struct PlayerRole {
    pub game_id: u64,
    pub player: Pubkey,
    pub role: Role,
    pub alignment: Alignment,
    pub known_players: [Option<Pubkey>; MAX_PLAYERS],  // Players this player knows about
    pub bump: u8,
}

impl PlayerRole {
    pub const LEN: usize = 8 +  // discriminator
        8 +   // game_id
        32 +  // player
        1 +   // role
        1 +   // alignment
        (1 + 32) * MAX_PLAYERS +  // known_players
        1;    // bump
}

#[program]
pub mod avalon_game {
    use super::*;

    /// Create a new game lobby
    pub fn create_game(ctx: Context<CreateGame>, game_id: u64) -> Result<()> {
        let game = &mut ctx.accounts.game_state;
        let clock = Clock::get()?;
        
        game.game_id = game_id;
        game.creator = ctx.accounts.creator.key();
        game.phase = GamePhase::Lobby;
        game.player_count = 0;
        game.current_quest = 0;
        game.leader_index = 0;
        game.successful_quests = 0;
        game.failed_quests = 0;
        game.winner = None;
        game.created_at = clock.unix_timestamp;
        game.last_action_at = clock.unix_timestamp;
        game.vrf_seed = [0; 32];
        game.roles_commitment = [0; 32];
        game.bump = ctx.bumps.game_state;
        
        // Initialize quests based on player count (will be set properly when game starts)
        for i in 0..NUM_QUESTS {
            game.quests[i] = QuestState::default();
        }

        msg!("Game {} created by {}", game_id, ctx.accounts.creator.key());
        Ok(())
    }

    /// Join an existing game
    pub fn join_game(ctx: Context<JoinGame>) -> Result<()> {
        let game = &mut ctx.accounts.game_state;
        let player = ctx.accounts.player.key();
        
        require!(game.phase == GamePhase::Lobby, AvalonError::GameNotInLobby);
        require!(game.player_count < MAX_PLAYERS as u8, AvalonError::GameFull);
        
        // Check player not already in game
        for i in 0..game.player_count as usize {
            if let Some(p) = game.players[i] {
                require!(p.pubkey != player, AvalonError::PlayerAlreadyInGame);
            }
        }
        
        let idx = game.player_count as usize;
        game.players[idx] = Some(PlayerState {
            pubkey: player,
            role: Role::Unknown,
            alignment: Alignment::Unknown,
            is_ready: false,
            team_votes_cast: 0,
            quests_participated: 0,
        });
        game.player_count += 1;
        
        let clock = Clock::get()?;
        game.last_action_at = clock.unix_timestamp;
        
        msg!("Player {} joined game {}", player, game.game_id);
        Ok(())
    }

    /// Start the game (creator only, min players required)
    pub fn start_game(ctx: Context<StartGame>, vrf_seed: [u8; 32], roles_commitment: [u8; 32]) -> Result<()> {
        let game = &mut ctx.accounts.game_state;
        
        require!(game.creator == ctx.accounts.creator.key(), AvalonError::NotCreator);
        require!(game.phase == GamePhase::Lobby, AvalonError::GameNotInLobby);
        require!(game.player_count >= MIN_PLAYERS as u8, AvalonError::NotEnoughPlayers);
        
        game.phase = GamePhase::RoleAssignment;
        game.vrf_seed = vrf_seed;
        game.roles_commitment = roles_commitment;
        
        // Set up quests based on player count
        setup_quests(game)?;
        
        let clock = Clock::get()?;
        game.last_action_at = clock.unix_timestamp;
        
        msg!("Game {} started with {} players", game.game_id, game.player_count);
        msg!("VRF Seed: {:?}", vrf_seed);
        msg!("Roles Commitment: {:?}", roles_commitment);
        
        Ok(())
    }

    /// Submit a role reveal (player proves their role via merkle proof)
    pub fn submit_role_reveal(
        ctx: Context<SubmitRoleReveal>,
        role: Role,
        alignment: Alignment,
        merkle_proof: Vec<[u8; 32]>,
    ) -> Result<()> {
        let game = &mut ctx.accounts.game_state;
        let player_role = &mut ctx.accounts.player_role;
        let player = ctx.accounts.player.key();
        
        require!(game.phase == GamePhase::RoleAssignment, AvalonError::WrongPhase);
        
        // Verify merkle proof
        let leaf = hash_role_leaf(&player, &role, &alignment, game.vrf_seed);
        let computed_root = compute_merkle_root(leaf, &merkle_proof);
        require!(computed_root == game.roles_commitment, AvalonError::InvalidMerkleProof);
        
        // Find player in game
        let mut player_idx = None;
        for i in 0..game.player_count as usize {
            if let Some(p) = game.players[i] {
                if p.pubkey == player {
                    player_idx = Some(i);
                    break;
                }
            }
        }
        require!(player_idx.is_some(), AvalonError::PlayerNotInGame);
        
        let idx = player_idx.unwrap();
        game.players[idx].as_mut().unwrap().role = role;
        game.players[idx].as_mut().unwrap().alignment = alignment;
        
        // Set up player role account
        player_role.game_id = game.game_id;
        player_role.player = player;
        player_role.role = role;
        player_role.alignment = alignment;
        player_role.bump = ctx.bumps.player_role;
        
        // Determine which players this player knows
        player_role.known_players = determine_known_players(game, idx, role, alignment);
        
        // Check if all players have revealed
        let all_revealed = game.players.iter().take(game.player_count as usize).all(|p| {
            p.as_ref().map_or(false, |player| player.role != Role::Unknown)
        });
        
        if all_revealed {
            game.phase = GamePhase::TeamBuilding;
        }
        
        let clock = Clock::get()?;
        game.last_action_at = clock.unix_timestamp;
        
        msg!("Player {} revealed role {:?}", player, role);
        Ok(())
    }

    /// Propose a team for the current quest (leader only)
    pub fn propose_team(ctx: Context<ProposeTeam>, team: Vec<Pubkey>) -> Result<()> {
        let game = &mut ctx.accounts.game_state;
        let player = ctx.accounts.player.key();
        
        require!(game.phase == GamePhase::TeamBuilding, AvalonError::WrongPhase);
        
        // Find player index
        let player_idx = find_player_index(game, &player)?;
        require!(player_idx == game.leader_index as usize, AvalonError::NotLeader);
        
        // Validate team size
        let quest = &game.quests[game.current_quest as usize];
        require!(team.len() == quest.required_players as usize, AvalonError::InvalidTeamSize);
        
        // Validate all team members are in game
        for member in &team {
            require!(find_player_index(game, member).is_ok(), AvalonError::PlayerNotInGame);
        }
        
        // Store proposed team
        let current_quest = game.current_quest as usize;
        game.quests[current_quest].team_size = team.len() as u8;
        for (i, member) in team.iter().enumerate() {
            game.quests[current_quest].proposed_team[i] = Some(*member);
        }
        
        game.phase = GamePhase::Voting;
        
        let clock = Clock::get()?;
        game.last_action_at = clock.unix_timestamp;
        
        msg!("Quest {} team proposed: {:?}", game.current_quest, team);
        Ok(())
    }

    /// Vote on proposed team
    pub fn vote_team(ctx: Context<VoteTeam>, approve: bool) -> Result<()> {
        let game = &mut ctx.accounts.game_state;
        let player = ctx.accounts.player.key();
        
        require!(game.phase == GamePhase::Voting, AvalonError::WrongPhase);
        
        let player_idx = find_player_index(game, &player)?;
        let current_quest = game.current_quest as usize;
        
        // Check if already voted
        require!(game.quests[current_quest].votes[player_idx].is_none(), AvalonError::AlreadyVoted);
        
        game.quests[current_quest].votes[player_idx] = Some(approve);
        
        // Check if all players have voted
        let all_voted = (0..game.player_count as usize).all(|i| {
            game.quests[current_quest].votes[i].is_some()
        });
        
        if all_voted {
            // Count votes
            let approve_count = game.quests[current_quest].votes.iter()
                .filter(|&&v| v == Some(true))
                .count();
            let reject_count = game.player_count as usize - approve_count;
            
            if approve_count > reject_count {
                // Team approved, move to quest phase
                game.phase = GamePhase::Quest;
                msg!("Team approved! Moving to quest phase.");
            } else {
                // Team rejected, increment attempt and try again
                game.quests[current_quest].vote_attempts += 1;
                
                // Check for 5th rejection (evil wins)
                if game.quests[current_quest].vote_attempts >= 5 {
                    game.winner = Some(Alignment::Evil);
                    game.phase = GamePhase::Ended;
                    msg!("5th team rejection! Evil wins!");
                } else {
                    // Clear votes and move to next leader
                    for i in 0..MAX_PLAYERS {
                        game.quests[current_quest].votes[i] = None;
                    }
                    game.leader_index = (game.leader_index + 1) % game.player_count;
                    game.phase = GamePhase::TeamBuilding;
                    msg!("Team rejected. Attempt {} of 5", game.quests[current_quest].vote_attempts);
                }
            }
        }
        
        let clock = Clock::get()?;
        game.last_action_at = clock.unix_timestamp;
        
        msg!("Player {} voted {}", player, if approve { "approve" } else { "reject" });
        Ok(())
    }

    /// Submit quest vote (success or fail)
    pub fn submit_quest_vote(ctx: Context<SubmitQuestVote>, success: bool) -> Result<()> {
        let game = &mut ctx.accounts.game_state;
        let player = ctx.accounts.player.key();
        let player_role = &ctx.accounts.player_role;
        
        require!(game.phase == GamePhase::Quest, AvalonError::WrongPhase);
        
        let player_idx = find_player_index(game, &player)?;
        let current_quest = game.current_quest as usize;
        
        // Check player is on the team
        let mut on_team = false;
        for i in 0..game.quests[current_quest].team_size as usize {
            if game.quests[current_quest].proposed_team[i] == Some(player) {
                on_team = true;
                break;
            }
        }
        require!(on_team, AvalonError::NotOnTeam);
        
        // Check not already voted
        require!(game.quests[current_quest].quest_votes[player_idx].is_none(), AvalonError::AlreadyVoted);
        
        // Good players must vote success
        if player_role.alignment == Alignment::Good && !success {
            return Err(AvalonError::GoodMustSucceed.into());
        }
        
        game.quests[current_quest].quest_votes[player_idx] = Some(success);
        
        // Check if all team members have voted
        let team_votes: Vec<bool> = (0..game.player_count as usize)
            .filter(|&i| {
                (0..game.quests[current_quest].team_size as usize).any(|j| {
                    game.quests[current_quest].proposed_team[j] == game.players[i].map(|p| p.pubkey)
                })
            })
            .filter_map(|i| game.quests[current_quest].quest_votes[i])
            .collect();
        
        if team_votes.len() == game.quests[current_quest].team_size as usize {
            // All voted, resolve quest
            resolve_quest(game)?;
        }
        
        let clock = Clock::get()?;
        game.last_action_at = clock.unix_timestamp;
        
        msg!("Player {} voted {} on quest", player, if success { "success" } else { "fail" });
        Ok(())
    }

    /// Assassin attempts to kill Merlin
    pub fn assassin_guess(ctx: Context<AssassinGuess>, target: Pubkey) -> Result<()> {
        let game = &mut ctx.accounts.game_state;
        let assassin = ctx.accounts.assassin.key();
        
        require!(game.phase == GamePhase::Assassination, AvalonError::WrongPhase);
        
        // Verify assassin
        let assassin_idx = find_player_index(game, &assassin)?;
        require!(game.players[assassin_idx].as_ref().unwrap().role == Role::Assassin, AvalonError::NotAssassin);
        
        // Find target
        let target_idx = find_player_index(game, &target)?;
        let target_role = game.players[target_idx].as_ref().unwrap().role;
        
        if target_role == Role::Merlin {
            game.winner = Some(Alignment::Evil);
            msg!("Assassin killed Merlin! Evil wins!");
        } else {
            game.winner = Some(Alignment::Good);
            msg!("Assassin missed! Good wins!");
        }
        
        game.phase = GamePhase::Ended;
        
        let clock = Clock::get()?;
        game.last_action_at = clock.unix_timestamp;
        
        Ok(())
    }

    /// Advance phase manually (for timeouts/debugging)
    pub fn advance_phase(ctx: Context<AdvancePhase>) -> Result<()> {
        let game = &mut ctx.accounts.game_state;
        
        // Only creator or any player can advance after timeout
        // For MVP, we'll allow anyone to advance
        
        match game.phase {
            GamePhase::RoleAssignment => {
                // Force move to team building even if not all revealed
                game.phase = GamePhase::TeamBuilding;
            }
            GamePhase::TeamBuilding => {
                // Skip to next leader
                game.leader_index = (game.leader_index + 1) % game.player_count;
            }
            _ => {}
        }
        
        let clock = Clock::get()?;
        game.last_action_at = clock.unix_timestamp;
        
        msg!("Phase advanced to {:?}", game.phase);
        Ok(())
    }
}

// Context structs
#[derive(Accounts)]
#[instruction(game_id: u64)]
pub struct CreateGame<'info> {
    #[account(mut)]
    pub creator: Signer<'info>,
    
    #[account(
        init,
        payer = creator,
        space = GameState::LEN,
        seeds = [b"game", game_id.to_le_bytes().as_ref()],
        bump
    )]
    pub game_state: Account<'info, GameState>,
    
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct JoinGame<'info> {
    #[account(mut)]
    pub player: Signer<'info>,
    
    #[account(mut)]
    pub game_state: Account<'info, GameState>,
    
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct StartGame<'info> {
    #[account(mut)]
    pub creator: Signer<'info>,
    
    #[account(mut, has_one = creator)]
    pub game_state: Account<'info, GameState>,
}

#[derive(Accounts)]
#[instruction(role: Role, alignment: Alignment)]
pub struct SubmitRoleReveal<'info> {
    #[account(mut)]
    pub player: Signer<'info>,
    
    #[account(mut)]
    pub game_state: Account<'info, GameState>,
    
    #[account(
        init,
        payer = player,
        space = PlayerRole::LEN,
        seeds = [b"player_role", game_state.key().as_ref(), player.key().as_ref()],
        bump
    )]
    pub player_role: Account<'info, PlayerRole>,
    
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct ProposeTeam<'info> {
    #[account(mut)]
    pub player: Signer<'info>,
    
    #[account(mut)]
    pub game_state: Account<'info, GameState>,
}

#[derive(Accounts)]
pub struct VoteTeam<'info> {
    #[account(mut)]
    pub player: Signer<'info>,
    
    #[account(mut)]
    pub game_state: Account<'info, GameState>,
}

#[derive(Accounts)]
pub struct SubmitQuestVote<'info> {
    #[account(mut)]
    pub player: Signer<'info>,
    
    #[account(mut)]
    pub game_state: Account<'info, GameState>,
    
    #[account(
        seeds = [b"player_role", game_state.key().as_ref(), player.key().as_ref()],
        bump = player_role.bump,
    )]
    pub player_role: Account<'info, PlayerRole>,
}

#[derive(Accounts)]
pub struct AssassinGuess<'info> {
    #[account(mut)]
    pub assassin: Signer<'info>,
    
    #[account(mut)]
    pub game_state: Account<'info, GameState>,
}

#[derive(Accounts)]
pub struct AdvancePhase<'info> {
    #[account(mut)]
    pub caller: Signer<'info>,
    
    #[account(mut)]
    pub game_state: Account<'info, GameState>,
}

// Error codes
#[error_code]
pub enum AvalonError {
    #[msg("Game is not in lobby phase")]
    GameNotInLobby,
    #[msg("Game is full")]
    GameFull,
    #[msg("Player already in game")]
    PlayerAlreadyInGame,
    #[msg("Not enough players to start")]
    NotEnoughPlayers,
    #[msg("Only creator can perform this action")]
    NotCreator,
    #[msg("Game is not in the correct phase")]
    WrongPhase,
    #[msg("Invalid merkle proof")]
    InvalidMerkleProof,
    #[msg("Player not in game")]
    PlayerNotInGame,
    #[msg("Not the team leader")]
    NotLeader,
    #[msg("Invalid team size")]
    InvalidTeamSize,
    #[msg("Already voted")]
    AlreadyVoted,
    #[msg("Not on the quest team")]
    NotOnTeam,
    #[msg("Good players must vote success")]
    GoodMustSucceed,
    #[msg("Not the assassin")]
    NotAssassin,
}

// Helper functions
fn setup_quests(game: &mut GameState) -> Result<()> {
    let player_count = game.player_count;
    
    // Quest requirements based on player count
    let (team_sizes, fail_required) = match player_count {
        5 => ([2u8, 3, 2, 3, 3], [1u8, 1, 1, 1, 1]),
        6 => ([2u8, 3, 4, 3, 4], [1u8, 1, 1, 1, 1]),
        7 => ([2u8, 3, 3, 4, 4], [1u8, 1, 1, 2, 1]),
        8 => ([3u8, 4, 4, 5, 5], [1u8, 1, 1, 2, 1]),
        9 => ([3u8, 4, 4, 5, 5], [1u8, 1, 1, 2, 1]),
        10 => ([3u8, 4, 4, 5, 5], [1u8, 1, 1, 2, 1]),
        _ => return Err(AvalonError::NotEnoughPlayers.into()),
    };
    
    for i in 0..NUM_QUESTS {
        game.quests[i].required_players = team_sizes[i];
        game.quests[i].fail_required = fail_required[i];
    }
    
    Ok(())
}

fn find_player_index(game: &GameState, player: &Pubkey) -> Result<usize> {
    for i in 0..game.player_count as usize {
        if let Some(p) = game.players[i] {
            if p.pubkey == *player {
                return Ok(i);
            }
        }
    }
    Err(AvalonError::PlayerNotInGame.into())
}

fn resolve_quest(game: &mut GameState) -> Result<()> {
    let current_quest = game.current_quest as usize;
    let quest = &game.quests[current_quest];
    
    // Count fails
    let fail_count = quest.quest_votes.iter()
        .filter(|&&v| v == Some(false))
        .count() as u8;
    
    let quest_passed = fail_count < quest.fail_required;
    game.quests[current_quest].passed = Some(quest_passed);
    
    if quest_passed {
        game.successful_quests += 1;
        msg!("Quest {} succeeded! ({} fails)", current_quest + 1, fail_count);
    } else {
        game.failed_quests += 1;
        msg!("Quest {} failed! ({} fails)", current_quest + 1, fail_count);
    }
    
    // Check win conditions
    if game.successful_quests >= 3 {
        // Good wins the quests, but evil gets a chance to assassinate Merlin
        game.phase = GamePhase::Assassination;
        msg!("Good has won 3 quests! Assassination phase begins.");
    } else if game.failed_quests >= 3 {
        game.winner = Some(Alignment::Evil);
        game.phase = GamePhase::Ended;
        msg!("Evil has won 3 quests! Evil wins!");
    } else {
        // Next quest
        game.current_quest += 1;
        game.leader_index = (game.leader_index + 1) % game.player_count;
        game.phase = GamePhase::TeamBuilding;
        
        // Clear next quest state
        let next_quest = game.current_quest as usize;
        for i in 0..MAX_PLAYERS {
            game.quests[next_quest].votes[i] = None;
            game.quests[next_quest].quest_votes[i] = None;
        }
    }
    
    Ok(())
}

fn determine_known_players(
    game: &GameState,
    player_idx: usize,
    role: Role,
    alignment: Alignment,
) -> [Option<Pubkey>; MAX_PLAYERS] {
    let mut known = [None; MAX_PLAYERS];
    let mut known_count = 0;
    
    match role {
        Role::Merlin => {
            // Merlin sees all evil except Mordred (not in this version, so all evil)
            for i in 0..game.player_count as usize {
                if let Some(p) = game.players[i] {
                    if p.alignment == Alignment::Evil {
                        known[known_count] = Some(p.pubkey);
                        known_count += 1;
                    }
                }
            }
        }
        Role::Percival => {
            // Percival sees Merlin and Morgana (but doesn't know which is which)
            for i in 0..game.player_count as usize {
                if let Some(p) = game.players[i] {
                    if p.role == Role::Merlin || p.role == Role::Morgana {
                        known[known_count] = Some(p.pubkey);
                        known_count += 1;
                    }
                }
            }
        }
        Role::Morgana | Role::Assassin | Role::Minion => {
            // Evil sees other evil
            for i in 0..game.player_count as usize {
                if let Some(p) = game.players[i] {
                    if p.alignment == Alignment::Evil && i != player_idx {
                        known[known_count] = Some(p.pubkey);
                        known_count += 1;
                    }
                }
            }
        }
        _ => {}
    }
    
    known
}

fn hash_role_leaf(player: &Pubkey, role: &Role, alignment: &Alignment, vrf_seed: [u8; 32]) -> [u8; 32] {
    let mut data = Vec::new();
    data.extend_from_slice(&player.to_bytes());
    data.push(*role as u8);
    data.push(*alignment as u8);
    data.extend_from_slice(&vrf_seed);
    hash(&data).to_bytes()
}

fn compute_merkle_root(leaf: [u8; 32], proof: &[[u8; 32]]) -> [u8; 32] {
    let mut current = leaf;
    for &sibling in proof {
        let mut combined = Vec::new();
        if current <= sibling {
            combined.extend_from_slice(&current);
            combined.extend_from_slice(&sibling);
        } else {
            combined.extend_from_slice(&sibling);
            combined.extend_from_slice(&current);
        }
        current = hash(&combined).to_bytes();
    }
    current
}
