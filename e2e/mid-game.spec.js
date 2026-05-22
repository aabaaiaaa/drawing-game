import { test, expect } from '@playwright/test';
import { openPlayer, createRoom, joinRoom } from './helpers.js';

test.setTimeout(120_000);

test('late joiner enters mid-game, sees current turn, and appears on the final scoreboard with handicap', async ({ browser }) => {
  // 2 rounds × 3 players (after Carol joins) = 6 turns total.
  const words = ['cat', 'dog', 'pig', 'cow', 'bee', 'owl'];

  const { context: aCtx, page: alice } = await openPlayer(browser, { words });
  const roomCode = await createRoom(alice, { name: 'Alice', rounds: 2, time: 15 });

  const { context: bCtx, page: bob } = await openPlayer(browser);
  await joinRoom(bob, roomCode, 'Bob');
  await expect(alice.getByText('Players (2)')).toBeVisible();

  await alice.getByRole('button', { name: 'Start Game' }).click();
  await expect(alice.getByText("It's your turn to draw!")).toBeVisible();

  // Bob banks some points so the lowest score (and therefore Carol's handicap) is 0.
  await bob.getByPlaceholder('Type your guess...').fill('cat');
  await bob.getByRole('button', { name: 'Guess' }).click();
  await expect(alice.getByText(/Bob guessed correctly!/)).toBeVisible();

  // Wait for turn 2 to start (Bob now draws 'dog').
  await expect(bob.getByText("It's your turn to draw!")).toBeVisible({ timeout: 10_000 });

  // Carol joins mid-game via the shareable URL.
  const { context: cCtx, page: carol } = await openPlayer(browser);
  await joinRoom(carol, roomCode, 'Carol');

  // Carol should land directly on the game screen, not the lobby.
  await expect(carol.getByText('Bob is drawing')).toBeVisible({ timeout: 10_000 });
  await expect(carol.getByRole('heading', { name: 'Game Lobby' })).toHaveCount(0);

  // Carol guesses 'dog' (and stays in the game for the rest).
  await carol.getByPlaceholder('Type your guess...').fill('dog');
  await carol.getByRole('button', { name: 'Guess' }).click();
  await expect(bob.getByText(/Carol guessed correctly!/)).toBeVisible();

  // Burn through remaining turns. From turn 3 onward, rotation includes Carol
  // (joined as 3rd player → drawer index 2 onward in the cycle).
  // Just have the non-drawer guess the right word each remaining turn.
  const players = [
    { name: 'Alice', page: alice },
    { name: 'Bob', page: bob },
    { name: 'Carol', page: carol },
  ];

  // Known drawer rotation after Carol joins (server cycles players[0..2]):
  //   turn 2 → drawerIdx 2 (Carol, still round 1)
  //   turn 3 → wraps to 0 (Alice, round 2 begins)
  //   turn 4 → 1 (Bob)
  //   turn 5 → 2 (Carol)
  const rotation = ['Carol', 'Alice', 'Bob', 'Carol'];
  for (let turn = 2; turn < words.length; turn++) {
    const drawerName = rotation[turn - 2];
    const drawer = players.find((p) => p.name === drawerName);
    const guesser = players.find((p) => p !== drawer);

    await expect(drawer.page.getByText("It's your turn to draw!")).toBeVisible({ timeout: 15_000 });
    await guesser.page.getByPlaceholder('Type your guess...').fill(words[turn]);
    await guesser.page.getByRole('button', { name: 'Guess' }).click();
    await expect(drawer.page.getByText(new RegExp(`${guesser.name} guessed correctly!`))).toBeVisible({ timeout: 10_000 });
  }

  // Scoreboard includes Carol; her row shows a '-' handicap (lowest was 0 when she joined).
  await expect(carol.getByRole('heading', { name: 'Game Over!' })).toBeVisible({ timeout: 15_000 });
  const carolRow = carol.locator('tr', { hasText: 'Carol' });
  await expect(carolRow).toBeVisible();
  await expect(carolRow.locator('td').nth(3)).toHaveText('-');

  await aCtx.close();
  await bCtx.close();
  await cCtx.close();
});
