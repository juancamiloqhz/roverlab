import { expect, test } from '@playwright/test';

test('layout A keeps live resources and controls over the world while keyboard panels open and close', async ({ page }) => {
  await page.clock.install();
  await page.goto('/');
  const scene = page.getByRole('region', { name: 'Planetary scene' });
  await expect.poll(async () => (await scene.locator('canvas').boundingBox())?.width).toBe(1440);
  expect((await scene.locator('canvas').boundingBox())!.height).toBeGreaterThan(750);
  const telemetry = page.getByRole('region', { name: 'Live expedition telemetry' });
  await expect(telemetry.getByLabel('Remaining expedition time')).toBeVisible();
  for (const name of ['Battery charge', 'Cargo capacity', 'Science score', 'Live provider attempts', 'Live estimated inference cost']) {
    await expect(telemetry.getByLabel(name, { exact: true })).toBeVisible();
  }
  const mission = page.getByRole('button', { name: 'Mission', exact: true });
  await mission.focus();
  await page.keyboard.press('Enter');
  const panel = page.getByRole('complementary', { name: 'Expedition panel' });
  await expect(panel.getByRole('combobox', { name: 'Expedition controller' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Start expedition' })).toBeInViewport();
  await page.keyboard.press('Escape');
  await expect(panel).toBeHidden();
  await expect(mission).toBeFocused();
  await page.getByRole('button', { name: 'Start expedition' }).click();
  await page.clock.runFor(500);
  await expect(page.getByLabel('Decision phase', { exact: true })).toHaveText('Code executing');
  await expect(page.getByRole('region', { name: 'Latest decision' })).toContainText('Baseline controller');
  await page.getByRole('button', { name: 'Pause expedition' }).click();
  await expect(page.getByLabel('Decision phase', { exact: true })).toHaveText('Paused');
  await page.getByRole('button', { name: 'Inspect decisions', exact: true }).click();
  await expect(panel.getByRole('region', { name: 'Decision timeline' })).toBeVisible();
  await page.keyboard.press('Escape');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: 'test-results/fullscreen-desktop.png' });
});

test.describe('narrow touch layout', () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true });
  test('telemetry, touch cameras, panel scrolling and transport remain reachable', async ({ page }) => {
    await page.clock.install();
    await page.clock.pauseAt(new Date());
    await page.goto('/');
    await page.clock.runFor(100);
    await page.getByRole('button', { name: 'Start expedition' }).tap();
    await page.clock.runFor(1000);
    await page.getByRole('button', { name: 'Pause expedition' }).tap();
    const remaining = await page.getByLabel('Remaining expedition time').textContent();
    await page.getByRole('button', { name: 'Follow rover', exact: true }).tap();
    await page.clock.runFor(100);
    await expect(page.getByRole('button', { name: 'Follow rover', exact: true })).toHaveAttribute('aria-pressed', 'true');
    await page.getByRole('button', { name: 'Mission', exact: true }).tap();
    await page.clock.runFor(500);
    const panel = page.getByRole('complementary', { name: 'Expedition panel' });
    await panel.getByRole('textbox', { name: 'Mission instructions' }).fill('Inspect water evidence.');
    await panel.getByRole('button', { name: 'Apply instructions' }).tap();
    for (const label of ['Remaining expedition time', 'Battery charge', 'Cargo capacity', 'Science score', 'Live provider attempts', 'Live estimated inference cost']) {
      await expect(page.getByLabel(label, { exact: true })).toBeInViewport();
    }
    const resume = page.getByRole('button', { name: 'Resume expedition' });
    await expect(resume).toBeInViewport();
    expect(await resume.evaluate(button => {
      const rect = button.getBoundingClientRect();
      return button.contains(document.elementFromPoint(rect.x + rect.width / 2, rect.y + rect.height / 2));
    })).toBe(true);
    await expect(page.getByLabel('Remaining expedition time')).toHaveText(remaining!);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth && document.documentElement.scrollHeight <= innerHeight)).toBe(true);
    await page.screenshot({ path: 'test-results/fullscreen-mobile-panel.png' });
    await page.getByRole('button', { name: 'Close panel' }).tap();
    await page.screenshot({ path: 'test-results/fullscreen-mobile.png' });
    const scene = page.getByRole('region', { name: 'Planetary scene' });
    const canvas = scene.locator('canvas');
    const before = await canvas.screenshot();
    const box = (await canvas.boundingBox())!;
    const touch = await page.context().newCDPSession(page);
    await touch.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: 270, y: box.y + 270 }] });
    await touch.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: 310, y: box.y + 280 }] });
    await touch.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await page.clock.runFor(100);
    expect(await canvas.screenshot()).not.toEqual(before);
    await touch.detach();
    await page.clock.runFor(500);
  });
});

test('a pending Jev choice retains labeled history and browsing or camera changes add no requests', async ({ page, request }) => {
  await page.clock.install();
  await page.clock.pauseAt(new Date());
  let submissions = 0;
  page.on('request', request => { if (request.url().endsWith('/api/decision')) submissions++; });
  await page.goto('/');
  await page.getByRole('button', { name: 'Mission', exact: true }).click();
  await page.getByRole('combobox', { name: 'Expedition controller' }).selectOption('typesafe');
  await page.getByRole('button', { name: 'Start expedition' }).click();
  const card = page.getByRole('region', { name: 'Latest decision' });
  await expect(card).toContainText('Wait · 5 seconds');
  await expect(card).toContainText('$0.00004200 USD');
  await expect(card).toContainText('returned choice probability');
  await expect(card).toContainText('Trigger: Expedition started');
  await expect(card).toContainText('ms wall time');
  await page.getByRole('button', { name: 'Mission', exact: true }).click();
  await page.getByRole('textbox', { name: 'Mission instructions' }).fill('Hold for browser verification');
  await page.getByRole('button', { name: 'Apply instructions' }).click();
  await page.getByRole('button', { name: 'Close panel' }).click();
  await page.clock.runFor(5000);
  await expect(page.getByLabel('Decision phase', { exact: true })).toHaveText('Jev choosing');
  await expect(card).toContainText('Previous completed choice · History');
  await expect(card).toContainText('Decision 2. No new answer yet.');
  await expect(card).toContainText('#1 · 00:00');
  expect(submissions).toBe(2);
  const remaining = await page.getByLabel('Remaining expedition time').textContent();
  for (const name of ['Evidence', 'Usage & recovery', 'Saved expeditions']) {
    await page.getByRole('navigation', { name: 'Expedition panels' }).getByRole('button', { name, exact: true }).click();
    await page.getByRole('button', { name: 'Close panel' }).click();
  }
  await page.getByRole('button', { name: 'Follow rover', exact: true }).click();
  await page.getByRole('checkbox', { name: 'Full-world debugging view' }).check();
  await page.clock.runFor(300);
  await expect(page.getByLabel('Remaining expedition time')).toHaveText(remaining!);
  expect(submissions).toBe(2);
  await page.screenshot({ path: 'test-results/fullscreen-pending.png' });
  await page.getByRole('button', { name: 'Pause expedition' }).click();
  await request.post('http://127.0.0.1:4174/release');
  await expect(card).toContainText('#2 · 00:05');
  await expect(page.getByLabel('Decision phase', { exact: true })).toHaveText('Paused');
  await expect(page.getByLabel('Live provider attempts')).toHaveText('2');
  await expect(page.getByLabel('Live estimated inference cost')).toHaveText('$0.00008400 USD');
});

test('fullscreen handles unavailable and rejected requests and follows browser exits', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(document, 'fullscreenEnabled', { configurable: true, value: false });
  });
  await page.goto('/');
  await page.getByRole('button', { name: 'Enter fullscreen' }).click();
  await expect(page.getByRole('status')).toContainText('Fullscreen is unavailable');
  await page.getByRole('button', { name: 'Dismiss fullscreen message' }).click();
  await page.evaluate(() => {
    Object.defineProperty(document, 'fullscreenEnabled', { configurable: true, value: true });
    document.documentElement.requestFullscreen = () => Promise.reject(new Error('denied'));
  });
  await page.getByRole('button', { name: 'Enter fullscreen' }).click();
  await expect(page.getByRole('status')).toContainText('Fullscreen could not open');
  await page.getByRole('button', { name: 'Dismiss fullscreen message' }).click();
  // Browser fullscreen is the external boundary. Model its change events, including an external exit.
  await page.evaluate(() => {
    document.documentElement.requestFullscreen = async () => {
      Object.defineProperty(document, 'fullscreenElement', { configurable: true, value: document.documentElement });
      document.dispatchEvent(new Event('fullscreenchange'));
    };
    document.exitFullscreen = async () => {
      Object.defineProperty(document, 'fullscreenElement', { configurable: true, value: null });
      document.dispatchEvent(new Event('fullscreenchange'));
    };
  });
  await page.getByRole('button', { name: 'Enter fullscreen' }).click();
  await expect(page.getByRole('button', { name: 'Exit fullscreen' })).toHaveAttribute('aria-pressed', 'true');
  await page.getByRole('button', { name: 'Exit fullscreen' }).click();
  await expect(page.getByRole('button', { name: 'Enter fullscreen' })).toHaveAttribute('aria-pressed', 'false');
  await page.getByRole('button', { name: 'Enter fullscreen' }).click();
  await page.evaluate(() => document.exitFullscreen());
  await expect(page.getByRole('button', { name: 'Enter fullscreen' })).toHaveAttribute('aria-pressed', 'false');
  await page.getByRole('button', { name: 'Start expedition' }).click();
  await expect(page.getByRole('button', { name: 'Pause expedition' })).toBeVisible();
});
