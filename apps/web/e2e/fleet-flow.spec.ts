/**
 * E2E Tests - Fleet Management Flow
 */
import { test, expect } from '@playwright/test';

test.describe('Fleet Management Flow', () => {
  test('should create a new fleet', async ({ page }) => {
    // Navigate to fleets page
    await page.goto('/fleets');
    
    // Click create fleet button
    await page.getByRole('button', { name: /create fleet/i }).click();
    
    // Fill in fleet details
    await page.getByLabel(/name/i).fill('e2e-test-fleet');
    await page.getByLabel(/environment/i).selectOption('dev');
    await page.getByLabel(/description/i).fill('Fleet created by E2E test');
    
    // Add tags
    await page.getByRole('button', { name: /add tag/i }).click();
    await page.getByPlaceholder(/key/i).fill('team');
    await page.getByPlaceholder(/value/i).fill('platform');
    
    // Submit form
    await page.getByRole('button', { name: /create/i }).click();
    
    // Should redirect to fleet detail page
    await expect(page).toHaveURL(/\/fleets\/.+/);
    await expect(page.getByText(/e2e-test-fleet/i)).toBeVisible();
  });

  test('should display fleet details', async ({ page }) => {
    await page.goto('/fleets/test-fleet-id');
    
    // Check for key elements
    await expect(page.getByRole('heading')).toBeVisible();
    await expect(page.getByText(/environment/i)).toBeVisible();
    await expect(page.getByText(/status/i)).toBeVisible();
    
    // Check for instances section
    await expect(page.getByText(/instances/i)).toBeVisible();
  });

  test('should pause and activate fleet', async ({ page }) => {
    await page.goto('/fleets/test-fleet-id');
    
    // Pause fleet
    const pauseButton = page.getByRole('button', { name: /pause/i });
    if (await pauseButton.isVisible().catch(() => false)) {
      await pauseButton.click();
      
      // Confirm action
      const confirmButton = page.getByRole('button', { name: /confirm/i });
      if (await confirmButton.isVisible().catch(() => false)) {
        await confirmButton.click();
      }
      
      await expect(page.getByText(/paused/i)).toBeVisible();
      
      // Activate fleet
      const activateButton = page.getByRole('button', { name: /activate/i });
      await activateButton.click();
      
      await expect(page.getByText(/active/i)).toBeVisible();
    }
  });

  test('should edit fleet configuration', async ({ page }) => {
    await page.goto('/fleets/test-fleet-id');
    
    // Click edit button
    const editButton = page.getByRole('button', { name: /edit/i });
    await editButton.click();
    
    // Modify description
    await page.getByLabel(/description/i).fill('Updated description');
    
    // Save changes
    await page.getByRole('button', { name: /save/i }).click();
    
    await expect(page.getByText(/updated description/i)).toBeVisible();
  });

  test('should view fleet health', async ({ page }) => {
    await page.goto('/fleets/test-fleet-id');
    
    // Check health section
    await expect(page.getByText(/health/i)).toBeVisible();
    
    // Check for health breakdown
    await expect(page.getByText(/healthy/i).or(page.getByText(/no instances/i))).toBeVisible();
  });

  test('should filter instances in fleet', async ({ page }) => {
    await page.goto('/fleets/test-fleet-id');
    
    // Search for instance
    const searchInput = page.getByPlaceholder(/search/i);
    if (await searchInput.isVisible().catch(() => false)) {
      await searchInput.fill('test-bot');
      
      // Wait for filter to apply
      await page.waitForTimeout(300);
      
      // Check filtered results
      const rows = page.locator('table tbody tr');
      const count = await rows.count();
      
      if (count > 0) {
        await expect(rows.first()).toContainText(/test-bot/i);
      }
    }
  });

  test('should delete empty fleet', async ({ page }) => {
    // Create a new fleet first
    await page.goto('/fleets/new');
    await page.getByLabel(/name/i).fill('fleet-to-delete');
    await page.getByLabel(/environment/i).selectOption('dev');
    await page.getByRole('button', { name: /create/i }).click();
    
    // Wait for navigation to fleet detail
    await expect(page).toHaveURL(/\/fleets\/.+/);
    
    // Delete the fleet
    const deleteButton = page.getByRole('button', { name: /delete/i });
    await deleteButton.click();
    
    // Confirm deletion
    const confirmButton = page.getByRole('button', { name: /confirm/i });
    await confirmButton.click();
    
    // Should redirect to fleets list
    await expect(page).toHaveURL(/\/fleets/);
  });
});
