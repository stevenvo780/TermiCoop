import { test, expect } from '@playwright/test';

test.describe('Terminal End-to-End', () => {

  test.beforeEach(async ({ page }) => {
    // Enable console logging from the browser to the terminal
    page.on('console', msg => console.log(`[BROWSER]: ${msg.text()}`));
  });

  test('should login, list workers, create session, and persist on reload', async ({ page }) => {
    // 1. Navigate to app
    await page.goto('/');

    // 2. Login if needed
    const usernameInput = page.locator('input[name="username"]');
    if (await usernameInput.isVisible()) {
        console.log('Logging in...');
        await usernameInput.fill('admin');
        await page.locator('input[name="password"]').fill('dev-change-me');
        await page.getByRole('button', { name: 'Login', exact: true }).click();
    }

    // 3. Wait for Connection
    console.log('Waiting for connection...');
    await expect(page.locator('.status.ok')).toHaveText('Conectado', { timeout: 20000 });

    // 4. Find Online Worker (Docker-Dev-Worker)
    console.log('Searching for online worker...');
    const onlineWorkerSelector = '.worker-item:not(.offline)';
    try {
        await expect(page.locator(onlineWorkerSelector).first()).toBeVisible({ timeout: 20000 });
    } catch (e) {
        console.log('No online worker found. Dumping info...');
        const status = await page.locator('.status').textContent();
        console.log(`Current status: ${status}`);
        const workers = await page.locator('.worker-item').allTextContents();
        console.log(`Visible workers: ${JSON.stringify(workers)}`);
        throw e;
    }

    const workerItem = page.locator(onlineWorkerSelector).first();
    const workerName = await workerItem.locator('.worker-name').textContent();
    console.log(`Found online worker: ${workerName}`);

    // 5. Create Session
    console.log('Creating session...');
    await workerItem.locator('.add-session-btn').click();

    // Verify terminal appears
    await expect(page.locator('.session-item').first()).toBeVisible();
    const terminalRows = page.locator('.xterm-rows');
    await expect(terminalRows).toBeVisible({ timeout: 10000 });

    // 6. Test Terminal IO
    console.log('Testing Terminal IO...');
    await page.locator('.terminal.xterm').first().click();
    const testString = `test-${Date.now()}`;
    await page.waitForTimeout(2000); // Wait for PTY to be ready
    await page.keyboard.type(`echo "${testString}"\n`);
    
    // Check output
    await expect(terminalRows).toContainText(testString, { timeout: 10000 });
    console.log('Terminal IO verified.');

    // Wait for persistence (debounce is 800ms)
    await page.waitForTimeout(1500);

    // 7. Test Persistence (Reload)
    console.log('Reloading page to test persistence...');
    await page.reload();
    
    // Wait for connection again
    await expect(page.locator('.status.ok')).toHaveText('Conectado', { timeout: 20000 });
    
    // Verify sessions passed to "Restoring sessions..."
    // App.tsx stores session in localStorage.
    // It should auto-rehydrate.
    console.log('Checking for restored session...');
    await expect(page.locator('.session-item').first()).toBeVisible({ timeout: 10000 });
    
    // Verify terminal is still active/visible
    await expect(page.locator('.xterm-rows')).toBeVisible();
    console.log('Persistence verified.');
  });
});
