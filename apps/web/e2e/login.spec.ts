import { test, expect } from '@playwright/test';

test.describe('Login Flow', () => {
  test('should allow user to enter phone number and redirect', async ({ page }) => {
    // Go to the login page
    await page.goto('/login');

    // Check that we are on the login page
    await expect(page).toHaveTitle(/Login/i);
    await expect(page.getByRole('heading', { name: 'Login' })).toBeVisible();

    // Fill in the phone number
    await page.fill('input[type="tel"]', '+1234567890');

    // Click the login button
    // Assuming backend returns success, it should redirect or show a loading state
    // We intercept the network request to mock the backend response for the E2E test
    await page.route('**/auth/login', async route => {
      const json = { access_token: 'fake-token', refresh_token: 'fake-refresh' };
      await route.fulfill({ json });
    });

    await page.click('button[type="submit"]');

    // After login, it redirects to /tournaments
    await expect(page).toHaveURL(/\/tournaments/);
  });
});
