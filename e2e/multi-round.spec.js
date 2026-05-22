import { test, expect } from '@playwright/test';
import { openPlayer, createRoom, joinRoom } from './helpers.js';

test('3 players × 2 rounds: drawer rotates through every player each round', async ({ browser }) => {
  // 3 players × 2 rounds = 6 turns. Words map to (round-1)*3 + drawerIndex.
  const words = ['cat', 'dog', 'pig', 'cow', 'bee', 'owl'];

  const { context: aCtx, page: alice } = await openPlayer(browser, { words });
  const roomCode = await createRoom(alice, { name: 'Alice', rounds: 2, time: 15 });

  const { context: bCtx, page: bob } = await openPlayer(browser);
  await joinRoom(bob, roomCode, 'Bob');
  const { context: cCtx, page: carol } = await openPlayer(browser);
  await joinRoom(carol, roomCode, 'Carol');

  await expect(alice.getByText('Players (3)')).toBeVisible();
  await alice.getByRole('button', { name: 'Start Game' }).click();

  const players = [
    { name: 'Alice', page: alice },
    { name: 'Bob', page: bob },
    { name: 'Carol', page: carol },
  ];

  for (let turn = 0; turn < words.length; turn++) {
    const drawer = players[turn % 3];
    const word = words[turn];
    const expectedRound = Math.floor(turn / 3) + 1;

    // The drawer sees "It's your turn to draw!". The first non-drawer guesses.
    await expect(drawer.page.getByText("It's your turn to draw!")).toBeVisible({ timeout: 10_000 });
    await expect(drawer.page.getByText(new RegExp(`Round ${expectedRound} / 2`))).toBeVisible();

    const guesser = players.find((p) => p !== drawer);
    await guesser.page.getByPlaceholder('Type your guess...').fill(word);
    await guesser.page.getByRole('button', { name: 'Guess' }).click();

    await expect(drawer.page.getByText(new RegExp(`${guesser.name} guessed correctly!`))).toBeVisible();
  }

  // Game over for everyone with all three on the scoreboard.
  for (const p of players) {
    await expect(p.page.getByRole('heading', { name: 'Game Over!' })).toBeVisible({ timeout: 15_000 });
    await expect(p.page.locator('tr', { hasText: 'Alice' })).toBeVisible();
    await expect(p.page.locator('tr', { hasText: 'Bob' })).toBeVisible();
    await expect(p.page.locator('tr', { hasText: 'Carol' })).toBeVisible();
  }

  await aCtx.close();
  await bCtx.close();
  await cCtx.close();
});
