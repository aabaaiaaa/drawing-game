import { test, expect } from '@playwright/test';
import { openPlayer, createRoom, joinRoom, setRange } from './helpers.js';

test('Start Game button is disabled while host is alone in the lobby', async ({ browser }) => {
  const { context, page: alice } = await openPlayer(browser);
  await createRoom(alice, { name: 'Alice', rounds: 1, time: 15 });

  await expect(alice.getByText(/Need at least 2 players/)).toBeVisible();
  await expect(alice.getByRole('button', { name: 'Start Game' })).toBeDisabled();

  await context.close();
});

test('host updates settings → guest sees the new values in the lobby', async ({ browser }) => {
  const { context: aCtx, page: alice } = await openPlayer(browser);
  const roomCode = await createRoom(alice, { name: 'Alice', rounds: 1, time: 15 });

  const { context: bCtx, page: bob } = await openPlayer(browser);
  await joinRoom(bob, roomCode, 'Bob');
  await expect(bob.getByRole('heading', { name: 'Game Lobby' })).toBeVisible();

  // Initial values visible to Bob.
  await expect(bob.getByText('Rounds: 1')).toBeVisible();
  await expect(bob.getByText('Time per Round: 15 seconds')).toBeVisible();

  // Alice bumps rounds to 5 and time to 30.
  await setRange(alice.locator('#lobby-rounds'), 5);
  await setRange(alice.locator('#lobby-time'), 30);

  await expect(bob.getByText('Rounds: 5')).toBeVisible();
  await expect(bob.getByText('Time per Round: 30 seconds')).toBeVisible();

  await aCtx.close();
  await bCtx.close();
});

test('host disconnects in lobby → remaining player is promoted and gains host controls', async ({ browser }) => {
  const { context: aCtx, page: alice } = await openPlayer(browser);
  const roomCode = await createRoom(alice, { name: 'Alice', rounds: 1, time: 15 });

  const { context: bCtx, page: bob } = await openPlayer(browser);
  await joinRoom(bob, roomCode, 'Bob');
  await expect(bob.getByText('Players (2)')).toBeVisible();
  await expect(bob.locator('.player-item', { hasText: 'Alice' }).getByText('HOST')).toBeVisible();
  await expect(bob.getByRole('button', { name: 'Start Game' })).toHaveCount(0);

  await aCtx.close();

  // Bob is now the host: the badge moved AND the host-only controls appear.
  await expect(bob.locator('.player-item', { hasText: 'Bob' }).getByText('HOST')).toBeVisible();
  await expect(bob.getByRole('button', { name: 'Start Game' })).toBeVisible();
  await expect(bob.locator('#lobby-rounds')).toBeVisible();

  await bCtx.close();
});

test('opening /room/UNKNOWN with a name prefilled shows an error and stays on Home', async ({ browser }) => {
  const { context, page } = await openPlayer(browser);

  // The frontend uses window.alert for server errors; capture and dismiss it.
  const alertPromise = new Promise((resolve) => {
    page.once('dialog', async (d) => {
      const msg = d.message();
      await d.dismiss();
      resolve(msg);
    });
  });

  await page.goto('/room/XXXXXX');
  await page.getByPlaceholder('Your Name').fill('Nobody');
  await page.getByRole('button', { name: 'Join Room' }).click();

  const alertMsg = await alertPromise;
  expect(alertMsg).toMatch(/Room not found/);

  // Still on the join screen — no lobby heading appears.
  await expect(page.getByRole('heading', { name: 'Game Lobby' })).toHaveCount(0);

  await context.close();
});
