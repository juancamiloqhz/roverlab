import { openPanel } from './panels';
import { readFile } from 'node:fs/promises';
import { expect, test, type Page } from '@playwright/test';
import { createExpedition } from '../src/simulation/expedition';
import { exportExpeditionRecord } from '../src/records/contract';
import type { ExpeditionRecord } from '../src/simulation/types';
import { authoredScenario } from '../src/simulation/scenario';
import { chooseBaselineAction } from '../src/controllers/baseline';

async function importRecord(page: Page, record: ExpeditionRecord) {
  await openPanel(page, 'Saved expeditions');
  await page.getByLabel('Import expedition JSON').setInputFiles({
    name: 'expedition.json', mimeType: 'application/json', buffer: Buffer.from(exportExpeditionRecord(record)),
  });
  await expect(page.getByRole('region', { name: 'Saved expedition', exact: true })).toBeVisible();
}

test('compare saved expeditions with matching conditions and different instruction histories without changing records or live time', async ({ page }) => {
  const records = ['Inspect nearby samples.', 'Prioritize delivery.'].map((instructions, index) => {
    const session = createExpedition({ controller: index ? { id: 'scripted', decide: input => chooseBaselineAction(input).id } : undefined });
    session.dispatch({ type: 'set-instructions', instructions });
    session.dispatch({ type: 'start' });
    session.advanceWallTime(43_000);
    session.dispatch({ type: 'set-instructions', instructions: 'Return safely.' });
    session.dispatch({ type: 'stop' });
    return session.getCompletedRecords()[0]!;
  });
  await page.clock.install();
  await page.clock.pauseAt(new Date());
  let requests = 0;
  await page.route('**/api/**', route => { requests++; return route.abort(); });
  await page.goto('/');
  for (const record of records) await importRecord(page, record);
  await page.getByRole('button', { name: 'Return to live expedition' }).click();
  await page.getByRole('button', { name: 'Start expedition' }).click();
  await page.clock.fastForward(1_000);
  const library = page.getByRole('region', { name: 'Saved expeditions', exact: true });
  const compare = library.getByRole('button', { name: 'Compare selected expeditions' });
  await openPanel(page, 'Saved expeditions');
  await expect(compare).toBeDisabled();
  await library.getByRole('checkbox', { name: `Compare expedition ${records[0]!.id}`, exact: true }).check();
  await expect(compare).toBeDisabled();
  await library.getByRole('checkbox', { name: `Compare expedition ${records[1]!.id}`, exact: true }).check();
  await compare.click();
  const comparison = page.getByRole('region', { name: 'Expedition comparison', exact: true });
  await expect(comparison.getByRole('status')).toHaveText('Matching starting conditions, objective, rubric, and environmental interventions.');
  await expect(comparison).toContainText('Mission instruction histories differ');
  await expect(comparison).toContainText('Inspect nearby samples.');
  await expect(comparison).toContainText('Prioritize delivery.');
  await expect(comparison).toContainText('Return safely.');
  await expect(comparison).toContainText('Baseline controller');
  await expect(comparison).toContainText('Scripted verification controller');
  const simulation = comparison.getByRole('table', { name: 'Simulation results' });
  await expect(simulation.getByRole('row', { name: /Science score/ })).toHaveText('Science score1010');
  await expect(simulation.getByRole('row', { name: /Samples discovered/ })).toHaveText('Samples discovered11');
  await expect(simulation.getByRole('row', { name: /Samples inspected/ })).toHaveText('Samples inspected11');
  await expect(simulation.getByRole('row', { name: /Ending condition/ })).toContainText('Stopped by mission control');
  await expect(simulation).not.toContainText('latency');
  await expect(comparison.getByRole('table', { name: 'Inference metrics' })).toContainText('Cumulative inference wait (wall time)');
  await page.clock.fastForward(60_000);
  await comparison.getByRole('button', { name: 'Return to live expedition' }).click();
  await expect(page.getByRole('button', { name: 'Resume expedition' })).toBeVisible();
  await expect(page.getByLabel('Remaining expedition time')).toHaveText('17:59');
  await openPanel(page, 'Saved expeditions');
  await library.getByRole('button', { name: `Open expedition ${records[0]!.id}`, exact: true }).click();
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export expedition JSON' }).click();
  expect(JSON.parse(await readFile((await (await download).path())!, 'utf8'))).toEqual(records[0]);
  expect(requests).toBe(0);
});

test('environmental interventions remain visible even when never detected by the rover', async ({ page }) => {
  const records = [5_000, 6_000].map(stormAt => {
    const session = createExpedition();
    session.dispatch({ type: 'start' });
    session.advanceWallTime(stormAt);
    session.dispatch({ type: 'introduce-storm' });
    session.advanceWallTime(10_000 - stormAt);
    session.dispatch({ type: 'stop' });
    return session.getCompletedRecords()[0]!;
  });
  expect(records.every(record => !record.events.some(event => event.type === 'storm-detected'))).toBe(true);
  await page.goto('/');
  for (const record of records) {
    await importRecord(page, record);
    await page.getByRole('checkbox', { name: `Compare expedition ${record.id}`, exact: true }).check();
  }
  await page.getByRole('button', { name: 'Compare selected expeditions' }).click();
  const comparison = page.getByRole('region', { name: 'Expedition comparison', exact: true });
  await expect(comparison.getByRole('status')).toContainText('Conditions differ');
  const conditions = comparison.getByRole('table', { name: 'Comparison conditions' });
  await expect(conditions.getByRole('row', { name: /Starting scenario/ })).toContainText('Match');
  const interventions = conditions.getByRole('row', { name: /Environmental interventions/ });
  await expect(interventions).toContainText('Different');
  await expect(interventions).toContainText('5000 ms');
  await expect(interventions).toContainText('6000 ms');
  await expect(interventions).toContainText('Never detected');
  await expect(interventions).toContainText('radius 4.5');
});

test('comparisons use the effective objective and complete starting conditions rather than scenario identity alone', async ({ page }) => {
  const baseline = createExpedition();
  baseline.dispatch({ type: 'start' });
  baseline.dispatch({ type: 'stop' });
  const reference = baseline.getCompletedRecords()[0]!;
  const changedScenario = structuredClone(authoredScenario);
  changedScenario.samples[2]!.properties = ['Different distant sample properties'];
  const altered = createExpedition({ scenario: changedScenario });
  altered.dispatch({ type: 'start' });
  altered.dispatch({ type: 'stop' });
  const objective = createExpedition();
  objective.dispatch({ type: 'set-objective', objective: 'unusual-minerals' });
  objective.dispatch({ type: 'start' });
  objective.dispatch({ type: 'stop' });
  const settings = structuredClone(reference);
  settings.id = crypto.randomUUID();
  settings.startingConditions.fixedStepMs = 50;
  const storm = createExpedition();
  storm.dispatch({ type: 'introduce-storm' });
  storm.dispatch({ type: 'start' });
  storm.dispatch({ type: 'stop' });
  await page.goto('/');
  await importRecord(page, reference);
  for (const [record, field, detail] of [
    [altered.getCompletedRecords()[0]!, 'Starting scenario', 'Different distant sample properties'],
    [objective.getCompletedRecords()[0]!, 'Scientific objective', 'Find unusual minerals'],
    [settings, 'Simulation settings', 'Simulation step 50 ms'],
    [storm.getCompletedRecords()[0]!, 'Environmental interventions', 'No storm introduced'],
  ] as const) {
    await importRecord(page, record);
    await page.getByRole('checkbox', { name: `Compare expedition ${reference.id}`, exact: true }).check();
    await page.getByRole('checkbox', { name: `Compare expedition ${record.id}`, exact: true }).check();
    await page.getByRole('button', { name: 'Compare selected expeditions' }).click();
    const comparison = page.getByRole('region', { name: 'Expedition comparison', exact: true });
    await expect(comparison.getByRole('status')).toContainText('Conditions differ');
    const row = comparison.getByRole('table', { name: 'Comparison conditions' }).getByRole('row', { name: new RegExp(field) });
    await expect(row).toContainText('Different');
    for (const details of await row.locator('summary').all()) await details.click();
    await expect(row).toContainText(detail);
    await expect(comparison.getByRole('row', { name: /Delivery rubric/ })).toContainText('Match');
    if (record === settings) {
      const other = page.getByRole('checkbox', { name: `Compare expedition ${altered.getCompletedRecords()[0]!.id}`, exact: true });
      await expect(other).toBeDisabled();
      await page.setViewportSize({ width: 390, height: 844 });
      await expect(comparison.getByRole('button', { name: 'Return to live expedition' })).toBeVisible();
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
      await page.screenshot({ path: 'test-results/comparison-mobile.png', fullPage: true });
      await page.setViewportSize({ width: 1440, height: 1000 });
    }
    await page.getByRole('button', { name: 'Clear selection' }).click();
  }
  await page.screenshot({ path: 'test-results/comparison-conditions.png', fullPage: true });
});
