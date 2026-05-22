import { expect } from '@playwright/test';

export const setRange = (locator, value) =>
  locator.evaluate((el, v) => {
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
    setter.call(el, String(v));
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
  }, value);

/**
 * Open a fresh browser context for one player. Optionally inject deterministic
 * words (only used by the host's createRoom).
 */
export async function openPlayer(browser, { words } = {}) {
  const context = await browser.newContext();
  const page = await context.newPage();
  if (words) {
    await page.addInitScript((w) => { window.__E2E_WORDS = w; }, words);
  }
  return { context, page };
}

/**
 * Host-side: create a room with given settings, return the captured room code.
 */
export async function createRoom(page, { name, rounds, time }) {
  await page.goto('/');
  await page.getByRole('button', { name: 'Create Room' }).click();
  await page.getByPlaceholder('Your Name').fill(name);
  await setRange(page.locator('#rounds'), rounds);
  await setRange(page.locator('#timePerRound'), time);
  await page.getByRole('button', { name: 'Create Room' }).click();
  await expect(page.getByRole('heading', { name: 'Game Lobby' })).toBeVisible();
  await page.waitForURL(/\/room\/[A-Z0-9]{6}$/);
  return page.url().match(/\/room\/([A-Z0-9]{6})$/)[1];
}

/**
 * Guest-side: join via shareable URL.
 */
export async function joinRoom(page, roomCode, name) {
  await page.goto(`/room/${roomCode}`);
  await page.getByPlaceholder('Your Name').fill(name);
  await page.getByRole('button', { name: 'Join Room' }).click();
}

/**
 * Resolve to whichever player is the unique current drawer. Between turns
 * there's a ~5s transition during which the previous drawer's local state
 * hasn't updated yet, so "It's your turn to draw!" can briefly be visible on
 * two pages. Poll until exactly one page shows it.
 */
export async function waitForDrawer(players, { timeout = 15_000, intervalMs = 200 } = {}) {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    const visible = await Promise.all(
      players.map((p) => p.page.getByText("It's your turn to draw!").isVisible()),
    );
    if (visible.filter(Boolean).length === 1) {
      return players[visible.findIndex(Boolean)];
    }
    await new Promise((r) => setTimeout(r, intervalMs));
  }
  throw new Error('Timed out waiting for a unique drawer');
}
