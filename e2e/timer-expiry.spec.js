import { test, expect } from '@playwright/test';
import { openPlayer, createRoom, joinRoom } from './helpers.js';

// 15s per turn × 2 turns + transitions → ~40s of real wall time.
test.setTimeout(90_000);

test('nobody guesses → turnEnded notification reveals the word and game advances', async ({ browser }) => {
  const { context: aCtx, page: alice } = await openPlayer(browser, { words: ['cat', 'dog'] });
  const roomCode = await createRoom(alice, { name: 'Alice', rounds: 1, time: 15 });

  const { context: bCtx, page: bob } = await openPlayer(browser);
  await joinRoom(bob, roomCode, 'Bob');
  await expect(alice.getByText('Players (2)')).toBeVisible();
  await alice.getByRole('button', { name: 'Start Game' }).click();

  // Turn 1: Alice draws 'cat'. Bob silently waits out the 15s timer.
  await expect(bob.getByText('Alice is drawing')).toBeVisible();
  await expect(bob.getByText(/Time's up! The word was: cat/)).toBeVisible({ timeout: 20_000 });

  // Turn 2: Bob draws 'dog'. Alice waits it out too.
  await expect(alice.getByText('Bob is drawing')).toBeVisible({ timeout: 10_000 });
  await expect(alice.getByText(/Time's up! The word was: dog/)).toBeVisible({ timeout: 20_000 });

  // Game ends with zero score for both (no correct guesses).
  await expect(alice.getByRole('heading', { name: 'Game Over!' })).toBeVisible({ timeout: 15_000 });
  const aliceRow = alice.locator('tr', { hasText: 'Alice' });
  const bobRow = alice.locator('tr', { hasText: 'Bob' });
  await expect(aliceRow.locator('td').nth(2)).toHaveText('0');
  await expect(bobRow.locator('td').nth(2)).toHaveText('0');

  await aCtx.close();
  await bCtx.close();
});
