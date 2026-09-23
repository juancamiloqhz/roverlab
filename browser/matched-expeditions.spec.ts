import { expect, test } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { createExpedition } from '../src/simulation/expedition';
import { exportExpeditionRecord } from '../src/records/contract';
import { openPanel } from './panels';

test('launch a fresh baseline in layout A, compare outcomes, and exchange both records without provider access', async ({ page }) => {
  test.setTimeout(60_000);
  const source = createExpedition({ scenario: {
    id: 'browser-matched', name: 'Matched test corridor', width: 8, depth: 1, base: { x: 0, z: 0 },
    sensorRange: 1, obstacles: [], roughTerrain: [], samples: [], durationMs: 20_000,
    dustStorm: { position: { x: 4, z: 0 }, radius: 0.5, durationMs: 10_000, sensorRange: 0.5, movementEnergyMultiplier: 3 },
  }, controller: { id: 'typesafe', decide: input => ({ selectedCandidateId: 'wait:5000', confidence: 1,
    probabilities: Object.fromEntries(input.candidates.map(candidate => [candidate.id, candidate.id === 'wait:5000' ? 1 : 0])) }) } });
  source.dispatch({ type: 'set-mission-preset', preset: 'balanced' });
  source.dispatch({ type: 'start' });
  source.advanceWallTime(5_000);
  source.dispatch({ type: 'introduce-storm' });
  source.dispatch({ type: 'stop' });
  const record = source.getCompletedRecords()[0]!;
  const json = exportExpeditionRecord(record);
  await page.clock.install({ time: new Date('2026-01-01T00:00:00Z') });
  await page.clock.pauseAt(new Date('2026-01-01T00:00:01Z'));
  let requests = 0;
  await page.route('**/api/**', route => { requests++; return route.abort(); });
  await page.goto('/');
  await openPanel(page, 'Saved expeditions');
  await page.getByLabel('Import expedition JSON').setInputFiles({ name: 'source.json', mimeType: 'application/json', buffer: Buffer.from(json) });
  await page.getByRole('button', { name: 'Run matched baseline', exact: true }).click();
  await expect(page.getByLabel('Live expedition status')).toContainText('Baseline controller');
  await expect(page.getByLabel('Remaining expedition time')).toHaveText('00:20');
  await page.clock.fastForward(20_000);
  await page.getByRole('button', { name: 'Compare with source expedition' }).click();
  const comparison = page.getByRole('region', { name: 'Expedition comparison', exact: true });
  await expect(comparison).toContainText('Matching external conditions');
  await expect(comparison).toContainText('Stopped by mission control');
  await expect(comparison).toContainText('Time budget reached');
  await expect(comparison).toContainText('No general advantage follows from one pair');
  await expect(comparison.getByRole('table', { name: 'Inference metrics' })).toContainText('$0.00000000 USD');
  await expect(comparison).toContainText('evidence-priorities-v1');
  await expect(comparison.getByRole('table', { name: 'Recorded preset adherence' })).toContainText('Return margin');
  await page.screenshot({ path: 'test-results/matched-comparison.png' });
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(comparison.getByRole('table', { name: 'Simulation results' })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: 'test-results/matched-comparison-narrow.png' });
  const exports: string[] = [];
  for (const index of [1, 2]) {
    if (index === 2) {
      const library = page.getByRole('region', { name: 'Saved expeditions', exact: true });
      for (const checkbox of await library.getByRole('checkbox').all()) await checkbox.check();
      await library.getByRole('button', { name: 'Compare selected expeditions' }).click();
      // Selection order is library order, so open the generated record by identity below.
      const buttons = await library.getByRole('button', { name: /Open expedition/ }).all();
      for (const button of buttons) if ((await button.getAttribute('aria-label')) !== `Open expedition ${record.id}`) await button.click();
    } else await comparison.getByRole('button', { name: 'Inspect expedition 1' }).click();
    const saved = page.getByRole('region', { name: 'Saved expedition', exact: true });
    const download = page.waitForEvent('download');
    await saved.getByRole('button', { name: 'Export expedition JSON' }).click();
    exports.push(await readFile((await (await download).path())!, 'utf8'));
    await saved.getByRole('button', { name: 'Replay expedition', exact: true }).click();
    await page.clock.fastForward(20_000);
    await expect(saved.getByRole('region', { name: 'Expedition replay', exact: true }).getByRole('status')).toHaveText('Replay complete');
  }
  expect(JSON.parse(exports[0]!)).toEqual(record);
  expect(JSON.parse(exports[1]!).matchedFrom.recordId).toBe(record.id);
  await page.reload();
  await openPanel(page, 'Saved expeditions');
  for (const exported of exports) await page.getByLabel('Import expedition JSON').setInputFiles({ name: 'round-trip.json', mimeType: 'application/json', buffer: Buffer.from(exported) });
  await expect(page.getByRole('region', { name: 'Saved expeditions', exact: true }).getByRole('button', { name: /Open expedition/ })).toHaveCount(2);
  expect(requests).toBe(0);
});

test('legacy matching discloses unavailable usage and rejects unsupported settings without losing the saved record', async ({ page }) => {
  const json = await readFile('tests/fixtures/legacy-usage-v1.json', 'utf8');
  const record = JSON.parse(json);
  await page.clock.install({ time: new Date('2026-01-01T00:00:00Z') });
  await page.clock.pauseAt(new Date('2026-01-01T00:00:01Z'));
  let calls = 0;
  await page.route('**/api/**', route => { calls++; return route.abort(); });
  await page.goto('/');
  await openPanel(page, 'Saved expeditions');
  await page.getByLabel('Import expedition JSON').setInputFiles({ name: 'legacy.json', mimeType: 'application/json', buffer: Buffer.from(json) });
  await page.getByRole('button', { name: 'Run matched baseline', exact: true }).click();
  await expect(page.getByLabel('Remaining expedition time')).toHaveText('05:00');
  await page.getByRole('button', { name: 'Stop expedition', exact: true }).click();
  await page.getByRole('button', { name: 'Compare with source expedition' }).click();
  const comparison = page.getByRole('region', { name: 'Expedition comparison', exact: true });
  await expect(comparison.getByRole('status')).toContainText('Legacy conditions are incomplete');
  await expect(comparison).toContainText('not a matched-priority benchmark');
  await expect(comparison.getByRole('table', { name: 'Inference metrics' })).toContainText('Unavailable in legacy record');
  record.startingConditions.travelTimeMs.plain = 1;
  record.id = '23e1b9e6-4128-4bdb-928a-3582d1f58dca';
  await page.getByLabel('Import expedition JSON').setInputFiles({ name: 'unsupported.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(record)) });
  await page.getByRole('button', { name: 'Run matched baseline', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('not supported');
  await expect(page.getByRole('button', { name: 'Export expedition JSON' })).toBeEnabled();
  expect(calls).toBe(0);
});

test('comparison retains unknown recorded prices, resolved models, and manual stops from a real scripted SDK run', async ({ page }) => {
  await page.goto('/');
  await openPanel(page, 'Mission');
  await page.getByRole('combobox', { name: 'Expedition controller' }).selectOption('typesafe');
  await page.getByRole('textbox', { name: 'Mission instructions' }).fill('Unknown pricing for browser verification');
  await page.getByRole('button', { name: 'Apply instructions' }).click();
  await page.getByRole('button', { name: 'Start expedition' }).click();
  await expect(page.getByLabel('Live estimated inference cost')).toContainText('incomplete');
  await page.getByRole('button', { name: 'Stop expedition' }).click();
  let calls = 0;
  await page.route('**/api/**', route => { calls++; return route.abort(); });
  await openPanel(page, 'Saved expeditions');
  await page.getByRole('button', { name: /Open expedition/ }).click();
  await page.getByRole('button', { name: 'Run matched baseline', exact: true }).click();
  await page.getByRole('button', { name: 'Stop expedition' }).click();
  await page.getByRole('button', { name: 'Compare with source expedition' }).click();
  const comparison = page.getByRole('region', { name: 'Expedition comparison', exact: true });
  await expect(comparison).toContainText('Known subtotal $0.00000000 USD');
  await expect(comparison).toContainText('a lower bound excluding missing usage or prices');
  await expect(comparison).toContainText('Full expedition unfinished');
  await comparison.getByText('Controller versions by decision and submission', { exact: true }).first().click();
  await expect(comparison).toContainText('Resolved model jev-future');
  await expect(comparison).toContainText('Prompt rover-action-v3');
  await expect(comparison).toContainText('Recorded pricing: Unavailable');
  await page.getByRole('button', { name: 'Reset expedition' }).click();
  await openPanel(page, 'Mission');
  await page.getByRole('combobox', { name: 'Expedition controller' }).selectOption('typesafe');
  await expect(page.getByLabel('Live expedition status')).toContainText('TypeSafe');
  await expect(page.getByRole('combobox', { name: 'Expedition controller' })).toHaveValue('typesafe');
  await openPanel(page, 'Saved expeditions');
  await expect(page.getByRole('region', { name: 'Saved expeditions', exact: true }).getByRole('button', { name: /Open expedition/ })).toHaveCount(2);
  expect(calls).toBe(0);
});
