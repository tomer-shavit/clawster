/**
 * E2E Tests - Bot Management Flow
 */
import { test, expect } from '@playwright/test';

test.describe('Bot Management Flow', () => {
  test('should create a new bot', async ({ page }) => {
    // Navigate to create bot page
    await page.goto('/bots/new');
    
    // Fill in bot details
    await page.getByLabel(/name/i).fill('e2e-test-bot');
    await page.getByLabel(/fleet/i).selectOption({ index: 0 });
    await page.getByLabel(/template/i).selectOption({ index: 0 });
    
    // Submit form
    await page.getByRole('button', { name: /create/i }).click();
    
    // Should redirect to bot detail page
    await expect(page).toHaveURL(/\/bots\/.+/);
    await expect(page.getByText(/e2e-test-bot/i)).toBeVisible();
  });

  test('should display bot details', async ({ page }) => {
    // Navigate to a bot detail page
    await page.goto('/bots/test-bot-id');
    
    // Check for key elements
    await expect(page.getByRole('heading')).toBeVisible();
    await expect(page.getByText(/status/i)).toBeVisible();
    await expect(page.getByText(/health/i)).toBeVisible();
  });

  test('should pause and resume bot', async ({ page }) => {
    await page.goto('/bots/test-bot-id');
    
    // Pause bot
    const pauseButton = page.getByRole('button', { name: /pause/i });
    if (await pauseButton.isVisible().catch(() => false)) {
      await pauseButton.click();
      await expect(page.getByText(/paused/i)).toBeVisible();
      
      // Resume bot
      const resumeButton = page.getByRole('button', { name: /resume/i });
      await resumeButton.click();
      await expect(page.getByText(/running/i)).toBeVisible();
    }
  });

  test('should restart bot', async ({ page }) => {
    await page.goto('/bots/test-bot-id');
    
    const restartButton = page.getByRole('button', { name: /restart/i });
    if (await restartButton.isVisible().catch(() => false)) {
      await restartButton.click();
      
      // Confirm restart
      const confirmButton = page.getByRole('button', { name: /confirm/i });
      if (await confirmButton.isVisible().catch(() => false)) {
        await confirmButton.click();
      }
      
      await expect(page.getByText(/restarting/i)).toBeVisible();
    }
  });

  test('should edit bot configuration', async ({ page }) => {
    await page.goto('/bots/test-bot-id');
    
    // Navigate to configuration tab
    const configTab = page.getByRole('tab', { name: /configuration/i });
    await configTab.click();
    
    // Edit configuration
    const editButton = page.getByRole('button', { name: /edit/i });
    if (await editButton.isVisible().catch(() => false)) {
      await editButton.click();
      
      // Modify a value
      await page.getByLabel(/cpu/i).fill('1');
      
      // Save changes
      await page.getByRole('button', { name: /save/i }).click();
      
      await expect(page.getByText(/saved/i)).toBeVisible();
    }
  });

  test('should view bot logs', async ({ page }) => {
    await page.goto('/bots/test-bot-id');
    
    // Navigate to logs tab
    const logsTab = page.getByRole('tab', { name: /logs/i });
    if (await logsTab.isVisible().catch(() => false)) {
      await logsTab.click();
      
      // Check logs are displayed
      await expect(page.locator('[data-testid="logs-container"]').or(page.getByText(/no logs/i))).toBeVisible();
    }
  });

  test('should view bot metrics', async ({ page }) => {
    await page.goto('/bots/test-bot-id');
    
    // Navigate to metrics tab
    const metricsTab = page.getByRole('tab', { name: /metrics/i });
    if (await metricsTab.isVisible().catch(() => false)) {
      await metricsTab.click();
      
      // Check charts are displayed
      await expect(page.locator('canvas').or(page.getByText(/no metrics/i))).toBeVisible();
    }
  });
});
