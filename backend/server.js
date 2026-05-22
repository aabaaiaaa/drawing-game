const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');

const app = express();
app.use(cors());

const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: "http://localhost:5173",
    methods: ["GET", "POST"]
  }
});

const E2E_TEST = process.env.E2E_TEST === '1';

const rooms = new Map();
const words = [
  // Original words
  'cat', 'dog', 'house', 'tree', 'car', 'phone', 'computer', 'book',
  'chair', 'table', 'sun', 'moon', 'star', 'cloud', 'flower', 'bird',
  'fish', 'pizza', 'cake', 'apple', 'guitar', 'camera', 'bicycle', 'boat',
  'umbrella', 'hat', 'shoe', 'clock', 'key', 'door', 'window', 'bridge',

  // Common animals
  'elephant', 'lion', 'tiger', 'bear', 'rabbit', 'mouse', 'hamster', 'giraffe',
  'zebra', 'monkey', 'cow', 'pig', 'sheep', 'horse', 'chicken', 'duck',
  'goose', 'turkey', 'whale', 'dolphin', 'shark', 'octopus', 'crab', 'lobster',
  'snake', 'turtle', 'frog', 'lizard', 'butterfly', 'bee', 'spider', 'ladybug',
  'owl', 'eagle', 'penguin', 'parrot', 'squirrel', 'deer', 'fox', 'wolf',

  // Household furniture
  'sofa', 'couch', 'bed', 'pillow', 'blanket', 'lamp', 'mirror', 'curtain',
  'rug', 'carpet', 'shelf', 'drawer', 'desk', 'stool', 'bench',

  // Kitchen items
  'refrigerator', 'stove', 'oven', 'microwave', 'toaster', 'kettle', 'blender',
  'sink', 'faucet', 'plate', 'bowl', 'cup', 'mug', 'fork', 'spoon', 'knife',
  'pot', 'pan', 'bottle', 'jar', 'can',

  // Bathroom items
  'toilet', 'shower', 'bathtub', 'towel', 'soap', 'toothbrush', 'comb', 'brush',

  // Other household items
  'television', 'remote', 'radio', 'vacuum', 'broom', 'mop', 'bucket',
  'plant', 'vase', 'candle', 'picture', 'frame', 'scissors', 'tape',
  'pencil', 'pen', 'paper', 'envelope', 'wallet', 'purse', 'backpack',
  'glasses', 'sunglasses', 'watch', 'ring', 'necklace',

  // Food items
  'banana', 'orange', 'grapes', 'strawberry', 'watermelon', 'pineapple',
  'carrot', 'tomato', 'potato', 'bread', 'cheese', 'egg', 'sandwich',
  'hamburger', 'hotdog', 'icecream', 'cookie', 'donut', 'candy',

  // Common objects
  'balloon', 'flag', 'crown', 'diamond', 'heart', 'gift', 'box',
  'ball', 'kite', 'rocket', 'airplane', 'train', 'bus', 'truck',
  'motorcycle', 'helicopter', 'mountain', 'beach', 'island', 'castle'
];

function getRandomWord() {
  return words[Math.floor(Math.random() * words.length)];
}

io.on('connection', (socket) => {
  console.log('New client connected:', socket.id);

  socket.on('createRoom', ({ playerName, rounds, timePerRound, testWords }) => {
    const roomCode = Math.random().toString(36).substring(2, 8).toUpperCase();
    const player = {
      id: socket.id,
      name: playerName,
      score: 0,
      mistakes: 0,
      handicap: 0,
      isHost: true
    };

    rooms.set(roomCode, {
      code: roomCode,
      players: [player],
      host: socket.id,
      gameStarted: false,
      currentRound: 0,
      totalRounds: rounds || 3,
      timePerRound: timePerRound || 60,
      currentDrawerIndex: 0,
      currentWord: null,
      roundStartTime: null,
      revealedLetters: new Map(),
      testWords: E2E_TEST && Array.isArray(testWords) && testWords.length > 0 ? testWords : null,
      testWordIndex: 0
    });

    socket.join(roomCode);
    socket.emit('roomCreated', {
      roomCode,
      player,
      totalRounds: rooms.get(roomCode).totalRounds,
      timePerRound: rooms.get(roomCode).timePerRound
    });
    console.log(`Room ${roomCode} created by ${playerName}`);
  });

  socket.on('joinRoom', ({ roomCode, playerName }) => {
    const room = rooms.get(roomCode);

    if (!room) {
      socket.emit('error', { message: 'Room not found' });
      return;
    }

    const existingPlayer = room.players.find(p => p.id === socket.id);
    if (existingPlayer) {
      socket.emit('error', { message: 'Already in room' });
      return;
    }

    let handicap = 0;
    if (room.gameStarted) {
      const lowestScore = Math.min(...room.players.map(p => p.score));
      handicap = lowestScore;
    }

    const player = {
      id: socket.id,
      name: playerName,
      score: handicap,
      mistakes: 0,
      handicap: handicap,
      isHost: false
    };

    room.players.push(player);
    socket.join(roomCode);

    io.to(roomCode).emit('playerJoined', {
      player,
      players: room.players
    });

    const joinData = {
      roomCode,
      player,
      players: room.players,
      gameStarted: room.gameStarted,
      currentRound: room.currentRound,
      totalRounds: room.totalRounds,
      timePerRound: room.timePerRound
    };

    if (room.gameStarted && room.currentWord) {
      const drawer = room.players[room.currentDrawerIndex];
      const timeElapsed = Math.floor((Date.now() - room.roundStartTime) / 1000);
      const timeLeft = Math.max(0, room.timePerRound - timeElapsed);

      joinData.currentTurn = {
        drawerId: drawer.id,
        drawerName: drawer.name,
        wordLength: room.currentWord.length,
        timeLeft: timeLeft
      };
    }

    socket.emit('roomJoined', joinData);

    console.log(`${playerName} joined room ${roomCode}`);
  });

  socket.on('updateSettings', ({ roomCode, totalRounds, timePerRound }) => {
    const room = rooms.get(roomCode);

    if (!room || room.host !== socket.id) {
      socket.emit('error', { message: 'Not authorized' });
      return;
    }

    if (room.gameStarted) {
      socket.emit('error', { message: 'Cannot change settings during game' });
      return;
    }

    if (totalRounds !== undefined) {
      room.totalRounds = totalRounds;
    }

    if (timePerRound !== undefined) {
      room.timePerRound = timePerRound;
    }

    io.to(roomCode).emit('settingsUpdated', {
      totalRounds: room.totalRounds,
      timePerRound: room.timePerRound
    });
  });

  socket.on('startGame', ({ roomCode }) => {
    const room = rooms.get(roomCode);

    if (!room || room.host !== socket.id) {
      socket.emit('error', { message: 'Not authorized' });
      return;
    }

    if (room.players.length < 2) {
      socket.emit('error', { message: 'Need at least 2 players' });
      return;
    }

    room.gameStarted = true;
    room.currentRound = 1;
    room.currentDrawerIndex = 0;
    startNewTurn(roomCode);
  });

  socket.on('draw', ({ roomCode, drawData }) => {
    const room = rooms.get(roomCode);
    if (!room) return;

    socket.to(roomCode).emit('drawing', { drawData });
  });

  socket.on('guess', ({ roomCode, word }) => {
    const room = rooms.get(roomCode);
    if (!room || !room.gameStarted || !room.currentWord) return;

    const player = room.players.find(p => p.id === socket.id);
    const drawer = room.players[room.currentDrawerIndex];

    if (!player || socket.id === drawer.id) return;

    const guessWord = word.toLowerCase().trim();
    const correctWord = room.currentWord.toLowerCase();

    if (guessWord === correctWord) {
      const timeLeft = 20 - Math.floor((Date.now() - room.roundStartTime) / 1000);
      const points = Math.max(10, 50 - (player.mistakes * 5) + (timeLeft * 2));
      player.score += points;
      player.mistakes = 0;

      io.to(roomCode).emit('correctGuess', {
        playerId: player.id,
        playerName: player.name,
        word: correctWord,
        points,
        score: player.score
      });

      if (room.roundTimer) {
        clearTimeout(room.roundTimer);
      }
      setTimeout(() => nextTurn(roomCode), 2000);
    } else {
      player.mistakes++;

      const revealed = [];
      for (let i = 0; i < correctWord.length; i++) {
        if (guessWord[i] === correctWord[i]) {
          revealed.push({ index: i, letter: correctWord[i] });
        }
      }

      if (revealed.length > 0) {
        const playerKey = `${roomCode}_${player.id}`;
        if (!room.revealedLetters.has(playerKey)) {
          room.revealedLetters.set(playerKey, new Map());
        }
        const playerRevealed = room.revealedLetters.get(playerKey);
        revealed.forEach(({ index, letter }) => playerRevealed.set(index, letter));

        const revealedArray = Array.from(playerRevealed.entries()).map(([index, letter]) => ({ index, letter }));
        socket.emit('letterRevealed', { revealed: revealedArray });
      }
    }
  });

  socket.on('newGame', ({ roomCode }) => {
    const room = rooms.get(roomCode);

    if (!room || room.host !== socket.id) {
      socket.emit('error', { message: 'Not authorized' });
      return;
    }

    room.gameStarted = false;
    room.currentRound = 0;
    room.currentDrawerIndex = 0;
    room.currentWord = null;
    room.roundStartTime = null;
    room.revealedLetters.clear();

    if (room.roundTimer) {
      clearTimeout(room.roundTimer);
      room.roundTimer = null;
    }

    room.players.forEach(player => {
      player.score = 0;
      player.mistakes = 0;
      player.handicap = 0;
    });

    io.to(roomCode).emit('returnToLobby', {
      players: room.players,
      totalRounds: room.totalRounds,
      timePerRound: room.timePerRound
    });

    console.log(`Room ${roomCode} starting new game`);
  });

  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);

    rooms.forEach((room, roomCode) => {
      const playerIndex = room.players.findIndex(p => p.id === socket.id);
      if (playerIndex === -1) return;

      const player = room.players[playerIndex];
      const wasDrawer = room.gameStarted && playerIndex === room.currentDrawerIndex;

      room.players.splice(playerIndex, 1);

      // Keep currentDrawerIndex pointing at the same logical "next" player
      // after the splice. If somebody before the drawer left, the drawer
      // shifted left by one.
      if (room.gameStarted && !wasDrawer && playerIndex < room.currentDrawerIndex) {
        room.currentDrawerIndex--;
      }

      if (room.players.length === 0) {
        if (room.roundTimer) {
          clearTimeout(room.roundTimer);
          room.roundTimer = null;
        }
        rooms.delete(roomCode);
        console.log(`Room ${roomCode} deleted (empty)`);
        return;
      }

      if (room.host === socket.id) {
        room.host = room.players[0].id;
        room.players[0].isHost = true;
      }

      io.to(roomCode).emit('playerLeft', {
        playerId: player.id,
        playerName: player.name,
        players: room.players
      });

      if (!room.gameStarted) return;

      // In-game departure: end the game if we can't continue, otherwise
      // advance the turn if the drawer was the one who left.
      if (room.players.length < 2) {
        if (room.roundTimer) {
          clearTimeout(room.roundTimer);
          room.roundTimer = null;
        }
        endGame(roomCode);
        return;
      }

      if (wasDrawer) {
        if (room.roundTimer) {
          clearTimeout(room.roundTimer);
          room.roundTimer = null;
        }
        io.to(roomCode).emit('turnEnded', { word: room.currentWord });

        // The splice shifted the next player into the drawer slot, so we
        // don't increment currentDrawerIndex — only handle wrap/round end.
        if (room.currentDrawerIndex >= room.players.length) {
          room.currentDrawerIndex = 0;
          room.currentRound++;
          if (room.currentRound > room.totalRounds) {
            endGame(roomCode);
            return;
          }
        }
        setTimeout(() => startNewTurn(roomCode), 3000);
      }
    });
  });
});

function startNewTurn(roomCode) {
  const room = rooms.get(roomCode);
  if (!room) return;

  if (room.testWords) {
    room.currentWord = room.testWords[room.testWordIndex % room.testWords.length];
    room.testWordIndex++;
  } else {
    room.currentWord = getRandomWord();
  }
  room.roundStartTime = Date.now();
  room.revealedLetters.clear();

  const drawer = room.players[room.currentDrawerIndex];

  io.to(drawer.id).emit('yourTurn', {
    word: room.currentWord,
    round: room.currentRound,
    totalRounds: room.totalRounds
  });

  io.to(roomCode).emit('newTurn', {
    drawerId: drawer.id,
    drawerName: drawer.name,
    wordLength: room.currentWord.length,
    round: room.currentRound,
    totalRounds: room.totalRounds,
    timeLimit: room.timePerRound
  });

  room.roundTimer = setTimeout(() => {
    nextTurn(roomCode);
  }, room.timePerRound * 1000);
}

function nextTurn(roomCode) {
  const room = rooms.get(roomCode);
  if (!room) return;

  if (room.roundTimer) {
    clearTimeout(room.roundTimer);
  }

  io.to(roomCode).emit('turnEnded', {
    word: room.currentWord
  });

  room.currentDrawerIndex++;

  if (room.currentDrawerIndex >= room.players.length) {
    room.currentDrawerIndex = 0;
    room.currentRound++;

    if (room.currentRound > room.totalRounds) {
      endGame(roomCode);
      return;
    }
  }

  setTimeout(() => {
    startNewTurn(roomCode);
  }, 3000);
}

function endGame(roomCode) {
  const room = rooms.get(roomCode);
  if (!room) return;

  if (room.roundTimer) {
    clearTimeout(room.roundTimer);
    room.roundTimer = null;
  }

  const sortedPlayers = [...room.players].sort((a, b) => b.score - a.score);

  io.to(roomCode).emit('gameEnded', {
    players: sortedPlayers
  });

  room.gameStarted = false;
  room.currentRound = 0;
  room.currentWord = null;
}

if (require.main === module) {
  const PORT = process.env.PORT || 3001;
  server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
}

module.exports = { app, server, io, rooms };
