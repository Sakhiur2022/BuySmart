import { expect, test } from '@playwright/test';

test('redirects unauthenticated user from checkout to login', async ({ page }) => {
  await page.goto('/buyer/checkout');
  await expect(page).toHaveURL(/\/auth\/login/);
});
