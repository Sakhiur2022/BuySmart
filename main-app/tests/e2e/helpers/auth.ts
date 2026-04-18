import { expect, type Page, test } from '@playwright/test';

const DEFAULT_BUYER_EMAIL = 'glitch@buysmart.dev';
const DEFAULT_BUYER_PASSWORD = 'BuyerGlitch123!';

export function resolveBuyerCredentials() {
  const email = process.env.E2E_BUYER_EMAIL ?? DEFAULT_BUYER_EMAIL;
  const password = process.env.E2E_BUYER_PASSWORD ?? DEFAULT_BUYER_PASSWORD;

  return { email, password };
}

export async function loginAsBuyer(page: Page) {
  const { email, password } = resolveBuyerCredentials();

  await page.goto('/auth/login');
  await page.locator('#loginEmail').fill(email);
  await page.locator('#loginPassword').fill(password);
  await page.getByRole('button', { name: 'Sign in with email' }).click();

  // Login can route to '/' for buyer or '/buyer' depending on role/profile sync timing.
  await expect(page).toHaveURL(/\/(buyer)?(?:\?.*)?$/, { timeout: 15000 });

  if (
    await page
      .getByText('Email or password is incorrect')
      .isVisible()
      .catch(() => false)
  ) {
    test.skip(true, 'Seeded buyer credentials are unavailable in this environment.');
  }

  if (
    await page
      .getByText('Please confirm your email address')
      .isVisible()
      .catch(() => false)
  ) {
    test.skip(true, 'Seeded buyer email is not confirmed in this environment.');
  }
}
