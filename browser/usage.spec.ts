import { expect, test } from '@playwright/test';
import { readFile } from 'node:fs/promises';

test('Jev usage exposes token-derived estimates and retains its pricing through save and replay', async ({ page }) => {
  await page.clock.install();
  await page.goto('/');
  await page.getByRole('combobox', { name: 'Expedition controller' }).selectOption('typesafe');
  await page.getByRole('button', { name: 'Start expedition' }).click();
  const usage = page.getByLabel('Inference usage', { exact: true });
  await expect(usage).toContainText('Confirmed provider attempts: 1');
  await expect(usage).toContainText('Local submissions: 1');
  await expect(usage).toContainText('Estimated inference cost: $0.00004200 USD');
  const timeline = page.getByRole('region', { name: 'Decision timeline' });
  await timeline.getByText(/Decision 1 ·/).click();
  await expect(timeline).toContainText('Input tokens: 1000');
  await expect(timeline).toContainText('Output tokens: 40');
  await expect(timeline).toContainText('Resolved model: jev-1.13.0');
  await expect(timeline).toContainText('Input rate: $0.042 per million tokens');
  await expect(timeline).toContainText('Output rate: $0 per million tokens');
  await expect(timeline).toContainText('Prompt version: rover-action-v3');
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.screenshot({ path: 'test-results/jev-usage-mobile.png', fullPage: true });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.getByRole('button', { name: 'Stop expedition' }).click();
  await expect(page.getByText('Saved in this browser', { exact: true })).toBeVisible();
  await page.reload();
  await page.getByRole('button', { name: /Open expedition/ }).click();
  const saved = page.getByRole('region', { name: 'Saved expedition', exact: true });
  await expect(saved).toContainText('Estimated inference cost: $0.00004200 USD');
  await page.route('**/api/decision', route => route.abort());
  await page.getByRole('button', { name: 'Replay expedition', exact: true }).click();
  const replay = page.getByRole('region', { name: 'Expedition replay' });
  await expect(replay).toContainText('Estimated inference cost: $0.00004200 USD');
  await expect(replay).toContainText('original expedition');
  await page.screenshot({ path: 'test-results/jev-usage.png', fullPage: true });
});

test('legacy usage is unavailable while its local counter remains visible', async ({ page }) => {
  await page.goto('/');
  const json = await readFile(new URL('../tests/fixtures/legacy-usage-v1.json', import.meta.url));
  await page.getByLabel('Import expedition JSON').setInputFiles({ name: 'legacy.json', mimeType: 'application/json', buffer: json });
  const saved = page.getByRole('region', { name: 'Saved expedition', exact: true });
  await expect(saved).toContainText('Legacy local submissions: 1');
  await expect(saved).toContainText('Estimated inference cost: Unavailable');
  await saved.getByText(/Decision 1 ·/).click();
  await expect(saved).toContainText('Model and token metadata were not recorded');
});


test('unknown model pricing remains visibly incomplete without guessing a price', async ({ page }) => {
  await page.clock.install();
  await page.goto('/');
  await page.getByRole('combobox', { name: 'Expedition controller' }).selectOption('typesafe');
  await page.getByRole('textbox', { name: 'Mission instructions' }).fill('Unknown pricing for browser verification');
  await page.getByRole('button', { name: 'Apply instructions' }).click();
  await page.getByRole('button', { name: 'Start expedition' }).click();
  const usage = page.getByLabel('Inference usage', { exact: true });
  await expect(usage).toContainText('Confirmed provider attempts: 1');
  await expect(usage).toContainText('Input tokens: 1000');
  await expect(usage).toContainText('Estimated inference cost: Unavailable · incomplete');
  await expect(usage).toContainText('Known estimated inference cost subtotal: $0.00000000 USD');
  await page.getByRole('region', { name: 'Decision timeline' }).getByText(/Decision 1 ·/).click();
  await expect(page.getByLabel('Decision usage', { exact: true })).toContainText('Resolved model: jev-future');
  await expect(page.getByLabel('Decision usage', { exact: true })).toContainText('Pricing basis: Unavailable');
});


test('lost local responses reconcile after stop and reset, save once, and replay without changing exports', async ({ page }) => {
  await page.clock.install();
  await page.goto('/');
  let submissions = 0;
  await page.route('**/api/decision', async route => {
    submissions++;
    await route.fetch();
    await route.abort('failed');
  });
  await page.getByRole('combobox', { name: 'Expedition controller' }).selectOption('typesafe');
  await page.getByRole('button', { name: 'Start expedition' }).click();
  const usage = page.getByLabel('Inference usage', { exact: true });
  await expect(usage).toContainText('Unconfirmed submissions: 1');
  await expect(usage).toContainText('lower bound');
  await page.getByRole('button', { name: 'Stop expedition' }).click();
  await expect(page.getByText('Saved in this browser', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Reset expedition' }).click();
  await page.getByRole('button', { name: 'Refresh inference accounting' }).click();
  await expect(page.getByText('Accounting refresh complete.', { exact: false })).toBeVisible();
  await expect(usage).toContainText('Local submissions: 0');
  await expect(usage).toContainText('Estimated inference cost: $0.00000000 USD');
  await page.getByRole('button', { name: 'Refresh inference accounting' }).click();
  await expect(page.getByText('Accounting refresh complete.', { exact: false })).toBeVisible();
  expect(submissions).toBe(1);
  await expect(page.getByText('Saved in this browser', { exact: true })).toBeVisible();
  await page.reload();
  await page.getByRole('button', { name: /Open expedition/ }).click();
  const saved = page.getByRole('region', { name: 'Saved expedition', exact: true });
  await expect(saved).toContainText('Confirmed provider attempts: 1');
  await expect(saved).toContainText('Provider retries: 0');
  await expect(saved).toContainText('Input tokens: 1000');
  await expect(saved).toContainText('Estimated inference cost: $0.00004200 USD');
  await saved.getByText(/Decision 1 ·/).click();
  await expect(saved.getByLabel('Decision usage', { exact: true })).toContainText('Provider execution: Response received');
  await expect(saved).toContainText('failed');
  let apiCalls = 0;
  await page.route('**/api/**', route => { apiCalls++; return route.abort(); });
  const downloadJson = async () => {
    const pending = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Export expedition JSON' }).click();
    return readFile((await (await pending).path())!, 'utf8');
  };
  const original = await downloadJson();
  await page.getByRole('button', { name: 'Replay expedition', exact: true }).click();
  await expect(page.getByRole('region', { name: 'Expedition replay' })).toContainText('Estimated inference cost: $0.00004200 USD');
  expect(await downloadJson()).toBe(original);
  expect(apiCalls).toBe(0);
  await page.screenshot({ path: 'test-results/jev-failure-accounting.png', fullPage: true });
});
