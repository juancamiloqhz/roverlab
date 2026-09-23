import { openPanel, closePanel } from './panels';
import { expect, test } from '@playwright/test';

for (const viewport of [{ width: 1440, height: 1000 }, { width: 390, height: 844 }]) {
  test(`expanded world has legible regions and usable expedition and camera controls at ${viewport.width}px`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await page.clock.install();
    let requests = 0;
    await page.route('**/api/**', route => { requests++; return route.abort(); });
    await page.goto('/');
    await expect(page.getByLabel('Remaining expedition time')).toHaveText('18:00');
    await openPanel(page, 'Mission');
    await expect(page.getByText(/18-minute expedition/)).toBeVisible();
    await closePanel(page);
    await expect(page.getByLabel('Terrain discovered')).toHaveText('29 / 1596 cells');
    const scene = page.getByRole('region', { name: 'Planetary scene' });
    await expect(scene.getByText('Western delta', { exact: true })).toBeVisible();
    await expect(scene.getByText('Northern highlands', { exact: true })).toHaveCount(0);
    await page.getByRole('checkbox', { name: 'Full-world debugging view' }).check();
    await page.clock.runFor(100);
    for (const name of ['Western delta', 'Northern highlands', 'Eastern volcanic field']) {
      await expect(scene.getByText(name, { exact: true })).toBeVisible();
    }
    await expect(scene.getByText(/Sample [A-L] · Hidden from rover/)).toHaveCount(12);
    await expect(page.getByLabel('Samples discovered')).toHaveText('0');
    await scene.screenshot({ path: `test-results/expanded-world-${viewport.width}.png` });
    await page.getByRole('checkbox', { name: 'Full-world debugging view' }).uncheck();
    await page.getByRole('button', { name: 'Follow rover', exact: true }).click();
    await page.clock.runFor(100);
    await expect(scene.getByText('Rover · 01', { exact: true })).toBeInViewport();
    await page.getByRole('button', { name: 'Start expedition' }).click();
    await page.clock.fastForward(10_000);
    await page.getByRole('button', { name: 'Pause expedition' }).click();
    const time = await page.getByLabel('Remaining expedition time').textContent();
    const position = await page.getByLabel('Rover coordinates').textContent();
    await page.getByRole('button', { name: 'Orbit camera', exact: true }).click();
    await page.getByRole('checkbox', { name: 'Sensor coverage', exact: true }).uncheck();
    await page.getByRole('checkbox', { name: 'Sensor coverage', exact: true }).check();
    await page.clock.runFor(1_000);
    await expect(page.getByLabel('Remaining expedition time')).toHaveText(time!);
    await expect(page.getByLabel('Rover coordinates')).toHaveText(position!);
    await page.getByRole('button', { name: '4×', exact: true }).click();
    await page.getByRole('button', { name: 'Resume expedition' }).click();
    await page.clock.fastForward(1_000);
    await page.getByRole('button', { name: 'Stop expedition' }).click();
    await expect(page.getByRole('heading', { name: 'Stopped by mission control' })).toBeVisible();
    await page.getByRole('button', { name: 'Reset expedition' }).click();
    await expect(page.getByLabel('Remaining expedition time')).toHaveText('18:00');
    await expect(page.getByLabel('Rover coordinates')).toHaveText('16.00 / 24.00');
    await expect(page.getByRole('button', { name: '1×', exact: true })).toHaveAttribute('aria-pressed', 'true');
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    expect(requests).toBe(0);
  });
}
