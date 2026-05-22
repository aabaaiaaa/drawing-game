import { test, expect } from '@playwright/test';
import { openPlayer, createRoom, joinRoom } from './helpers.js';

test('after game over, host can start a new game; players return to lobby with reset scores and same room code', async ({ browser }) => {
  const { context: aCtx, page: alice } = await openPlayer(browser, { words: ['cat', 'dog'] });
  const roomCode = await createRoom(alice, { name: 'Alice', rounds: 1, time: 15 });

  const { context: bCtx, page: bob } = await openPlayer(browser);
  await joinRoom(bob, roomCode, 'Bob');
  await alice.getByRole('button', { name: 'Start Game' }).click();

  await expect(bob.getByText('Alice is drawing')).toBeVisible();
  await bob.getByPlaceholder('Type your guess...').fill('cat');
  await bob.getByRole('button', { name: 'Guess' }).click();
  await expect(bob.getByText("It's your turn to draw!")).toBeVisible({ timeout: 10_000 });
  await alice.getByPlaceholder('Type your guess...').fill('dog');
  await alice.getByRole('button', { name: 'Guess' }).click();

  await expect(alice.getByRole('heading', { name: 'Game Over!' })).toBeVisible({ timeout: 10_000 });
  await expect(bob.getByRole('heading', { name: 'Game Over!' })).toBeVisible();

  // Non-host sees the waiting message; host has the Start New Game button.
  await expect(bob.getByText(/Waiting for host to start a new game/)).toBeVisible();
  await expect(alice.getByRole('button', { name: 'Start New Game' })).toBeVisible();

  await alice.getByRole('button', { name: 'Start New Game' }).click();

  // Both back in lobby with the same room code visible.
  for (const page of [alice, bob]) {
    await expect(page.getByRole('heading', { name: 'Game Lobby' })).toBeVisible();
    await expect(page.locator('.room-code')).toHaveText(roomCode);
  }

  // Scores reset: lobby player list doesn't show scores, so verify by starting
  // another game and checking the in-game sidebar.
  await alice.getByRole('button', { name: 'Start Game' }).click();
  await expect(alice.getByText("It's your turn to draw!")).toBeVisible({ timeout: 10_000 });

  for (const page of [alice, bob]) {
    const scores = page.locator('.game-sidebar .player-score');
    const texts = await scores.allInnerTexts();
    expect(texts.every((t) => t.trim() === '0 pts')).toBe(true);
  }

  await aCtx.close();
  await bCtx.close();
});
