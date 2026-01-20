# Mix Poker App

## Project Overview
Mix Poker is a multiplayer poker application that supports multiple game variants with rotation functionality. Players can play various poker games (Hold'em, Omaha, Stud, Draw) in a single session.

## Tech Stack
- **Frontend**: React + TypeScript + Vite (port 5173)
- **Backend**: Node.js + Express + Socket.IO (port 3000)
- **Real-time Communication**: Socket.IO
- **Styling**: Inline CSS (to avoid TailwindCSS conflicts)

## Project Structure
```
mix-poker-app/
├── server/                    # Backend (Node.js + Socket.IO)
│   ├── index.ts               # Main entry, socket handlers, timer management
│   ├── GameEngine.ts          # Game state machine
│   ├── Dealer.ts              # Card dealing logic
│   ├── handEvaluator.ts       # Hand evaluation for all variants
│   └── ShowdownManager.ts     # Winner determination and pot distribution
│
└── client/                    # Frontend (React + Vite)
    └── src/
        ├── Table.tsx          # Main game table page component
        ├── handEvaluator.ts   # Client-side hand evaluation
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
        │   └── useTableLayout.ts    # Seat position calculations
        └── types/
            └── table.ts             # TypeScript type definitions
```

## Development Commands
```bash
# Start server (from project root)
cd server && npm run dev

# Start client (from project root)
cd client && npm run dev

# View server logs
tail -f /tmp/mix-poker-server.log

# View client logs
tail -f /tmp/mix-poker-client.log
```

## Supported Game Variants
- **NLH** - No-Limit Hold'em
- **PLO** - Pot-Limit Omaha
- **PLO8** - Pot-Limit Omaha Hi-Lo
- **7CS** - 7-Card Stud
- **7CS8** - 7-Card Stud Hi-Lo
- **RAZZ** - Razz (Stud lowball)
- **2-7_TD** - 2-7 Triple Draw
- **BADUGI** - Badugi

## Key Features
- 6-max and 8-max table support
- Timer system (30 seconds per action)
- Time bank chips (5 chips per player, 30s each)
- Game rotation (mix games mode)
- Auto fold/check for disconnected players
- Card deal animations for flop/turn/river

## UI Design Notes
- Cards displayed above player name tags (overlapping style)
- Chips positioned toward table center based on seat position
- Dealer button on table surface (not on avatar)
- Hand rank displayed below player's name tag
- Minimal showdown notification (no blue screen)
- Top player cards displayed below name tag (to avoid header overlap)

## Game Flow
1. WAITING → Players join and sit down
2. PREFLOP → Blinds posted, hole cards dealt
3. FLOP → 3 community cards (Hold'em/Omaha)
4. TURN → 4th community card
5. RIVER → 5th community card
6. SHOWDOWN → Winner determined, pot distributed

For Stud games: 3RD_STREET → 4TH_STREET → 5TH_STREET → 6TH_STREET → 7TH_STREET → SHOWDOWN

## Notes
- Japanese comments are used in the codebase
- All styling uses inline CSS (avoid CSS classes)
- Server handles timer management and auto-actions
- Client receives timer updates via socket events
