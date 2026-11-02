import { test as base, expect } from '@playwright/test';
export const test = base.extend({
  page: async ({ page }, runWithPage) => {
    const username = process.env.KNOWLEDGEOS_E2E_USERNAME;
    const password = process.env.KNOWLEDGEOS_E2E_PASSWORD;
    base.skip(
      !username || !password,
      'Configure a dedicated local test administrator to run authenticated browser workflows.',
    );
    await page.goto('/login');
    await page.getByLabel('Username', { exact: true }).fill(username!);
    await page.getByLabel('Password', { exact: true }).fill(password!);
    await page.getByRole('button', { name: 'Sign in', exact: true }).click();
    await expect(
      page.getByRole('button', { name: 'Sign out', exact: true }),
    ).toBeVisible();
    await runWithPage(page);
  },
});
export { expect };
