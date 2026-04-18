import { expect, test } from '@playwright/test';
import { loginAsBuyer } from './helpers/auth';

test('buyer can navigate from order detail to product feedback section', async ({ page }) => {
  test.setTimeout(120000);

  await loginAsBuyer(page);

  await page.goto('/buyer/orders', { waitUntil: 'domcontentloaded' });
  await expect(page.getByText('Order history')).toBeVisible();

  const viewDetailsLinks = page.getByRole('link', { name: 'View details' });
  const detailsCount = await viewDetailsLinks.count();
  if (detailsCount === 0) {
    test.skip(true, 'No buyer orders available for order-to-feedback flow validation.');
  }

  await viewDetailsLinks.first().click();
  await expect(page).toHaveURL(/\/buyer\/orders\//);

  const leaveFeedbackLink = page.getByRole('link', { name: 'Leave Feedback' });
  const editFeedbackLink = page.getByRole('link', { name: 'Edit Feedback' });

  if ((await leaveFeedbackLink.count()) > 0) {
    await leaveFeedbackLink.first().click();
    await expect(page).toHaveURL(/\/buyer\/products\/.+\?leaveFeedback=1.*#reviews/);
    await expect(page.getByText('Customer Reviews')).toBeVisible();
    await expect(page.getByLabel('Your review')).toBeVisible();
    return;
  }

  if ((await editFeedbackLink.count()) > 0) {
    await editFeedbackLink.first().click();
    await expect(page).toHaveURL(/\/buyer\/products\/.+\?editFeedback=1.*#reviews/);
    await expect(page.getByText('Customer Reviews')).toBeVisible();
    return;
  }

  test.skip(
    true,
    'No feedback action available for sampled order item (not delivered or hidden by data).',
  );
});
