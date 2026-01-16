# Mix Poker App

## Project Overview
Mix Poker is a multiplayer poker application that supports multiple game variants with rotation functionality. Players can play various poker games (Hold'em, Omaha, Stud, Draw) in a single session.

## Tech Stack
- **Frontend**: React + TypeScript + Vite (port 5173)
- **Backend**: Node.js + Express + Socket.IO (port 3000)
- **Real-time Communication**: Socket.IO

## Project Structure
```
mix-poker-app/
├── server/           # Backend (Node.js + Socket.IO)
│   ├── index.ts      # Main entry, socket handlers
│   ├── GameEngine.ts # Game state machine
│   ├── Dealer.ts     # Card dealing logic
│   └── ...
└── client/           # Frontend (React + Vite)
    └── src/
        ├── Table.tsx # Main game table
        └── ...
```

## Development Commands
```bash
# Start server
cd server && npm run dev

# Start client
cd client && npm run dev
```

## Supported Game Variants
- NLH (No-Limit Hold'em)
- PLO (Pot-Limit Omaha)
- PLO8 (Pot-Limit Omaha Hi-Lo)
- 7CS (7-Card Stud)
- 7CS8 (7-Card Stud Hi-Lo)
- RAZZ
- 2-7_TD (2-7 Triple Draw)
- BADUGI

## Key Files
- `server/GameEngine.ts` - Game state transitions (PREFLOP → FLOP → TURN → RIVER → SHOWDOWN)
- `server/handEvaluator.ts` - Hand evaluation for all variants
- `server/ShowdownManager.ts` - Winner determination and pot distribution
- `client/src/Table.tsx` - Main game UI component

## Notes
- Japanese comments are used in the codebase
- The game supports 6-player tables (8-player planned)
- Game rotation happens after each orbit (button goes around the table)
