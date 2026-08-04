import { test, expect } from '@playwright/test';

test('has title and renders beerpong table', async ({ page }) => {
  await page.goto('/');

  // Expect a title "to contain" a substring.
  await expect(page.getByRole('heading', { name: /Das ultimative Turnier-Tool|Willkommen zurück/ })).toBeVisible();

  // Expect the Beerpong logo/title to be visible
  await expect(page.getByText('Bierpong', { exact: true })).toBeVisible();
});
