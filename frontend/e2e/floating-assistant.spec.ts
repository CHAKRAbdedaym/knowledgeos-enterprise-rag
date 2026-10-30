import { test, expect } from '@playwright/test';

test('quick chat retrieves sources, survives reload, and expands into Research', async ({
  page,
  request,
}) => {
  let conversationId: string | null = null;
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });
  try {
    await page.goto('/documents');
    const launcher = page.getByRole('button', {
      name: 'Open knowledge assistant',
    });
    await expect(launcher).toBeVisible();
    const box = await launcher.boundingBox();
    expect(box!.x).toBeGreaterThan(1300);
    expect(box!.y).toBeGreaterThan(900);
    await launcher.click();
    let panel = page.getByRole('dialog', { name: 'Knowledge assistant' });
    await expect(
      panel.getByRole('textbox', { name: 'Quick chat question', exact: true }),
    ).toBeFocused();
    await panel
      .getByRole('textbox', { name: 'Quick chat question', exact: true })
      .fill('How many remote-work days are allowed per week?');
    await panel
      .getByRole('button', { name: 'Send quick chat question' })
      .click();
    await expect(
      panel.getByText('Cited passages', { exact: true }),
    ).toBeVisible();
    await panel.locator('summary').first().click();
    await expect(panel.locator('details[open]')).toContainText('remote');
    await page.screenshot({
      path: '../docs/screenshots/floating-assistant-desktop.png',
      fullPage: true,
    });
    conversationId = await page.evaluate(() =>
      localStorage.getItem('knowledgeos-quick-chat-id'),
    );
    expect(conversationId).toBeTruthy();
    await page.keyboard.press('Escape');
    await expect(panel).toHaveCount(0);
    await expect(
      page.getByRole('button', { name: 'Open knowledge assistant' }),
    ).toBeFocused();
    await page.reload();
    await page
      .getByRole('button', { name: 'Open knowledge assistant' })
      .click();
    panel = page.getByRole('dialog', { name: 'Knowledge assistant' });
    await expect(
      panel.getByText('Cited passages', { exact: true }),
    ).toBeVisible();
    await panel.getByRole('button', { name: 'Open chat in Research' }).click();
    await expect(page).toHaveURL(/\/research$/);
    await expect(
      page.getByText('Retrieved excerpts', { exact: true }),
    ).toBeVisible();
    await page.setViewportSize({ width: 390, height: 844 });
    await page
      .getByRole('button', { name: 'Open knowledge assistant' })
      .click();
    panel = page.getByRole('dialog', { name: 'Knowledge assistant' });
    await expect(
      panel.getByRole('textbox', { name: 'Quick chat question', exact: true }),
    ).toBeVisible();
    const mobileBox = await panel.boundingBox();
    expect(mobileBox!.x).toBeGreaterThanOrEqual(0);
    expect(mobileBox!.x + mobileBox!.width).toBeLessThanOrEqual(390);
    expect(mobileBox!.y).toBeGreaterThanOrEqual(0);
    expect(mobileBox!.y + mobileBox!.height).toBeLessThanOrEqual(844);
    await page.screenshot({
      path: '../docs/screenshots/floating-assistant-mobile.png',
      fullPage: true,
    });
    await panel.getByRole('button', { name: 'Start a new quick chat' }).click();
    await expect(panel.getByText('A quick question?')).toBeVisible();
    expect(
      await page.evaluate(() =>
        localStorage.getItem('knowledgeos-quick-chat-id'),
      ),
    ).toBeNull();
    expect(errors).toEqual([]);
  } finally {
    if (conversationId)
      await request.delete(`/api/conversations/${conversationId}`);
  }
});
