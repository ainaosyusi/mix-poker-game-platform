# Mix Poker App - Version History

## Current Version: v0.3.6

---

## Changelog

### v0.3.6 (2026-01-16)
- **Stud Hand Evaluation Fix**
  - Fixed Flush showing wrong high card (e.g., "K-high Flush" instead of "A-high Flush")
  - High card now correctly determined by highest value card, not most frequent
- **Showdown Hand Display Fix**
  - Fixed hands potentially getting mixed up between players during showdown
  - All hand arrays are now deep-copied to prevent reference issues
- **Pot Display Improvement**
  - Central pot now shows only confirmed bets (excluding current round)
  - Current round bets shown in front of each player separately
  - Clearer visual representation of pot vs. in-progress bets
- **Betting Validation Fix**
  - Fixed game freezing when attempting to bet more than stack
  - Invalid action now properly restores player's turn
  - Added client-side validation with alert message
- **Showdown Display Fix**
  - Uncontested wins (all opponents folded) now show "WIN" instead of "SHOWDOWN"
  - Cleaner UI for non-showdown victories
- **All-In Animation Improvements**
  - Added visual glow effect during runout
  - Improved animation timing and feedback
  - Runout state properly tracked on client
- **PLO All-In Auto-Continuation**
  - When one player is all-in and opponent calls, game now auto-runs to showdown
  - No longer requires clicking CHECK after facing an all-in
  - Applies to all game variants (NLH, PLO, etc.)
- **Fixed-Limit Raise Cap Verified**
  - Confirmed 4-bet cap (1 bet + 3 raises) for 3+ players
  - Heads-up exception allows unlimited raising

### v0.3.5 (2026-01-16)
- **Fixed-Limit Betting Bug Fix**
  - Fixed Badugi RAISE showing wrong amount (e.g., "RAISE 10" instead of "RAISE TO 20")
  - Fixed game freezing when clicking fixed-limit RAISE button
  - Now correctly sends additional chips amount to server
- **Stud Improvements**
  - 7th Street now dealt as down card (private to player)
  - Your Hand view shows up/down card indicators (↑/↓) for Stud games
  - Stud ante/bring-in now configurable in settings
- **All-In Runout Animation**
  - When all-in occurs, board cards are dealt with 1.5 second delays
  - Creates realistic suspense like live poker
  - Flop → Turn → River animated separately
- **7-2 Rule Restriction**
  - 7-2 game now only applies to NLH (No-Limit Hold'em)
  - Does not trigger during Mix rotation on other game variants

### v0.3.4 (2026-01-16)
- **Draw Games Implementation (2-7 TD, Badugi)**
  - Full draw/exchange phase with card selection UI
  - Draw phase tracking (`isDrawPhase`, `playersCompletedDraw`)
  - Auto-complete draw for ALL-IN players
  - "Stand Pat" (0 cards) or select cards to discard
- **Hand Evaluation Improvements**
  - Fixed Badugi evaluation display (e.g., "Badugi: A-2-3-4")
  - Fixed 2-7 evaluation display (e.g., "7-5-4-3-2 Low")
  - Client-side evaluator now supports all game variants
- **ALL-IN Logic Fixes**
  - ALL-IN button only shown in No-Limit games
  - No redundant ALL-IN when CALL would be all-in
  - Cannot RAISE when all others are ALL-IN/FOLDED
  - Proper heads-up ALL-IN showdown handling
- **Pot Calculation Fixes**
  - Fixed side pot calculation to include folded players' contributions
  - Fixed Pot-Limit max bet calculation (was double-counting bets)
- **Stud Betting Structure**
  - Bring-in = BB / 5 (e.g., 2 for 5/10 game)
  - Complete = BB (small bet)
  - Big bet = 2 * BB on 5th+ street
- **Game Log Improvements**
  - Removed unnecessary "new hand started" message
  - Only shows wins, entry/exit, and rebuy events
  - Winner's cards displayed as mini cards in log
  - Cleaner log display

### v0.3.3 (2026-01-16)
- **Seating & Room Management**
  - Added `sit-down-success` event for client confirmation
  - Added `leave-room` handler for proper room exit
  - Auto-cleanup of empty rooms (0 players)
  - Fixed potential double-seating bug
- **Rebuy Feature**
  - Players with 0 chips can add more chips during WAITING
  - Rebuy dialog shown when stack = 0
  - Validates against buyInMin/buyInMax limits
- **Hand Rank Display**
  - Your Hand section now shows current hand rank
  - Real-time evaluation as board cards are dealt
  - Supports NLH and PLO variants
- **Razz/Stud Up Cards**
  - Added `studUpCards` to Player type
  - Up cards now visible to all players at table
  - Added "tiny" card size for compact display
- **UI Improvements**
  - Rebuy panel with chip icon and exit option

### v0.3.2 (2026-01-16)
- **Betting Structure Implementation (TDA Rules)**
  - **Pot-Limit (PL)**: Max bet = CurrentPot + (AmountToCall × 2)
  - **Fixed-Limit (FL)**: Small Bet / Big Bet with 5-bet cap (4 raises)
  - Heads-up exception: unlimited raising in FL
  - Server-side validation for all limit types
- **Action Panel Updates**
  - NL/PL/FL badge indicator
  - Fixed-Limit: Single BET/RAISE button with fixed amount
  - Pot-Limit: POT-based quick bet buttons
  - "CAPPED" indicator when betting is capped
  - Raises remaining counter for Fixed-Limit
- **Game State Tracking**
  - Added `raisesThisRound` counter
  - `getBettingInfo()` method for client

### v0.3.1 (2026-01-16)
- **Fold Button Fix**
  - Disabled FOLD button when there's no bet to face (can only CHECK)
  - Poker rules: can only fold when facing a bet
- **Version Display**
  - Added version display to all screens (name input, lobby, table)
  - Created VERSION.md for version history tracking

### v0.3.0 (2026-01-16)
- **Showdown Logic Implementation**
  - Implemented proper showdown order (Last Aggressor first, or position order)
  - Added sequential Show/Muck logic (losers can hide their hands)
  - ALL-IN showdown: all hands forced to reveal (collusion prevention)
  - Added `lastAggressorIndex` tracking
- **Minimum Raise Fix**
  - Fixed minimum raise calculation: 5-10 blinds now correctly show minimum raise TO as 20
  - Server sends correct `minBetTo` to client
- **Action Panel UI Improvement**
  - When facing a bet (RAISE situation): shows 2x, 2.5x, 3x, 4x multiplier buttons
  - When opening (BET situation): shows 1/3, 1/2, 3/4, POT buttons
- **Bug Fix**
  - Fixed bet amount calculation: client now sends additional amount, not total

### v0.2.0 (2026-01-15)
- **Settings Panel**
  - Added game settings UI (blinds, game variant, rotation)
  - Host can configure room settings
- **7-Deuce Rule**
  - Implemented 7-2 rule for Hold'em variants
- **UI Improvements**
  - Added game log panel
  - Improved player seat display

### v0.1.0 (2026-01-14)
- **Initial Release**
  - Basic poker table implementation
  - NLH (No-Limit Hold'em) support
  - PLO (Pot-Limit Omaha) support
  - Room creation and joining
  - Real-time multiplayer via Socket.IO

---

## Planned Features

### v0.4.0 (Planned)
- Draw game support (2-7 Triple Draw, Badugi)
- Stud game support (7CS, Razz)
- Hand history export

### v0.5.0 (Planned)
- Tournament mode
- Multi-table support
- Statistics tracking

---

## Version Format
- **Major.Minor.Patch**
  - Major: Breaking changes or major feature releases
  - Minor: New features, significant improvements
  - Patch: Bug fixes, minor improvements
