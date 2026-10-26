// Starts an isolated local Vite server. Pass a Playwright module path if not installed locally.
const { chromium } = require(process.argv[2] || '@playwright/test');
const { mkdirSync } = require('node:fs');
const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const catalog = require('../public/robot-portraits.json').robots;

(async () => {
  const server = spawn(process.execPath, ['node_modules/vite/bin/vite.js', '--host', '127.0.0.1', '--port', '5178', '--strictPort'], { windowsHide: true, stdio: 'ignore' });
  let browser;
  try {
    for (let attempt = 0; attempt < 40; attempt++) {
      try { if ((await fetch('http://127.0.0.1:5178')).ok) break; } catch {}
      if (attempt === 39) throw new Error('Local Vite server unavailable');
      await new Promise(resolve => setTimeout(resolve, 250));
    }
    browser = await chromium.launch({ headless: true, channel: 'chrome' });
    const page = await browser.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    const profile = { id: 'visual-fixture', name: 'Stiletto test fixture', serverNumber: 248, currentSeason: 6,
      ownedHeroes: [], seasonOverrides: {}, ownedRobots: catalog.map(robot => ({ robotId: robot.id, level: 8, upgrades: { fixture: 3 }, cores: { fixture: 2 } })), teamRobotIds: ['Ranger', null, null] };
    const other = { ...profile, id: 'other-fixture', name: 'Other test fixture', ownedRobots: [], teamRobotIds: [null, null, null] };
    await page.goto('http://127.0.0.1:5178');
    await page.evaluate(data => {
      localStorage.setItem('gorillalab.profiles', JSON.stringify(data));
      localStorage.setItem('gorillalab.robot-test-sentinel', 'preserve');
    }, { version: 2, profiles: [profile, other] });
    await page.reload();
    const team = () => page.getByRole('group', { name: 'Team 1 robot', exact: true });
    const ranger = () => team().getByRole('button', { name: /Ranger/ });
    for (const [label, enabled] of [
      ['Monday Space Gorilla', false], ['Tuesday Wise Gorilla', false], ['Wednesday Cyber Gorilla', true],
      ['Thursday Primal Gorilla', false], ['Friday Armed Gorilla', false], ['Saturday Treasure Gorilla', false], ['Sunday Gorilla Warlord', true],
    ]) {
      await page.getByRole('button', { name: label, exact: true }).click();
      assert.equal(await page.locator('.robot-team').count(), enabled ? 3 : 0, label);
      if (enabled) assert.equal(await ranger().getAttribute('aria-pressed'), 'true');
    }
    await ranger().focus(); await page.keyboard.press('Space');
    assert.equal(await ranger().getAttribute('aria-pressed'), 'false');
    await page.keyboard.press('Enter');
    assert.equal(await ranger().getAttribute('aria-pressed'), 'true');
    await page.getByRole('button', { name: 'Player profiles', exact: true }).click();
    await page.getByRole('button', { name: 'Save profile', exact: true }).click();
    let saved = await page.evaluate(() => JSON.parse(localStorage.getItem('gorillalab.profiles')));
    assert.deepEqual(saved.profiles, [profile, other]);
    await page.getByRole('button', { name: /^Other test fixture/ }).click();
    assert.equal(await page.locator('.robot-editor').count(), 0);
    await page.getByRole('button', { name: /^Stiletto test fixture/ }).click();
    await page.reload();
    await page.getByRole('button', { name: 'Wednesday Cyber Gorilla', exact: true }).click();
    assert.equal(await ranger().getAttribute('aria-pressed'), 'true');
    mkdirSync('.preview-validation/robots', { recursive: true });
    for (const width of [320, 390, 768, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      await page.locator('.robot-teams').scrollIntoViewIfNeeded();
      await page.locator('.robot-teams img').evaluateAll(images => Promise.all(images.map(img => img.decode())));
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, `page overflow at ${width}`);
      assert.equal(await page.locator('.robot-team').evaluateAll(nodes => nodes.some(node => node.scrollWidth > node.clientWidth)), false, `selector overflow at ${width}`);
      await page.locator('.robot-teams').screenshot({ path: `.preview-validation/robots/selector-${width}.png` });
      await page.getByRole('button', { name: 'Player profiles', exact: true }).click();
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, `ownership overflow at ${width}`);
      await page.getByRole('button', { name: 'Formation generator', exact: true }).click();
    }
    saved = await page.evaluate(() => JSON.parse(localStorage.getItem('gorillalab.profiles')));
    assert.deepEqual(saved.profiles, [profile, other]);
    assert.equal(await page.evaluate(() => localStorage.getItem('gorillalab.robot-test-sentinel')), 'preserve');
    assert.deepEqual(errors, []);
    console.log('PASS: seven events, keyboard toggles, save/reload, progression, profile isolation, original images, 320/390/768/1440px layouts, no page errors.');
  } finally { await browser?.close(); server.kill(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
