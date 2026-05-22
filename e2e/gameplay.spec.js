import { test, expect } from '@playwright/test';
import { openPlayer, createRoom, joinRoom } from './helpers.js';

test("wrong guess sharing letters reveals matched positions in the guesser's word display", async ({ browser }) => {
  // Word is 'house', length 5. Guessing 'horse' matches h,o,s,e at indexes 0,1,3,4.
  const { context: aCtx, page: alice } = await openPlayer(browser, { words: ['house'] });
  const roomCode = await createRoom(alice, { name: 'Alice', rounds: 1, time: 15 });

  const { context: bCtx, page: bob } = await openPlayer(browser);
  await joinRoom(bob, roomCode, 'Bob');
  await expect(alice.getByText('Players (2)')).toBeVisible();
  await alice.getByRole('button', { name: 'Start Game' }).click();

  await expect(bob.getByText('Alice is drawing')).toBeVisible();

  // Initial display is 5 underscores separated by spaces.
  const display = bob.locator('.word-display');
  await expect(display).toHaveText('_ _ _ _ _ ');

  await bob.getByPlaceholder('Type your guess...').fill('horse');
  await bob.getByRole('button', { name: 'Guess' }).click();

  // After the wrong guess, positions 0,1,3,4 should show their letters; pos 2 stays _.
  await expect(display).toHaveText('H O _ S E ');

  // Alice (the drawer) still sees the full word, not the underscore display.
  await expect(alice.locator('.word-display')).toHaveText('HOUSE');

  await aCtx.close();
  await bCtx.close();
});

test('guesser can recover from mistakes and still score points on the correct guess', async ({ browser }) => {
  const { context: aCtx, page: alice } = await openPlayer(browser, { words: ['cat', 'dog'] });
  const roomCode = await createRoom(alice, { name: 'Alice', rounds: 1, time: 15 });

  const { context: bCtx, page: bob } = await openPlayer(browser);
  await joinRoom(bob, roomCode, 'Bob');
  await expect(alice.getByText('Players (2)')).toBeVisible();
  await alice.getByRole('button', { name: 'Start Game' }).click();

  await expect(bob.getByText('Alice is drawing')).toBeVisible();
  const guessInput = bob.getByPlaceholder('Type your guess...');

  // Bob fires off a few wrong guesses before landing the right one.
  for (const wrong of ['dog', 'pig', 'rat']) {
    await guessInput.fill(wrong);
    await bob.getByRole('button', { name: 'Guess' }).click();
  }
  await guessInput.fill('cat');
  await bob.getByRole('button', { name: 'Guess' }).click();

  await expect(alice.getByText(/Bob guessed correctly!/)).toBeVisible();

  // Bob's score in his own sidebar updates from "0 pts" to a positive value.
  const bobScore = bob.locator('.game-sidebar .player-item', { hasText: 'Bob' }).locator('.player-score');
  await expect(bobScore).not.toHaveText('0 pts');
  const points = parseInt(await bobScore.innerText(), 10);
  expect(points).toBeGreaterThan(0);

  await aCtx.close();
  await bCtx.close();
});
