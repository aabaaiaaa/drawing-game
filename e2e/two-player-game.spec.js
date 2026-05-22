import { test, expect } from '@playwright/test';
import { openPlayer, createRoom, joinRoom } from './helpers.js';

test('two players play through a full 1-round game with deterministic words', async ({ browser }) => {
  const { context: aliceCtx, page: alice } = await openPlayer(browser, { words: ['cat', 'dog'] });
  const roomCode = await createRoom(alice, { name: 'Alice', rounds: 1, time: 15 });

  const { context: bobCtx, page: bob } = await openPlayer(browser);
  await joinRoom(bob, roomCode, 'Bob');

  await expect(bob.getByRole('heading', { name: 'Game Lobby' })).toBeVisible();
  await expect(alice.getByText('Players (2)')).toBeVisible();

  await alice.getByRole('button', { name: 'Start Game' }).click();

  // Turn 1: Alice draws 'cat', Bob guesses.
  await expect(alice.getByText("It's your turn to draw!")).toBeVisible();
  await expect(bob.getByText('Alice is drawing')).toBeVisible();
  await bob.getByPlaceholder('Type your guess...').fill('cat');
  await bob.getByRole('button', { name: 'Guess' }).click();
  await expect(alice.getByText(/Bob guessed correctly!/)).toBeVisible();

  // Turn 2: Bob draws 'dog', Alice guesses.
  await expect(bob.getByText("It's your turn to draw!")).toBeVisible({ timeout: 10_000 });
  await expect(alice.getByText('Bob is drawing')).toBeVisible();
  await alice.getByPlaceholder('Type your guess...').fill('dog');
  await alice.getByRole('button', { name: 'Guess' }).click();
  await expect(bob.getByText(/Alice guessed correctly!/)).toBeVisible();

  // Game over
  await expect(alice.getByRole('heading', { name: 'Game Over!' })).toBeVisible({ timeout: 10_000 });
  await expect(bob.getByRole('heading', { name: 'Game Over!' })).toBeVisible();
  await expect(alice.locator('tr', { hasText: 'Alice' })).toBeVisible();
  await expect(alice.locator('tr', { hasText: 'Bob' })).toBeVisible();
  await expect(alice.getByText(/wins!$/)).toBeVisible();

  await aliceCtx.close();
  await bobCtx.close();
});
