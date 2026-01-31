import { test, expect } from '@playwright/test';

test.describe('Deployment Check', () => {
  test('has title', async ({ page }) => {
    await page.goto('/');

    // Expect a title "to contain" a substring.
    await expect(page).toHaveTitle(/Ultimate Terminal/);
  });

  test('loads the application', async ({ page }) => {
    await page.goto('/');
    
    // Check if root element exists
    const root = page.locator('#root');
    await expect(root).toBeVisible();

    // Check for some text or button that indicates the app started
    // Since we don't know the exact login UI, checking for body content is a safe start
    // If there is an input for password
    const body = page.locator('body');
    await expect(body).not.toBeEmpty();
  });
});
