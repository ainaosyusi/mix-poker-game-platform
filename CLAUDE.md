# Mix Poker App

## Project Overview
Mix Poker is a multiplayer poker application that supports multiple game variants with rotation functionality. Players can play various poker games (Hold'em, Omaha, Stud, Draw) in a single session. The app uses JWT authentication, preset rooms with auto-seating, and a data-driven game engine.

## Tech Stack
- **Frontend**: React 18 + TypeScript + Vite (port 5173)
- **Backend**: Node.js + Express + Socket.IO (port 3000)
- **Database**: PostgreSQL (Prisma ORM v6)
- **Authentication**: JWT (jsonwebtoken) + bcryptjs
- **Real-time Communication**: Socket.IO (with JWT auth middleware)
- **Styling**: Inline CSS (to avoid TailwindCSS conflicts)
- **Deployment**: Railway (nixpacks)

## Project Structure
```
mix-poker-app/
├── server/                         # Backend (Node.js + Socket.IO)
│   ├── index.ts                    # Express + Socket.IO server, socket handlers, timer management
│   ├── types.ts                    # All type definitions (65 game variants, Player, Room, GameState)
│   ├── GameEngine.ts               # Data-driven game engine (Flop/Stud/Draw unified)
│   ├── Dealer.ts                   # Card dealing (Stud initial/street, Draw exchange, reshuffle)
│   ├── handEvaluator.ts            # Hand evaluation for all variants
│   ├── ShowdownManager.ts          # Showdown (Show/Muck, Hi-Lo split, side pots)
│   ├── ActionValidator.ts          # Player action validation
│   ├── RoomManager.ts              # Multi-room management + preset rooms
│   ├── RotationManager.ts          # Game rotation for mix games
│   ├── MetaGameManager.ts          # Side games (7-2 game etc.)
│   ├── PotManager.ts               # Main pot + side pot calculation
│   ├── gameVariants.ts             # GameVariantConfig definitions (boardPattern, drawRounds)
│   ├── autoSeating.ts              # Auto-seating logic (random empty seat)
│   ├── roomDefinitions.ts          # Preset room definitions (7 rooms)
│   ├── logger.ts                   # JSONL logging
│   ├── auth/
│   │   ├── authService.ts          # Auth logic (register/login/JWT verify)
│   │   ├── authMiddleware.ts       # Express JWT middleware
│   │   └── authRoutes.ts           # Auth REST API endpoints
│   └── prisma/
│       └── schema.prisma           # DB schema (User model)
│
└── client/                         # Frontend (React + Vite)
    └── src/
        ├── App.tsx                 # View routing (auth→mainMenu→roomSelect→table)
        ├── Table.tsx               # Main game table page component
        ├── api.ts                  # REST API helper (JWT-attached fetch)
        ├── handEvaluator.ts        # Client-side hand evaluation
        ├── index.css               # Global CSS
        ├── screens/
        │   ├── AuthScreen.tsx      # Login/Register screen
        │   ├── MainMenu.tsx        # Main menu + account settings
        │   └── RoomSelect.tsx      # Room selection + buy-in dialog
        ├── components/
        │   ├── table/
        │   │   ├── PokerTable.tsx   # Table rendering, community cards
        │   │   └── PotDisplay.tsx   # Pot amount display
        │   ├── player/
        │   │   └── PlayerSeat.tsx   # Player seat with cards, chips, timer
        │   ├── cards/
        │   │   └── Card.tsx         # Card and CommunityCards components
        │   ├── chips/
        │   │   └── ChipStack.tsx    # 3D chip stack display
        │   ├── action/
        │   │   └── ActionPanel.tsx  # Betting action buttons
        │   └── log/
        │       └── GameLog.tsx      # Game event log
        ├── hooks/
        │   └── useTableLayout.ts   # Seat position calculations
        └── types/
            └── table.ts            # TypeScript type definitions
```

## Development Commands
```bash
# Start server (from project root)
cd server && npm run dev

# Start client (from project root)
cd client && npm run dev
```

Required environment variables (`server/.env`):
```
DATABASE_URL=postgresql://...
JWT_SECRET=your-secret-key
```

## App Flow
```
Auth Screen → Main Menu → Room Select (+ buy-in dialog) → Table
```
- No manual seat selection (auto-seating via `quick-join`)
- No manual game start button (auto-start via `scheduleNextHand` after 2s delay)
- Leave table → returns to Main Menu

## Supported Game Variants (8 implemented)
- **NLH** - No-Limit Hold'em (Flop, boardPattern: [3,1,1])
- **PLO** - Pot-Limit Omaha (Flop, 4 hole cards, must use 2)
- **PLO8** - Pot-Limit Omaha Hi-Lo (Flop, Hi-Lo split)
- **7CS** - 7-Card Stud (Stud, Fixed-Limit)
- **7CS8** - 7-Card Stud Hi-Lo (Stud, Fixed-Limit)
- **RAZZ** - Razz (Stud lowball, Fixed-Limit)
- **2-7_TD** - 2-7 Triple Draw (Draw, 3 exchanges, Fixed-Limit)
- **BADUGI** - Badugi (Draw, 3 exchanges, Fixed-Limit)

65 game variant types defined (57 are beta/unimplemented).

## Game Engine Architecture
**Data-driven design**: `GameVariantConfig` in `gameVariants.ts` defines each variant's behavior. `GameEngine.ts` branches on:
- `communityCardType === 'flop'` → `nextFlopStreet()` (boardPattern-driven)
- `communityCardType === 'stud'` → `nextStudStreet()`
- `hasDrawPhase === true` → `nextDrawStreet()`

Key config fields: `boardPattern`, `drawRounds`, `holeCardsForSelection`, `handEvaluation`, `betStructure`

## Showdown System
- **Show/Muck**: Last aggressor shows first; subsequent players muck if they lose
- **All-In**: All hands forced open (anti-collusion)
- **Evaluation methods**: `executeHighShowdown()`, `executeHiLoShowdown()`, `executeRazzShowdown()`, `executeBadugiShowdown()`, `executeDeuce7Showdown()`
- **Side pots**: `eligiblePlayers` per side pot, winners determined per pot

## Preset Rooms (7 rooms)
| ID | Name | Category | Blinds | Buy-in |
|----|------|----------|--------|--------|
| nlh-1-2 | NLH 1/2 | nlh | 1/2 | 40-200 |
| nlh-2-5 | NLH 2/5 | nlh | 2/5 | 100-500 |
| nlh-5-10 | NLH 5/10 | nlh | 5/10 | 200-1000 |
| mix-plo | PLO Mix | mix | 2/5 | 100-500 |
| mix-8game | 8-Game Mix | mix | 2/5 | 100-500 |
| mix-10game | 10-Game Mix | mix | 2/5 | 100-500 |
| mix-10game-plus | 10-Game+ Mix | mix | 2/5 | 100-500 |

## Key Features
- JWT authentication (7-day expiry, permissive Socket.IO - guests allowed)
- 6-max table support
- Timer system (30 seconds per action)
- Time bank chips (5 chips per player, 30s each)
- Game rotation (mix games mode, 8 hands per game)
- Auto fold/check for disconnected players
- Card deal animations for flop/turn/river
- Show/Muck system with showdown order
- Side pot calculation and distribution
- Fixed-Limit support (Small/Big Bet, 5-bet cap)
- Stud bring-in and board-based action order
- Draw card exchange with deck reshuffle

## UI Design Notes
- Cards displayed above player name tags (overlapping style)
- Chips positioned toward table center based on seat position
- Dealer button on table surface (not on avatar)
- Hand rank displayed below player's name tag
- Minimal showdown notification (no blue screen)
- Top player cards displayed below name tag (to avoid header overlap)
- Empty seats show "Empty" text (not clickable)

## Game Flow
**Flop games**: PREFLOP → FLOP → TURN → RIVER → SHOWDOWN
**Stud games**: 3RD_STREET → 4TH → 5TH → 6TH → 7TH_STREET → SHOWDOWN
**Draw games**: PREDRAW → 1ST_DRAW → 2ND_DRAW → 3RD_DRAW → SHOWDOWN

## REST API
- `POST /api/auth/register` - Create account
- `POST /api/auth/login` - Login (returns JWT)
- `GET /api/auth/me` - Get current user (requires auth)
- `PUT /api/auth/profile` - Update display name / avatar (requires auth)
- `GET /api/health` - Health check

## Notes
- Japanese comments are used in the codebase
- All styling uses inline CSS (avoid CSS classes)
- Server handles timer management and auto-actions
- Client receives timer updates via socket events
- `SPEC.md` contains the comprehensive feature specification document
