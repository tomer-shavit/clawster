/**
 * E2E Tests - Dashboard Page
 */
import { test, expect } from '@playwright/test';

test.describe('Dashboard Page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('should display dashboard heading', async ({ page }) => {
    await expect(page.getByRole('heading', { name: /fleet health/i })).toBeVisible();
  });

  test('should display summary cards', async ({ page }) => {
    await expect(page.getByText(/total bots/i)).toBeVisible();
    await expect(page.getByText(/healthy/i)).toBeVisible();
    await expect(page.getByText(/degraded/i)).toBeVisible();
  });

  test('should display fleet list', async ({ page }) => {
    await expect(page.getByRole('table')).toBeVisible();
    await expect(page.getByText(/fleets/i)).toBeVisible();
  });

  test('should navigate to fleet details on click', async ({ page }) => {
    const firstFleetRow = page.locator('table tbody tr').first();
    await firstFleetRow.click();
    
    // Should navigate to fleet detail page
    await expect(page).toHaveURL(/\/fleets\/.+/);
  });

  test('should refresh dashboard data', async ({ page }) => {
    const refreshButton = page.getByRole('button', { name: /refresh/i });
    
    if (await refreshButton.isVisible().catch(() => false)) {
      await refreshButton.click();
      // Wait for data to refresh
      await page.waitForTimeout(500);
    }
  });
});
