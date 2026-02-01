import { test, expect } from '@playwright/test';
import { exec } from 'child_process';
import util from 'util';

const execAsync = util.promisify(exec);

const NEXUS_URL = 'http://localhost:3002';
const WORKER_CONTAINER = 'termicoop-worker-1';

test.describe('Worker Deletion Manual Test', () => {
    test.setTimeout(60000);

    test.beforeAll(async () => {
        try {
            await execAsync(`docker start ${WORKER_CONTAINER}`);
            await new Promise(r => setTimeout(r, 5000));
        } catch (e) {
            console.log('Worker might already be running');
        }
    });

    test.afterAll(async () => {
        try {
            await execAsync(`docker start ${WORKER_CONTAINER}`);
        } catch (e) {
            console.error('Failed to restart worker:', e);
        }
    });

    test('Should detect offline worker and allow deletion', async ({ page }) => {
        console.log(`Navigating to ${NEXUS_URL}`);
        await page.goto(NEXUS_URL);

        const usernameInput = page.locator('input[name="username"]');
        if (await usernameInput.isVisible()) {
            console.log('Logging in...');
            await usernameInput.fill('admin');
            await page.locator('input[name="password"]').fill('dev-change-me');
            await page.getByRole('button', { name: 'Login' }).click();
        }

        console.log('Verifying worker online...');
        const onlineWorker = page.locator('.worker-item:not(.offline)').first();
        await expect(onlineWorker).toBeVisible({ timeout: 10000 });
        
        const workerName = await onlineWorker.locator('.worker-name').textContent();
        console.log(`Target worker: ${workerName}`);

        console.log('Stopping worker container...');
        await execAsync(`docker stop ${WORKER_CONTAINER}`);

        console.log('Waiting for offline status...');
        const offlineWorker = page.locator('.worker-item.offline', { hasText: workerName! });
        await expect(offlineWorker).toBeVisible({ timeout: 15000 });

        console.log('Deleting worker...');
        
        await offlineWorker.locator('.tag-edit-btn').click();
        const modal = page.locator('.modal-overlay');
        await expect(modal).toBeVisible();
        const deleteValidator = page.locator('button.btn-danger', { hasText: 'Eliminar Worker' });
        await expect(deleteValidator).toBeVisible();
        page.once('dialog', async dialog => {
            console.log(`Dialog message: ${dialog.message()}`);
            await dialog.accept();
        });

        await deleteValidator.click();

        await expect(offlineWorker).not.toBeVisible({ timeout: 5000 });
        console.log('Worker deleted successfully');
    });
});
