const test = require('node:test');
const assert = require('node:assert/strict');
const { startServer, stopServer, connect, once, never } = require('./helpers');

let ctx;

test.before(async () => { ctx = await startServer(); });
test.after(async () => {
  await stopServer(ctx);
  // Server schedules untracked timers (e.g. 2s post-correct-guess nextTurn,
  // up-to-15s round timer) that keep the event loop alive. Exit explicitly.
  setImmediate(() => process.exit(0));
});

test('join with unknown room code emits error', async () => {
  const sock = await connect(ctx.url);
  sock.emit('joinRoom', { roomCode: 'NOPE99', playerName: 'Ada' });
  const err = await once(sock, 'error');
  assert.equal(err.message, 'Room not found');
  sock.disconnect();
});

test('non-host cannot start game or update settings', async () => {
  const host = await connect(ctx.url);
  host.emit('createRoom', { playerName: 'Host', rounds: 1, timePerRound: 15 });
  const { roomCode } = await once(host, 'roomCreated');

  const guest = await connect(ctx.url);
  guest.emit('joinRoom', { roomCode, playerName: 'Guest' });
  await once(guest, 'roomJoined');

  guest.emit('startGame', { roomCode });
  const err1 = await once(guest, 'error');
  assert.equal(err1.message, 'Not authorized');

  guest.emit('updateSettings', { roomCode, totalRounds: 5, timePerRound: 30 });
  const err2 = await once(guest, 'error');
  assert.equal(err2.message, 'Not authorized');

  host.disconnect();
  guest.disconnect();
});

test('host cannot start game with fewer than 2 players', async () => {
  const host = await connect(ctx.url);
  host.emit('createRoom', { playerName: 'Solo', rounds: 1, timePerRound: 15 });
  const { roomCode } = await once(host, 'roomCreated');

  host.emit('startGame', { roomCode });
  const err = await once(host, 'error');
  assert.equal(err.message, 'Need at least 2 players');
  host.disconnect();
});

test('drawer guessing their own word is ignored (no correctGuess fires)', async () => {
  const host = await connect(ctx.url);
  host.emit('createRoom', { playerName: 'Drawer', rounds: 1, timePerRound: 15, testWords: ['cat'] });
  const { roomCode } = await once(host, 'roomCreated');

  const guest = await connect(ctx.url);
  guest.emit('joinRoom', { roomCode, playerName: 'Guest' });
  await once(guest, 'roomJoined');

  host.emit('startGame', { roomCode });
  await once(host, 'yourTurn');

  host.emit('guess', { roomCode, word: 'cat' });
  await never(host, 'correctGuess', { wait: 250 });

  host.disconnect();
  guest.disconnect();
});

test('guess before game starts is silently ignored', async () => {
  const host = await connect(ctx.url);
  host.emit('createRoom', { playerName: 'Host', rounds: 1, timePerRound: 15 });
  const { roomCode } = await once(host, 'roomCreated');

  const guest = await connect(ctx.url);
  guest.emit('joinRoom', { roomCode, playerName: 'Guest' });
  await once(guest, 'roomJoined');

  guest.emit('guess', { roomCode, word: 'cat' });
  await never(guest, 'correctGuess', { wait: 250 });
  await never(guest, 'letterRevealed', { wait: 50 });

  host.disconnect();
  guest.disconnect();
});

test('correct guess is case-insensitive and trimmed', async () => {
  const host = await connect(ctx.url);
  host.emit('createRoom', { playerName: 'Host', rounds: 1, timePerRound: 15, testWords: ['cat'] });
  const { roomCode } = await once(host, 'roomCreated');

  const guest = await connect(ctx.url);
  guest.emit('joinRoom', { roomCode, playerName: 'Guest' });
  await once(guest, 'roomJoined');

  host.emit('startGame', { roomCode });
  await once(host, 'yourTurn');

  guest.emit('guess', { roomCode, word: '  CaT  ' });
  const correct = await once(host, 'correctGuess');
  assert.equal(correct.word, 'cat');
  assert.equal(correct.playerName, 'Guest');
  assert.ok(correct.points > 0);

  host.disconnect();
  guest.disconnect();
});

test('wrong guess sharing letters with answer triggers letterRevealed for that guesser only', async () => {
  const host = await connect(ctx.url);
  host.emit('createRoom', { playerName: 'Host', rounds: 1, timePerRound: 15, testWords: ['house'] });
  const { roomCode } = await once(host, 'roomCreated');

  const guest = await connect(ctx.url);
  guest.emit('joinRoom', { roomCode, playerName: 'Guest' });
  await once(guest, 'roomJoined');

  host.emit('startGame', { roomCode });
  await once(host, 'yourTurn');

  // 'horse' vs 'house' shares h,o at 0,1; s at 3; e at 4 (only u/r differ at 2).
  const guestReveal = once(guest, 'letterRevealed');
  guest.emit('guess', { roomCode, word: 'horse' });
  const reveal = await guestReveal;

  const positions = reveal.revealed.map((r) => r.index).sort((a, b) => a - b);
  assert.deepEqual(positions, [0, 1, 3, 4]);

  // Host (the drawer) must NOT receive a letterRevealed for the guesser's guess.
  await never(host, 'letterRevealed', { wait: 100 });

  host.disconnect();
  guest.disconnect();
});

test('disconnect removes the player from the room in both lobby and in-game; in-game with <2 left ends the game', async () => {
  // --- Lobby disconnect: player removed, no game state changes ---
  const hostA = await connect(ctx.url);
  hostA.emit('createRoom', { playerName: 'Host', rounds: 1, timePerRound: 15 });
  const { roomCode: rcA } = await once(hostA, 'roomCreated');

  const guestA = await connect(ctx.url);
  guestA.emit('joinRoom', { roomCode: rcA, playerName: 'Guest' });
  await once(guestA, 'roomJoined');

  const leftLobby = once(hostA, 'playerLeft');
  guestA.disconnect();
  const lobbyEvt = await leftLobby;
  assert.equal(lobbyEvt.players.length, 1);

  hostA.disconnect();

  // --- In-game disconnect with only 2 players: remove + end the game ---
  const hostB = await connect(ctx.url);
  hostB.emit('createRoom', { playerName: 'Host', rounds: 1, timePerRound: 15, testWords: ['cat'] });
  const { roomCode: rcB } = await once(hostB, 'roomCreated');

  const guestB = await connect(ctx.url);
  guestB.emit('joinRoom', { roomCode: rcB, playerName: 'Guest' });
  await once(guestB, 'roomJoined');

  hostB.emit('startGame', { roomCode: rcB });
  await once(hostB, 'yourTurn');

  const leftInGame = once(hostB, 'playerLeft');
  const gameOver = once(hostB, 'gameEnded');
  guestB.disconnect();
  const gameEvt = await leftInGame;
  assert.equal(gameEvt.players.length, 1, 'in-game disconnect removes the player');
  assert.equal(gameEvt.playerName, 'Guest');

  const ended = await gameOver;
  assert.equal(ended.players.length, 1);
  assert.equal(ended.players[0].name, 'Host');

  hostB.disconnect();
});

test('drawer disconnects mid-turn → turnEnded fires and the game advances to the next player', async () => {
  const host = await connect(ctx.url);
  host.emit('createRoom', { playerName: 'Host', rounds: 1, timePerRound: 15, testWords: ['cat', 'dog'] });
  const { roomCode } = await once(host, 'roomCreated');

  const guest1 = await connect(ctx.url);
  guest1.emit('joinRoom', { roomCode, playerName: 'Guest1' });
  await once(guest1, 'roomJoined');

  const guest2 = await connect(ctx.url);
  guest2.emit('joinRoom', { roomCode, playerName: 'Guest2' });
  await once(guest2, 'roomJoined');

  host.emit('startGame', { roomCode });
  await once(host, 'yourTurn'); // host is the drawer
  const firstTurn = await once(guest1, 'newTurn');
  assert.equal(firstTurn.drawerName, 'Host');

  // Drawer leaves mid-turn. Expect: playerLeft + turnEnded + (after 3s) newTurn for the replacement drawer.
  const turnEnded = once(guest1, 'turnEnded');
  const newTurn = once(guest1, 'newTurn', { timeout: 5000 });
  host.disconnect();

  const ended = await turnEnded;
  assert.equal(ended.word, 'cat');

  const fresh = await newTurn;
  // After Host (drawer index 0) is removed, Guest1 shifts into slot 0 and draws next.
  assert.equal(fresh.drawerName, 'Guest1');
  assert.equal(fresh.wordLength, 3); // 'dog'

  guest1.disconnect();
  guest2.disconnect();
});

test('host disconnect in lobby transfers host to next player', async () => {
  const host = await connect(ctx.url);
  host.emit('createRoom', { playerName: 'OriginalHost', rounds: 1, timePerRound: 15 });
  const { roomCode } = await once(host, 'roomCreated');

  const guest = await connect(ctx.url);
  guest.emit('joinRoom', { roomCode, playerName: 'Heir' });
  await once(guest, 'roomJoined');

  const leftEvt = once(guest, 'playerLeft');
  host.disconnect();
  const evt = await leftEvt;
  assert.equal(evt.players.length, 1);
  assert.equal(evt.players[0].name, 'Heir');
  assert.equal(evt.players[0].isHost, true, 'new host badge transferred');

  guest.disconnect();
});

test('late joiner gets handicap equal to lowest current score', async () => {
  const host = await connect(ctx.url);
  host.emit('createRoom', { playerName: 'Host', rounds: 3, timePerRound: 15, testWords: ['cat', 'dog', 'pig'] });
  const { roomCode } = await once(host, 'roomCreated');

  const guest = await connect(ctx.url);
  guest.emit('joinRoom', { roomCode, playerName: 'Guest' });
  await once(guest, 'roomJoined');

  host.emit('startGame', { roomCode });
  await once(host, 'yourTurn');

  guest.emit('guess', { roomCode, word: 'cat' });
  const correct = await once(guest, 'correctGuess');
  const guestScore = correct.score;
  assert.ok(guestScore > 0);

  // Late joiner enters: handicap should equal min score across existing players.
  // Host has 0, Guest has guestScore → lowest is 0.
  const latecomer = await connect(ctx.url);
  latecomer.emit('joinRoom', { roomCode, playerName: 'Late' });
  const joined = await once(latecomer, 'roomJoined');
  assert.equal(joined.player.handicap, 0);
  assert.equal(joined.player.score, 0);
  assert.equal(joined.gameStarted, true);

  host.disconnect();
  guest.disconnect();
  latecomer.disconnect();
});
