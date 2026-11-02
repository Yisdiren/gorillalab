// Uses an isolated browser context and local Vite server; no real player storage.
const { chromium } = require(process.argv[2] || '@playwright/test');
const { spawn } = require('node:child_process');
const { mkdirSync } = require('node:fs');
const assert = require('node:assert/strict');
(async () => {
  const server = spawn(process.execPath, ['node_modules/vite/bin/vite.js', '--host', '127.0.0.1', '--port', '5179', '--strictPort'], { windowsHide: true, stdio: 'ignore' });
  let browser;
  try {
    for (let attempt = 0; attempt < 40; attempt++) {
      try { if ((await fetch('http://127.0.0.1:5179')).ok) break; } catch {}
      if (attempt === 39) throw Error('Local server unavailable');
      await new Promise(resolve => setTimeout(resolve, 250));
    }
    browser = await chromium.launch({ channel: 'chrome', headless: true });
    const page = await browser.newPage(), errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto('http://127.0.0.1:5179');
    await page.evaluate(() => {
      const profile = { id: 'review-fixture', name: 'Schedule review fixture', serverNumber: 248, currentSeason: 6, ownedHeroes: [], ownedRobots: [], seasonOverrides: {} };
      localStorage.setItem('gorillalab.profiles', JSON.stringify({ version: 2, profiles: [profile] }));
      localStorage.setItem('unrelated-review-sentinel', 'unchanged');
      localStorage.setItem('gorillalab.server-schedules.v1', JSON.stringify({ version: 3, entries: [{ profileId: profile.id, server: 248, cycles: [], calibration: null, clockMode: 'automatic', referenceCalibration: null, recurrence: { enabled: true, anchorDate: '2026-10-26', intervalDays: 14, order: ['space', 'wise', 'cyber', 'primal', 'armed', 'treasure', 'warlord'] } }] }));
    });
    await page.reload();
    await page.getByText('Server schedule & 14-day rotation', { exact: true }).click();
    const original = await page.evaluate(() => localStorage.getItem('gorillalab.server-schedules.v1'));
    const profiles = await page.evaluate(() => localStorage.getItem('gorillalab.profiles'));
    const notice = page.getByLabel('Saved Gorilla order review');
    mkdirSync('.preview-validation/schedule-order-review', { recursive: true });
    for (const width of [320, 390, 768, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      await notice.scrollIntoViewIfNeeded();
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
      await notice.screenshot({ path: `.preview-validation/schedule-order-review/review-${width}.png` });
    }
    await page.getByRole('button', { name: 'Update to current Gorilla order' }).click();
    assert.equal(await page.evaluate(() => localStorage.getItem('gorillalab.server-schedules.v1')), original);
    await page.getByRole('button', { name: 'Cancel', exact: true }).click();
    assert.equal(await page.evaluate(() => localStorage.getItem('gorillalab.server-schedules.v1')), original);
    await page.getByRole('button', { name: 'Update to current Gorilla order' }).click();
    await page.getByRole('button', { name: 'Confirm order update' }).click();
    const updated = await page.evaluate(() => localStorage.getItem('gorillalab.server-schedules.v1'));
    const expected = JSON.parse(original); expected.entries[0].recurrence.order = ['space', 'wise', 'primal', 'cyber', 'armed', 'treasure', 'warlord'];
    assert.deepEqual(JSON.parse(updated), expected);
    await page.reload(); await page.getByText('Server schedule & 14-day rotation', { exact: true }).click();
    assert.equal(await page.getByRole('button', { name: 'Update to current Gorilla order' }).count(), 0);
    assert.equal(await page.evaluate(() => localStorage.getItem('gorillalab.server-schedules.v1')), updated);
    assert.equal(await page.evaluate(() => localStorage.getItem('gorillalab.profiles')), profiles);
    assert.equal(await page.evaluate(() => localStorage.getItem('unrelated-review-sentinel')), 'unchanged');
    assert.deepEqual(errors, []);
    console.log('PASS: 320/390/768/1440px review layouts, explicit confirmation, cancel without writes, exact scoped update, no repeat after reload, unrelated data unchanged, no page errors.');
  } finally { await browser?.close(); server.kill(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
