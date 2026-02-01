import { test, expect } from '@playwright/test';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

test.describe('Terminal End-to-End', () => {

  test.beforeAll(async () => {
    // Asegurar que el worker esté corriendo antes de los tests
    console.log('Ensuring worker container is running...');
    try {
      await execAsync('docker start termicoop-worker-1');
      await new Promise(resolve => setTimeout(resolve, 5000));
    } catch (e) {
      console.log('Worker container may already be running');
    }
  });

  test.beforeEach(async ({ page }) => {
    page.on('console', msg => console.log(`[BROWSER]: ${msg.text()}`));
  });

  test('should login, list workers, create session, and persist on reload', async ({ page }) => {
    await page.goto('/');

    const usernameInput = page.locator('input[name="username"]');
    if (await usernameInput.isVisible()) {
        console.log('Logging in...');
        await usernameInput.fill('admin');
        await page.locator('input[name="password"]').fill('dev-change-me');
        await page.getByRole('button', { name: 'Login', exact: true }).click();
    }

    console.log('Waiting for connection...');
    await expect(page.locator('.status.ok')).toHaveText('Conectado', { timeout: 20000 });

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

    console.log('Creating session...');
    await workerItem.locator('.add-session-btn').click();
    
    // Esperar que la sesión aparezca en el sidebar primero
    console.log('Waiting for session item...');
    const sessionItem = page.locator('.session-item').first();
    await expect(sessionItem).toBeVisible({ timeout: 15000 });
    console.log('Session item visible');
    
    // Click en el session item para asegurar que está activo y visible
    await sessionItem.click();
    await page.waitForTimeout(500);
    
    // Esperar que el terminal wrapper esté visible (flex display)
    console.log('Waiting for terminal wrapper...');
    const terminalWrapper = page.locator('.terminal-wrapper').first();
    await expect(terminalWrapper).toBeVisible({ timeout: 15000 });
    
    // Ahora esperar las filas del terminal
    console.log('Waiting for terminal rows...');
    const terminalRows = page.locator('.xterm-rows').first();
    await expect(terminalRows).toBeVisible({ timeout: 15000 });
    console.log('Terminal visible');

    console.log('Testing Terminal IO...');
    await page.locator('.terminal.xterm').first().click();
    const testString = `test-${Date.now()}`;
    await page.waitForTimeout(1500);
    await page.keyboard.type(`echo "${testString}"\n`);
    
    await expect(terminalRows).toContainText(testString, { timeout: 10000 });
    console.log('Terminal IO verified.');

    await page.waitForTimeout(2000);

    console.log('Reloading page to test persistence...');
    await page.reload();
    
    await expect(page.locator('.status.ok')).toHaveText('Conectado', { timeout: 20000 });
    
    console.log('Checking for restored session...');
    const restoredSessionItem = page.locator('.session-item').first();
    await expect(restoredSessionItem).toBeVisible({ timeout: 15000 });
    
    // Click en la sesión restaurada para asegurar visibilidad del terminal
    await restoredSessionItem.click();
    await page.waitForTimeout(500);
    
    await expect(page.locator('.xterm-rows').first()).toBeVisible({ timeout: 10000 });
    console.log('Persistence verified.');
  });
});
