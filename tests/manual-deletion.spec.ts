import { test, expect } from '@playwright/test';
import { exec } from 'child_process';
import util from 'util';

const execAsync = util.promisify(exec);

// Config
const NEXUS_URL = 'http://localhost:3002';
const WORKER_CONTAINER = 'termicoop-worker-1';

test.describe('Worker Deletion Manual Test', () => {
    // Increase timeout for docker operations
    test.setTimeout(60000);

    test.beforeAll(async () => {
        // Ensure worker is running initially
        try {
            await execAsync(`docker start ${WORKER_CONTAINER}`);
            // Wait for it to connect
            await new Promise(r => setTimeout(r, 5000));
        } catch (e) {
            console.log('Worker might already be running');
        }
    });

    test.afterAll(async () => {
        // Restore worker state
        try {
            await execAsync(`docker start ${WORKER_CONTAINER}`);
        } catch (e) {
            console.error('Failed to restart worker:', e);
        }
    });

    test('Should detect offline worker and allow deletion', async ({ page }) => {
        // 1. Navigate to Nexus
        console.log(`Navigating to ${NEXUS_URL}`);
        await page.goto(NEXUS_URL);

        // 2. Login
        const usernameInput = page.locator('input[name="username"]');
        if (await usernameInput.isVisible()) {
            console.log('Logging in...');
            await usernameInput.fill('admin');
            await page.locator('input[name="password"]').fill('dev-change-me');
            await page.getByRole('button', { name: 'Login' }).click();
        }

        // 3. Verify Worker is Online
        console.log('Verifying worker online...');
        // Selector for the online worker (not offline)
        const onlineWorker = page.locator('.worker-item:not(.offline)').first();
        await expect(onlineWorker).toBeVisible({ timeout: 10000 });
        
        // Get name to verify later if needed
        const workerName = await onlineWorker.locator('.worker-name').textContent();
        console.log(`Target worker: ${workerName}`);

        // 4. Kill Worker Container
        console.log('Stopping worker container...');
        await execAsync(`docker stop ${WORKER_CONTAINER}`);

        // 5. Wait for Offline Status
        console.log('Waiting for offline status...');
        const offlineWorker = page.locator('.worker-item.offline', { hasText: workerName! });
        await expect(offlineWorker).toBeVisible({ timeout: 15000 });

        // 6. Delete Flow
        console.log('Deleting worker...');
        
        // Option A: Use the Trash Icon in the sidebar
        // Note: The trash icon (delete-worker-btn) should be visible
        // However, I suspect I should use the Modal flow I recently fixed/verified.
        // Let's use the Modal flow as it is more "manual" / deliberate.
        
        // Click "Tag Edit" button (pencil/tag icon)
        await offlineWorker.locator('.tag-edit-btn').click();
        
        // Wait for Modal
        const modal = page.locator('.modal-overlay');
        await expect(modal).toBeVisible();
        
        // Click "Eliminar Worker" red button
        const deleteValidator = page.locator('button.btn-danger', { hasText: 'Eliminar Worker' });
        await expect(deleteValidator).toBeVisible();
        
        // Setup Dialog Handler
        page.once('dialog', async dialog => {
            console.log(`Dialog message: ${dialog.message()}`);
            await dialog.accept();
        });

        // Click Delete
        await deleteValidator.click();

        // 7. Verify Gone
        await expect(offlineWorker).not.toBeVisible({ timeout: 5000 });
        console.log('Worker deleted successfully');
    });
});
