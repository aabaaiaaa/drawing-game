# Drawing Game

A real-time multiplayer drawing and guessing game built with React and Node.js, featuring a bright art studio theme with an extensive word library.

## Features

- **Art Studio Theme**: Bright, spacious interface with paint brushes, palettes, and artistic decorations
- **Extensive Word Library**: 150+ words across multiple categories (animals, household items, food, objects)
- **Shareable Room URLs**: Copy and share direct links to invite players instantly
- **Configurable Settings**: Host controls number of rounds (1-10) and time per round (15-180s)
- **Real-time Multiplayer**: Drawing synchronization using WebSockets
- **Smart Guessing**: Letter-by-letter reveals when you guess correct letters
- **Dynamic Scoring**: Points based on accuracy and speed
- **Flexible Join/Leave**: Players can join/leave at any time
- **Late Joiner Handicap**: New players start with lowest current score
- **Persistent Rooms**: Return to lobby after each game with same room code
- **End Game Scoreboard**: Rankings with handicap display

## How to Play

1. **Create a Room**: Host creates a room and configures:
   - Number of rounds (1-10)
   - Time per round (15-180 seconds)
2. **Invite Players**: Share the room URL or room code with others
3. **Adjust Settings** (Host only): Fine-tune rounds and time in the lobby
4. **Start Game**: Host starts when ready (min 2 players)
5. **Draw**: When it's your turn, draw the word shown to you
6. **Guess**: Other players type guesses to identify the drawing
   - See underscores for word length
   - Correct letters in correct positions reveal individually
7. **Scoring**:
   - Correct guesses earn points (50 base)
   - Fewer mistakes = more points (-5 per mistake)
   - Faster guesses = bonus points (+2 per second remaining)
8. **New Game**: After all rounds, host can start new game in same room

## Installation

### Prerequisites
- Node.js (v14 or higher)
- npm

### Backend Setup

```bash
cd drawing-game/backend
npm install
npm start
```

The server will run on `http://localhost:3001`

### Frontend Setup

Open a new terminal:

```bash
cd drawing-game/frontend
npm install
npm run dev
```

The app will run on `http://localhost:5173`

## Game Rules

- **Turn Duration**: Configurable 15-180 seconds (default 60s)
- **Number of Rounds**: Configurable 1-10 rounds (default 3)
- **Player Order**: Based on join order (first to join draws first)
- **Letter Reveals**: Correct letters in correct positions reveal individually
- **Handicap System**: Late joiners start with the lowest player's current score
- **Scoring Formula**: Base 50 points - (5 × mistakes) + (2 × seconds remaining)
- **Room Persistence**: Same room code works for multiple games
- **URL Sharing**: Share room URL for instant join (e.g., `http://localhost:5173/room/ABC123`)

## Tech Stack

- **Frontend**: React, React Router, Socket.io-client, Vite
- **Backend**: Node.js, Express, Socket.io
- **Real-time Communication**: WebSockets
- **Routing**: React Router (shareable URLs)

## Project Structure

```
drawing-game/
├── backend/
│   ├── server.js          # Main server with game logic
│   └── package.json
└── frontend/
    ├── src/
    │   ├── components/
    │   │   ├── Home.jsx       # Room creation/joining
    │   │   ├── Lobby.jsx      # Pre-game lobby
    │   │   ├── Game.jsx       # Main game screen
    │   │   ├── Canvas.jsx     # Drawing canvas
    │   │   └── EndGame.jsx    # Scoreboard
    │   ├── App.jsx
    │   ├── main.jsx
    │   └── index.css
    ├── index.html
    ├── vite.config.js
    └── package.json
```

## Development

To run in development mode with auto-reload:

Backend:
```bash
npm run dev
```

Frontend:
```bash
npm run dev
```

## Future Enhancements

- **Custom Word Lists**: Upload your own words or filter by specific categories
- **Word Difficulty Levels**: Easy, medium, hard word selection
- **Chat System**: In-game messaging for players
- **Drawing Replay**: Watch drawings play back after each round
- **Mobile Touch Support**: Full touch/stylus drawing on tablets
- **User Accounts**: Persistent profiles and statistics
- **Advanced Room Options**: Private rooms, spectator mode, kick/ban
- **Theme Variations**: Dark mode, seasonal themes, and custom color schemes
- **Drawing Tools**: Fill bucket, shapes, eraser improvements, more colors

## Known Issues

- Canvas doesn't sync for players joining mid-turn (will see blank canvas until next turn)
- No undo/redo for drawing
- Mobile drawing experience needs improvement

For detailed technical documentation, see `TECHNICAL_DOCS.md`.

Enjoy the game!
