import { test, expect } from '@playwright/test';

test.describe('Deployment Check', () => {
  test('has title', async ({ page }) => {
    await page.goto('/');

    await expect(page).toHaveTitle(/Ultimate Terminal/);
  });

  test('loads the application', async ({ page }) => {
    await page.goto('/');
    
    const root = page.locator('#root');
    await expect(root).toBeVisible();

    const body = page.locator('body');
    await expect(body).not.toBeEmpty();
  });
});
