import type { Page } from '@playwright/test';

// Navigate the same visible panel controls a user operates.
export async function openPanel(page: Page, name: 'Mission' | 'Evidence' | 'Usage & recovery' | 'Saved expeditions') {
  const button = page.getByRole('navigation', { name: 'Expedition panels' }).getByRole('button', { name, exact: true });
  if (await button.getAttribute('aria-expanded') !== 'true') await button.click();
}

export async function closePanel(page: Page) {
  const button = page.getByRole('button', { name: 'Close panel', exact: true });
  if (await button.isVisible()) await button.click();
}
