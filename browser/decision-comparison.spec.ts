import { expect, test } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { createExpedition } from '../src/simulation/expedition';
import { exportExpeditionRecord } from '../src/records/contract';
import { openPanel, closePanel } from './panels';

test('Jev and baseline choices link to labeled targets and saved history without implying an outcome', async ({ page }) => {
  test.setTimeout(90_000);
  await page.clock.install();
  await page.clock.pauseAt(new Date());
  let calls = 0;
  page.on('request', request => { if (request.url().endsWith('/api/decision')) calls++; });
  await page.goto('/');
  await openPanel(page, 'Mission');
  await page.getByRole('combobox', { name: 'Expedition controller' }).selectOption('typesafe');
  await page.getByRole('button', { name: 'Start expedition' }).click();
  const card = page.getByRole('region', { name: 'Latest decision' });
  await expect(card).toContainText('Different choices');
  await page.getByRole('button', { name: 'Inspect decisions', exact: true }).click();
  const comparison = page.getByLabel('Decision 1 details').getByLabel('Decision comparison', { exact: true });
  await expect(comparison).toContainText('Jev selected');
  await expect(comparison).toContainText('wait · Rover');
  await expect(comparison).toContainText('Baseline alternative');
  await expect(comparison).toContainText('evidence-priorities-v1');
  await expect(comparison).toContainText('ranked-opportunity');
  await expect(comparison).toContainText('cannot interpret arbitrary free text');
  await expect(comparison).toContainText('does not establish a better expedition outcome');
  await page.clock.runFor(100);
  await expect(page.getByRole('button', { name: /Inspect decision 1 target .*Baseline alternative/ })).toBeAttached();
  await expect(page.getByRole('button', { name: /Inspect decision 1 target .*Selected wait · Rover/ })).toBeAttached();
  await page.clock.fastForward(60_000);
  await expect(page.getByLabel('Remaining expedition time')).toHaveText('18:00');
  expect(calls).toBe(1);
  await comparison.getByRole('heading').scrollIntoViewIfNeeded();
  await page.screenshot({ path: 'test-results/decision-comparison-desktop.png' });
  await closePanel(page);
  await page.getByRole('button', { name: 'Resume expedition' }).click();
  await page.clock.fastForward(5000);
  await expect(card).toContainText('#2');
  await page.getByRole('button', { name: /^Inspect decision 1 at/ }).click();
  await expect(comparison).toContainText('Different choices');
  await expect(page.getByLabel('Decision map context')).toContainText('Decision 1 · 00:00');
  expect(calls).toBe(2);
  await page.getByRole('button', { name: 'Stop expedition' }).click();
  await page.reload();
  await openPanel(page, 'Saved expeditions');
  await page.getByRole('button', { name: /Open expedition/ }).click();
  const saved = page.getByRole('region', { name: 'Saved expedition', exact: true });
  await saved.locator('summary').filter({ hasText: 'Decision 1 ·' }).click();
  await expect(saved.getByLabel('Decision comparison', { exact: true })).toContainText('evidence-priorities-v1');
  const download = page.waitForEvent('download');
  await saved.getByRole('button', { name: 'Export expedition JSON' }).click();
  const exported = await readFile((await (await download).path())!, 'utf8');
  await page.getByLabel('Import expedition JSON').setInputFiles({ name: 'comparison.json', mimeType: 'application/json', buffer: Buffer.from(exported) });
  let replayCalls = 0;
  await page.route('**/api/**', route => { replayCalls++; return route.abort(); });
  await saved.getByRole('button', { name: 'Replay expedition', exact: true }).click();
  const replay = page.getByRole('region', { name: 'Expedition replay' });
  await replay.locator('summary').filter({ hasText: 'Decision 1 ·' }).click();
  await expect(replay.getByLabel('Decision comparison', { exact: true })).toContainText('Different choices');
  expect(replayCalls).toBe(0);
});

for (const choice of ['inspect:sample', 'inspect:sample:avoid-storm']) {
  test(`imported same-target comparison distinguishes complete routes: ${choice}`, async ({ page }) => {
    const session = createExpedition({ scenario: { id: 'routes', name: 'Comparison routes', width: 5, depth: 3,
      base: { x: 0, z: 1 }, sensorRange: 8, obstacles: [], roughTerrain: [], samples: [{ id: 'sample', label: 'Sample',
        position: { x: 4, z: 1 }, properties: ['Rounded grains'], classifications: { 'past-water': 'strong-evidence', 'unusual-minerals': 'unrelated' } }],
      dustStorm: { position: { x: 2, z: 1 }, radius: 0.5, durationMs: 90_000, sensorRange: 0.5, movementEnergyMultiplier: 5 },
    }, controller: { id: 'typesafe', decide: input => ({ selectedCandidateId: choice, confidence: 0,
      probabilities: Object.fromEntries(input.candidates.map(candidate => [candidate.id, 1 / input.candidates.length])) }) } });
    session.dispatch({ type: 'introduce-storm' });
    session.dispatch({ type: 'set-teaching-mode', enabled: true });
    session.dispatch({ type: 'start' });
    session.dispatch({ type: 'stop' });
    const source = exportExpeditionRecord(session.getCompletedRecords()[0]!);
    let calls = 0;
    await page.route('**/api/**', route => { calls++; return route.abort(); });
    await page.goto('/');
    await openPanel(page, 'Saved expeditions');
    await page.getByLabel('Import expedition JSON').setInputFiles({ name: 'routes.json', mimeType: 'application/json', buffer: Buffer.from(source) });
    const saved = page.getByRole('region', { name: 'Saved expedition', exact: true });
    await saved.locator('summary').filter({ hasText: 'Decision 1 ·' }).click();
    const comparison = saved.getByLabel('Decision comparison', { exact: true });
    await expect(comparison).toContainText(choice.endsWith('avoid-storm') ? 'Same complete action' : 'Different choices');
    await expect(comparison).toContainText('Storm detour · 24 s · 12.00 energy');
    if (!choice.endsWith('avoid-storm')) await expect(comparison).toContainText('Direct route · 16 s · 16.00 energy');
    await expect(comparison).toContainText('may still be held or cancelled before execution');
    await expect(saved.getByRole('button', { name: /Inspect decision 1 target .*Baseline alternative · Storm detour/ })).toBeAttached();
    expect(calls).toBe(0);
  });
}

test('pending and failed Jev results display a suggestion without claiming a Jev choice or controller change', async ({ page, request }) => {
  await page.clock.install();
  await page.clock.pauseAt(new Date());
  await page.goto('/');
  await openPanel(page, 'Mission');
  await page.getByRole('combobox', { name: 'Expedition controller' }).selectOption('typesafe');
  await page.getByRole('textbox', { name: 'Mission instructions' }).fill('Hold for browser verification');
  await page.getByRole('button', { name: 'Apply instructions' }).click();
  await page.getByRole('button', { name: 'Start expedition' }).click();
  await page.getByRole('button', { name: /^Inspect decision 1 at/ }).click();
  let comparison = page.getByLabel('Decision 1 details').getByLabel('Decision comparison', { exact: true });
  await expect(comparison).toContainText('Jev pending · No accepted choice');
  await expect(comparison).toContainText('Baseline alternative');
  await expect(comparison).not.toContainText('Jev selected');
  await request.post('http://127.0.0.1:4174/release');
  await expect(comparison).toContainText('Different choices');
  await closePanel(page);
  await page.getByRole('button', { name: 'Stop expedition' }).click();
  await page.getByRole('button', { name: 'Reset expedition' }).click();
  await openPanel(page, 'Mission');
  await page.getByRole('textbox', { name: 'Mission instructions' }).fill('Invalid choice for browser verification');
  await page.getByRole('button', { name: 'Apply instructions' }).click();
  await page.getByRole('button', { name: 'Start expedition' }).click();
  await expect(page.getByLabel('Decision phase', { exact: true })).toHaveText('Failed');
  await page.getByRole('button', { name: /^Inspect decision 1 at/ }).click();
  comparison = page.getByLabel('Decision 1 details').getByLabel('Decision comparison', { exact: true });
  await expect(comparison).toContainText('Jev failed · No accepted choice');
  await expect(comparison).not.toContainText('Jev selected');
  await expect(page.getByLabel('Live expedition status')).toContainText('TypeSafe controller');
  await expect(page.getByLabel('Current action', { exact: true })).toHaveText('Decision paused');
});

test.describe('narrow comparison inspection', () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true });
  test('touch opens readable choices and provenance with usable cameras and transport', async ({ page }) => {
    await page.clock.install();
    await page.clock.pauseAt(new Date());
    await page.goto('/');
    await openPanel(page, 'Mission');
    await page.getByRole('combobox', { name: 'Expedition controller' }).selectOption('typesafe');
    await page.getByRole('button', { name: 'Start expedition' }).tap();
    await expect(page.getByRole('region', { name: 'Latest decision' })).toContainText('Different choices');
    await page.getByRole('button', { name: /^Inspect decision 1 at/ }).tap();
    const comparison = page.getByLabel('Decision 1 details').getByLabel('Decision comparison', { exact: true });
    await comparison.getByRole('heading', { name: /Different choices/ }).scrollIntoViewIfNeeded();
    await expect(comparison.getByRole('heading')).toBeInViewport();
    await expect(comparison).toContainText('wait · Rover');
    await comparison.getByText(/Baseline version:/).scrollIntoViewIfNeeded();
    await expect(comparison.getByText(/Baseline version:/)).toBeInViewport();
    await page.getByRole('button', { name: 'Follow rover', exact: true }).tap();
    await expect(page.getByRole('button', { name: 'Stop expedition' })).toBeInViewport();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.screenshot({ path: 'test-results/decision-comparison-mobile.png' });
    await closePanel(page);
    await page.getByRole('button', { name: 'Resume expedition' }).tap();
    await page.clock.runFor(100);
    await expect(page.getByLabel('Decision phase', { exact: true })).toHaveText('Code executing');
  });
});

test('legacy Jev alternatives remain unavailable during inspection and replay', async ({ page }) => {
  const source = await readFile('tests/fixtures/legacy-comparison-v9.json', 'utf8');
  let calls = 0;
  await page.route('**/api/**', route => { calls++; return route.abort(); });
  await page.clock.install();
  await page.clock.pauseAt(new Date());
  await page.goto('/');
  await openPanel(page, 'Saved expeditions');
  await page.getByLabel('Import expedition JSON').setInputFiles({ name: 'legacy.json', mimeType: 'application/json', buffer: Buffer.from(source) });
  const saved = page.getByRole('region', { name: 'Saved expedition', exact: true });
  await saved.locator('summary').filter({ hasText: 'Decision 1 ·' }).click();
  await expect(saved).toContainText('Baseline alternative unavailable in this legacy record');
  const download = page.waitForEvent('download');
  await saved.getByRole('button', { name: 'Export expedition JSON' }).click();
  expect(JSON.parse(await readFile((await (await download).path())!, 'utf8'))).toEqual(JSON.parse(source));
  await saved.getByRole('button', { name: 'Replay expedition', exact: true }).click();
  const replay = page.getByRole('region', { name: 'Expedition replay' });
  await replay.locator('summary').filter({ hasText: 'Decision 1 ·' }).click();
  await expect(replay).toContainText('Baseline alternative unavailable in this legacy record');
  expect(calls).toBe(0);
});
