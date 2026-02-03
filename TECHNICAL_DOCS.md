# Drawing Game - Technical Documentation

## Architecture Overview

### Tech Stack
- **Frontend**: React 18 + Vite
- **Backend**: Node.js + Express + Socket.io
- **Real-time Communication**: WebSockets via Socket.io
- **State Management**: React useState/useEffect hooks
- **Data Storage**: In-memory (no database)

### Communication Flow
```
Client (React) <--WebSocket--> Server (Socket.io) <--WebSocket--> Other Clients
```

All game state is managed server-side. Clients receive state updates via Socket.io events.

---

## Data Structures

### Player Object
```javascript
{
  id: string,           // Socket.io connection ID
  name: string,         // Player display name (max 20 chars)
  score: number,        // Current score points
  mistakes: number,     // Mistakes in current turn (resets each turn)
  handicap: number,     // Starting score if joined late
  isHost: boolean       // Can start game and control lobby
}
```

### Room Object
```javascript
{
  code: string,                    // 6-character uppercase room code
  players: Player[],               // Array of player objects (join order preserved)
  host: string,                    // Socket ID of host
  gameStarted: boolean,            // Game in progress flag
  currentRound: number,            // 1-indexed current round
  totalRounds: number,             // Total rounds (set by host, default 3)
  timePerRound: number,            // Seconds per round (set by host, default 60)
  currentDrawerIndex: number,      // Index in players array
  currentWord: string | null,      // Word being drawn
  roundStartTime: number | null,   // Timestamp (Date.now())
  roundTimer: Timeout | null,      // Configurable timer reference
  revealedLetters: Map<string, Map<number, string>>  // Key: "roomCode_playerId", Value: Map of index -> letter
}
```

### Game State (Frontend)
```javascript
{
  gameStarted: boolean,
  currentRound: number,
  totalRounds: number,
  drawerId: string,          // Socket ID of current drawer
  drawerName: string,
  wordLength: number,        // Number of letters in current word
  timeLeft: number,          // Countdown timer (20 to 0)
  isDrawing: boolean,        // True if current player is drawer
  currentWord: string | null // Only sent to drawer
}
```

---

## Socket.io Events

### Client → Server

#### `createRoom`
**Payload:**
```javascript
{
  playerName: string,
  rounds: number,
  timePerRound: number  // seconds (default: 60)
}
```
**Action:** Creates new room with unique code, adds player as host
**Response:** Emits `roomCreated` to sender with room settings

#### `joinRoom`
**Payload:**
```javascript
{
  roomCode: string,
  playerName: string
}
```
**Action:** Adds player to existing room, applies handicap if game started
**Response:**
- Emits `roomJoined` to sender
- Emits `playerJoined` to all in room

#### `startGame`
**Payload:**
```javascript
{ roomCode: string }
```
**Action:** Starts game if sender is host and ≥2 players
**Response:** Calls `startNewTurn()` → emits `newTurn` and `yourTurn`

#### `draw`
**Payload:**
```javascript
{
  roomCode: string,
  drawData: {
    x0: number,
    y0: number,
    x1: number,
    y1: number,
    color: string,
    brushSize: number
  }
}
```
**Action:** Broadcasts drawing data to all players except sender
**Response:** Emits `drawing` to room (excluding sender)

#### `guess`
**Payload:**
```javascript
{
  roomCode: string,
  word: string
}
```
**Action:**
1. Checks if guess matches current word
2. If correct: Awards points, emits `correctGuess`, advances turn
3. If incorrect: Increments mistakes, checks for letter matches, emits `letterRevealed` to sender
**Response:**
- Correct: `correctGuess` to all, then `nextTurn()`
- Incorrect with letter match: `letterRevealed` to sender only

#### `updateSettings`
**Payload:**
```javascript
{
  roomCode: string,
  totalRounds: number,    // optional
  timePerRound: number    // optional, in seconds
}
```
**Action:** Updates game settings in lobby (host only, before game starts)
**Response:** Emits `settingsUpdated` to all players in room

#### `newGame`
**Payload:**
```javascript
{ roomCode: string }
```
**Action:** Resets game state while preserving room and players (host only)
- Resets scores, rounds, timers
- Clears revealed letters
- Sets gameStarted to false
**Response:** Emits `returnToLobby` to all players in room

#### `disconnect`
**Action:**
- If game not started: Removes player from room
- If game started: Keeps player in list (score preserved)
- If host disconnects: Transfers host to next player
- If room empty: Deletes room
**Response:** Emits `playerLeft` to remaining players

---

### Server → Client

#### `roomCreated`
```javascript
{
  roomCode: string,
  player: Player,
  totalRounds: number,
  timePerRound: number
}
```
Sent to room creator only with initial room settings.

#### `roomJoined`
```javascript
{
  roomCode: string,
  player: Player,
  players: Player[],
  gameStarted: boolean,
  currentRound: number,
  totalRounds: number,
  timePerRound: number,
  currentTurn?: {           // Only present if game is in progress
    drawerId: string,
    drawerName: string,
    wordLength: number,
    timeLeft: number
  }
}
```
Sent to joining player with full room state including settings. If joining mid-game, includes current turn information.

#### `playerJoined`
```javascript
{
  player: Player,
  players: Player[]
}
```
Broadcast to all players in room when someone joins.

#### `playerLeft`
```javascript
{
  playerId: string,
  playerName: string,
  players: Player[]
}
```
Broadcast when player disconnects.

#### `newTurn`
```javascript
{
  drawerId: string,
  drawerName: string,
  wordLength: number,
  round: number,
  totalRounds: number,
  timeLimit: 20
}
```
Broadcast to all players when new turn starts.

#### `yourTurn`
```javascript
{
  word: string,
  round: number,
  totalRounds: number
}
```
Sent only to the drawer, contains the secret word.

**Important:** Both `newTurn` and `yourTurn` are sent when a turn starts. The drawer receives both events. To prevent `newTurn` from overwriting the word:
- Drawer: `newTurn` does not modify `currentWord` (preserves value from `yourTurn`)
- Guessers: `newTurn` sets `currentWord: null`

This is handled in `App.jsx:71` with conditional spread: `...(isDrawer ? {} : { currentWord: null })`

#### `drawing`
```javascript
{
  drawData: {
    x0: number, y0: number,
    x1: number, y1: number,
    color: string,
    brushSize: number
  }
}
```
Broadcast to all guessers (not drawer) for canvas sync.

#### `correctGuess`
```javascript
{
  playerId: string,
  playerName: string,
  word: string,
  points: number,
  score: number
}
```
Broadcast when player guesses correctly.

#### `letterRevealed`
```javascript
{
  revealed: [{ index: number, letter: string }, ...]
}
```
Sent to individual player when their guess has correct letters in correct positions. Contains both the position and the actual letter to display.

#### `turnEnded`
```javascript
{
  word: string
}
```
Broadcast when 20-second timer expires.

#### `gameEnded`
```javascript
{
  players: Player[]
}
```
Broadcast when all rounds complete. Players array is sorted by score (descending).

#### `returnToLobby`
```javascript
{
  players: Player[],
  totalRounds: number,
  timePerRound: number
}
```
Broadcast when host starts a new game after game ends. Returns all players to lobby with reset scores. Room and room code persist with current settings.

#### `settingsUpdated`
```javascript
{
  totalRounds: number,
  timePerRound: number
}
```
Broadcast to all players when host changes game settings in lobby.

#### `error`
```javascript
{
  message: string
}
```
Sent to individual player on error (e.g., "Room not found", "Not authorized").

---

## Game Flow

### 1. Room Creation/Joining
```
Player A creates room
  → Server generates 6-char code (e.g., "XY3K9M")
  → Player A joins room as host

Player B joins with code
  → Server adds to room.players array
  → Broadcasts playerJoined to all
```

### 2. Game Start
```
Host clicks "Start Game"
  → Server validates ≥2 players
  → Sets gameStarted = true
  → Calls startNewTurn()
```

### 3. Turn Cycle
```
startNewTurn()
  1. Select random word from word list
  2. Set roundStartTime = Date.now()
  3. Clear revealedLetters Map
  4. Get drawer = players[currentDrawerIndex]
  5. Emit 'yourTurn' to drawer (includes word)
  6. Emit 'newTurn' to all (includes wordLength, not word)
  7. Set 20-second timeout → nextTurn()
```

### 4. During Turn

**Drawer Actions:**
- Draws on canvas
- Each stroke emits 'draw' event
- Server broadcasts to guessers as 'drawing'
- Guessers render strokes on their canvas

**Guesser Actions:**
- Types guess, submits
- Server compares with currentWord (case-insensitive)
- If match: Award points, broadcast correctGuess, clear timer, nextTurn() after 2s
- If no match: Increment mistakes, check letter matches

### 5. Letter Reveal System
```
Player guesses "HOUSE" when word is "HORSE"
  → Compare letter by letter:
     H = H ✓ (index 0, letter 'h')
     O = O ✓ (index 1, letter 'o')
     U ≠ R ✗
     S = S ✓ (index 3, letter 's')
     E = E ✓ (index 4, letter 'e')
  → Store revealed in Map: {0 => 'h', 1 => 'o', 3 => 's', 4 => 'e'}
  → Emit 'letterRevealed' with [{index: 0, letter: 'h'}, {index: 1, letter: 'o'}, ...]
  → Player sees: H O _ S E
```

Each player has their own revealed letters (not shared). The server stores a `Map<string, Map<number, string>>` where the key is `"roomCode_playerId"` and the value maps position indices to letters. This accumulates across multiple guesses in the same turn.

### 6. Scoring Algorithm
```javascript
const timeLeft = 20 - Math.floor((Date.now() - room.roundStartTime) / 1000)
const points = Math.max(10, 50 - (player.mistakes * 5) + (timeLeft * 2))
```

**Breakdown:**
- Base: 50 points
- Penalty: -5 per mistake
- Bonus: +2 per second remaining
- Minimum: 10 points

**Examples:**
- Guess on first try with 15s left: 50 - 0 + 30 = 80 points
- Guess on 5th try with 5s left: 50 - 20 + 10 = 40 points
- Guess on 10th try with 1s left: Max(10, 50 - 45 + 2) = 10 points

### 7. Turn Advancement
```
nextTurn()
  1. Clear roundTimer
  2. Emit 'turnEnded' with word
  3. Increment currentDrawerIndex
  4. If currentDrawerIndex >= players.length:
       - Reset to 0
       - Increment currentRound
       - If currentRound > totalRounds:
           → endGame()
       - Else:
           → startNewTurn() after 3s
  5. Else:
       → startNewTurn() after 3s
```

### 8. Game End
```
endGame()
  1. Sort players by score (descending)
  2. Emit 'gameEnded' with sorted players
  3. Reset game state (gameStarted = false, etc.)
```

---

## Frontend Components

### App.jsx
**Responsibilities:**
- Socket.io connection management
- Global state management (screen, roomCode, player, players, gameState)
- Socket event listeners
- Notification system
- Screen routing (home/lobby/game/endgame)

**Key State:**
```javascript
screen: 'home' | 'lobby' | 'game' | 'endgame'
roomCode: string
player: Player | null
players: Player[]
gameState: GameState
notification: string | null
```

### Home.jsx
**Responsibilities:**
- Room creation UI (name + rounds slider)
- Room joining UI (name + code input)
- Mode selection (create vs join)

**Emits:**
- createRoom({ playerName, rounds })
- joinRoom({ roomCode, playerName })

### Lobby.jsx
**Responsibilities:**
- Display room code
- Player list with host badge
- Start game button (host only)
- Waiting message (non-hosts)

**Props:**
```javascript
roomCode: string
player: Player
players: Player[]
onStartGame: () => void
```

### Game.jsx
**Responsibilities:**
- Game info display (round, timer, turn info)
- Word display with revealed letters
- Canvas wrapper
- Guess input (guessers only)
- Player sidebar with scores and handicaps
- Timer countdown (client-side)

**Key Logic:**
- Timer decrements every 1000ms
- Revealed letters reset on turn change
- Word display logic:
  - If drawer: Show full word
  - If guesser: Show "_" or revealed letter per position

### Canvas.jsx
**Responsibilities:**
- Drawing canvas (800x600)
- Mouse event handling (down/move/up/leave)
- Drawing tools (8 colors, brush size 1-20px)
- Clear button
- Real-time drawing sync
- Coordinate scaling for responsive canvas

**Drawing State:**
```javascript
isMouseDown: boolean
color: string (hex)
brushSize: number (1-20)
```

**Drawing Logic:**
1. Mouse down: Start stroke at (x, y)
2. Mouse move: Draw line from last point to current
3. Emit drawData to server
4. Server broadcasts to other players
5. Other players render stroke on their canvas

**Draw Data:**
```javascript
{
  x0: startX,
  y0: startY,
  x1: endX,
  y1: endY,
  color: '#RRGGBB',
  brushSize: number
}
```

### EndGame.jsx
**Responsibilities:**
- Display sorted scoreboard
- Show winner announcement
- New game button (returns to home)

**Table Columns:**
- Rank (1-indexed position)
- Player name
- Final score
- Handicap (shows "+X" if handicap > 0, "-" otherwise)

**Special Styling:**
- Winner row has gold background

---

## Player Join/Leave Handling

### Joining During Game
```javascript
if (room.gameStarted) {
  const lowestScore = Math.min(...room.players.map(p => p.score))
  handicap = lowestScore
}

player.score = handicap
player.handicap = handicap
```

Late joiners start with the lowest current score as both their score and handicap value. This prevents unfair advantage/disadvantage.

### Leaving During Game
Players who disconnect during gameplay remain in the players array with their score intact. They can rejoin using the same room code (though current implementation treats them as a new player due to new socket ID).

### Leaving Before Game
Players removed from array completely. If host leaves, host transfers to players[0].

---

## Room Lifecycle

### Creation
```javascript
Math.random().toString(36).substring(2, 8).toUpperCase()
// Generates codes like: "A3KF9X", "QW8P2M"
```

### Storage
Rooms stored in Map: `Map<roomCode: string, room: Room>`

### Deletion
Rooms deleted when:
1. All players leave before game starts
2. Host explicitly closes (not implemented)
3. Server restarts (in-memory storage)

---

## Word List

32 words included in `backend/server.js`:
```javascript
['cat', 'dog', 'house', 'tree', 'car', 'phone', 'computer', 'book',
 'chair', 'table', 'sun', 'moon', 'star', 'cloud', 'flower', 'bird',
 'fish', 'pizza', 'cake', 'apple', 'guitar', 'camera', 'bicycle', 'boat',
 'umbrella', 'hat', 'shoe', 'clock', 'key', 'door', 'window', 'bridge']
```

Selection: `words[Math.floor(Math.random() * words.length)]`

Words are single English nouns, easy to draw and guess.

---

## Timing and Synchronization

### Turn Timer
- Server-side: 20-second `setTimeout()` → `nextTurn()`
- Client-side: 1-second `setInterval()` for countdown display
- Client timer is visual only; server controls actual turn end

### Turn Transitions
- 2-second delay after correct guess (show word to all)
- 3-second delay between turns (prepare for next drawer)

### Canvas Sync
- Real-time via WebSocket (no polling)
- Each stroke emitted immediately
- No canvas state snapshots (late joiners see blank canvas)

---

## Edge Cases Handled

1. **Player guesses own drawing**: Drawer ID checked, guesses ignored
2. **Multiple correct guesses**: First correct guess ends turn
3. **Empty room after disconnect**: Room deleted from Map
4. **Host leaves lobby**: Host transferred to next player
5. **Join invalid room code**: Error emitted to client
6. **Start with <2 players**: Error emitted to client
7. **Timer clears on correct guess**: `clearTimeout(room.roundTimer)`
8. **Revealed letters reset per turn**: Map cleared in `startNewTurn()`
9. **Drawer word visibility**: `newTurn` event doesn't overwrite drawer's `currentWord`
10. **Letter reveal with actual letters**: Backend sends both index and letter, not just indices

---

## Bug Fixes Applied

### 1. Drawer Not Seeing Word (Fixed 2025-12-06)
**Problem:** When a turn started, the drawer received both `yourTurn` (with word) and `newTurn` (without word). The `newTurn` handler was setting `currentWord: null`, overwriting the word.

**Solution:** Modified `App.jsx:71` to conditionally update `currentWord`:
- Drawer: Don't touch `currentWord` in `newTurn` handler
- Guessers: Set `currentWord: null`

### 2. Letter Reveal Not Showing (Fixed 2025-12-06)
**Problem:** When guessers had correct letters in correct positions, they weren't displayed. Two issues:
1. Backend stored only indices in a Set, losing the actual letters
2. Frontend tried to access `gameState.currentWord[i]` which was `null` for guessers

**Solution:**
- Backend (`server.js:179-185`): Changed from `Set<number>` to `Map<number, string>`, storing index → letter mappings
- Backend emits: `[{index: 0, letter: 'h'}, {index: 1, letter: 'o'}, ...]`
- Frontend (`Game.jsx:47-52`): Creates Map from revealed array and displays actual letters

### 3. Word Not Showing After Correct Guess (Fixed 2025-12-06)
**Problem:** When a player correctly guessed the word, it remained partially hidden with underscores. The word should be fully revealed to all players.

**Solution:**
- `App.jsx:91-94`: When `correctGuess` received, set `gameState.currentWord` to the word for all players
- `App.jsx:99-102`: When `turnEnded` received (time expired), also reveal the word
- `Game.jsx:43-44`: Updated display logic to show full word if `currentWord` is set, regardless of whether player is drawer

**Behavior:** Word now displays fully to all players when someone guesses correctly or when time expires, then resets when next turn starts.

### 4. New Game Returns to Home (Improved 2025-12-06)
**Previous Behavior:** Clicking "New Game" reset the client state and returned to home screen, losing the room and all players.

**Improved Behavior:**
- Backend (`server.js:190-222`): Added `newGame` event handler that resets game state while preserving room and players
- Backend emits `returnToLobby` to all players with reset player scores
- Frontend (`App.jsx:110-126`): Listens for `returnToLobby` and transitions all players back to lobby
- Frontend (`App.jsx:164-166`): `newGame` now emits socket event instead of local reset
- `EndGame.jsx:36-44`: Only host can start new game, others see waiting message

**Benefits:**
- Same room code persists for multiple games
- New players can join between games
- Existing players kept together
- All scores reset to 0 for fair new game

### 5. Configurable Game Settings (Added 2025-12-06)
**Feature:** Host can now configure both number of rounds and time per round.

**Implementation:**
- Backend (`server.js:50`): Room stores `timePerRound` (default 60 seconds)
- Backend (`server.js:117-142`): `updateSettings` event allows host to change settings in lobby
- Backend (`server.js:318,323`): `startNewTurn` uses `room.timePerRound` for timer
- Frontend (`Home.jsx:7,59-71`): Time per round slider (15-180s, step 15s) at room creation
- Frontend (`Lobby.jsx:4-20,43-70`): Host can adjust both settings in lobby with sliders
- Frontend (`Lobby.jsx:85-89`): Non-hosts see current settings display
- Frontend (`App.jsx:138-145`): `settingsUpdated` event syncs changes to all players

**Settings:**
- Number of Rounds: 1-10 (default 3)
- Time per Round: 15-180 seconds in 15s increments (default 60s)
- Changes sync in real-time to all players in lobby
- Settings persist when returning to lobby for new game

### 6. Shareable Room URLs (Added 2025-12-06)
**Feature:** Room URLs are now shareable - players can copy and share the URL to invite others directly.

**Implementation:**
- Frontend (`package.json`): Added `react-router-dom` dependency
- Frontend (`main.jsx:3,9`): Wrapped app in `BrowserRouter`
- Frontend (`App.jsx:2,252-259`): Routes setup for `/` and `/room/:roomCode`
- Frontend (`App.jsx:12-14`): Uses `useNavigate`, `useParams`, `useLocation` hooks
- Frontend (`App.jsx:47,64`): Updates URL when creating or joining room
- Frontend (`App.jsx:177-181`): Auto-detects room code from URL
- Frontend (`Home.jsx:10-15`): Auto-opens join form when room code in URL

**URL Structure:**
- Home: `http://localhost:5173/`
- Room: `http://localhost:5173/room/ABC123`

**User Flow:**
1. Player creates room → URL changes to `/room/ABC123`
2. Player copies and shares URL
3. Others visit URL → Join form auto-opens with room code pre-filled
4. They enter their name and join directly

### 7. Late Joiner Turn State (Fixed 2025-12-06)
**Problem:** When a player joined a game in progress, they didn't see the word length (underscores) until the next turn started or they made a guess.

**Solution:**
- Backend (`server.js:114-125`): When game is in progress, `roomJoined` event now includes `currentTurn` object with:
  - `drawerId`: Who is currently drawing
  - `drawerName`: Drawer's name
  - `wordLength`: Number of letters to display
  - `timeLeft`: Remaining time in current turn
- Frontend (`App.jsx:50-80`): Handles `currentTurn` data and sets game state accordingly

**Behavior:** Late joiners now immediately see:
- Correct number of underscores for current word
- Who is drawing
- Time remaining
- Can start guessing right away

---

## Known Limitations

1. **No persistence**: Server restart loses all rooms and state
2. **No reconnection logic**: Disconnected players treated as new if rejoin
3. **Canvas not saved**: Late joiners don't see previous drawings
4. **No kick/ban**: Host cannot remove players
5. **No chat**: Players cannot communicate except through drawings
6. **Single word list**: No categories or difficulty levels
7. **No mobile touch events**: Canvas only supports mouse
8. **No undo/redo**: Canvas changes are permanent until clear
9. **No spectator mode**: All players must participate
10. **Room codes not validated**: No profanity filter on random codes

---

## Configuration Values

| Setting | Value | Location |
|---------|-------|----------|
| Server Port | 3001 | `backend/server.js:231` |
| Frontend Port | 5173 | `frontend/vite.config.js:6` |
| **Turn Duration** | **Configurable: 15-180s** | `backend/server.js:50,318,323` |
| Default Turn Duration | 60 seconds | `backend/server.js:50` |
| Turn End Delay | 3 seconds | `backend/server.js:208` |
| Correct Guess Delay | 2 seconds | `backend/server.js:114` |
| Room Code Length | 6 characters | `backend/server.js:23` |
| Canvas Width | 800px | `frontend/src/components/Canvas.jsx:127` |
| Canvas Height | 600px | `frontend/src/components/Canvas.jsx:128` |
| Max Player Name | 20 chars | `frontend/src/components/Home.jsx:43` |
| Max Guess Length | 30 chars | `frontend/src/components/Game.jsx:79` |
| Brush Size Range | 1-20px | `frontend/src/components/Canvas.jsx:19` |
| **Rounds** | **Configurable: 1-10** | `backend/server.js:49` |
| Default Rounds | 3 | `frontend/src/components/Home.jsx:6` |
| Min Rounds | 1 | `frontend/src/components/Home.jsx:52` |
| Max Rounds | 10 | `frontend/src/components/Home.jsx:53` |
| Min Time per Round | 15 seconds | `frontend/src/components/Home.jsx:65` |
| Max Time per Round | 180 seconds | `frontend/src/components/Home.jsx:66` |
| Time Step | 15 seconds | `frontend/src/components/Home.jsx:67` |
| Base Score | 50 points | `backend/server.js:104` |
| Mistake Penalty | -5 points | `backend/server.js:104` |
| Time Bonus | +2 points/sec | `backend/server.js:104` |
| Min Score | 10 points | `backend/server.js:104` |

---

## File Reference

### Backend
- `backend/server.js:1-232` - Main server file with all game logic
- `backend/package.json` - Dependencies

### Frontend
- `frontend/src/App.jsx` - Main app component with socket management
- `frontend/src/components/Home.jsx` - Room creation/joining screens
- `frontend/src/components/Lobby.jsx` - Pre-game lobby
- `frontend/src/components/Game.jsx` - Main game screen
- `frontend/src/components/Canvas.jsx` - Drawing canvas
- `frontend/src/components/EndGame.jsx` - Post-game scoreboard
- `frontend/src/index.css` - All styling
- `frontend/src/main.jsx` - React entry point
- `frontend/index.html` - HTML template
- `frontend/vite.config.js` - Vite configuration
- `frontend/package.json` - Dependencies

---

## Future Enhancement Areas

### High Priority
1. **Mobile support**: Touch events for canvas
2. **Reconnection**: Preserve player identity across disconnects
3. **Chat system**: Let players communicate
4. **Custom word lists**: Categories and difficulty
5. **Canvas improvements**: Undo, eraser, fill tool

### Medium Priority
6. **Room settings**: Private rooms, max players, time limits
7. **Player profiles**: Avatars, stats, history
8. **Spectator mode**: Watch without playing
9. **Hints**: Reveal category or first letter over time
10. **Replay**: Review drawings after game

### Low Priority
11. **Achievements**: Badges for milestones
12. **Leaderboards**: Global/weekly rankings
13. **Custom drawings**: Upload word lists
14. **Voice chat**: WebRTC integration
15. **Game modes**: Teams, relay drawing, blind drawing

---

## Debugging Tips

### Test Multiplayer Locally
1. Open `http://localhost:5173` in multiple browser tabs
2. Create room in Tab 1
3. Join with room code in Tab 2+
4. Use browser dev tools to monitor Socket.io events

### Common Issues

**"Room not found"**
- Check server is running on port 3001
- Verify room code is correct (case-sensitive)
- Room may have been deleted if empty

**Canvas not syncing**
- Check Socket.io connection in network tab
- Verify CORS settings in `server.js:9-12`
- Ensure drawer is actually drawing (check `isDrawing` state)

**Timer desync**
- Client timer is visual only
- Server controls actual turn end
- Network latency may cause 1-2 second offset

**Players not updating**
- Check `players` array in React DevTools
- Verify Socket.io events are being received
- Ensure player ID (socket ID) is unique

### Socket.io Debugging
```javascript
// Add to backend/server.js after io.on('connection')
console.log('Rooms:', Array.from(rooms.keys()))
console.log('Room details:', rooms.get(roomCode))

// Add to frontend/src/App.jsx
socket.onAny((event, ...args) => {
  console.log('Socket event:', event, args)
})
```

---

*Last Updated: 2025-12-06*
