import { test, expect } from '@playwright/test';

test('has title and renders beerpong table', async ({ page }) => {
  await page.goto('/');

  // Expect a title "to contain" a substring.
  await expect(page.getByRole('heading', { name: 'Beerpong Table' })).toBeVisible();

  // Expect to find sliders for adjusting cups
  const redCupsSlider = page.locator('#red-cups');
  const blueCupsSlider = page.locator('#blue-cups');
  
  await expect(redCupsSlider).toBeVisible();
  await expect(blueCupsSlider).toBeVisible();
});
