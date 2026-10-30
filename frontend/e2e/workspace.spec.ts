import { test, expect } from '@playwright/test';

test('real research, document lifecycle, responsive navigation and screenshots', async ({
  page,
}) => {
  const failures: string[] = [];
  page.on('pageerror', (error) => failures.push(error.message));
  page.on('console', (msg) => {
    if (msg.type() === 'error') failures.push(msg.text());
  });
  await page.goto('/');
  await expect(
    page.locator('.stat-card').first().or(page.locator('.kpi-card').first()),
  ).toBeVisible();
  await page.screenshot({
    path: '../docs/screenshots/overview-desktop.png',
    fullPage: true,
  });
  await page.goto('/documents');
  await expect(
    page.getByRole('heading', { name: 'Knowledge Base', exact: true }),
  ).toBeVisible();
  await expect(page.locator('.document-table tbody tr')).toHaveCount(20);
  await page.getByLabel('Search documents').fill('remote');
  await expect(page.locator('.document-table tbody tr').first()).toBeVisible();
  await page.getByLabel('Clear document search').click();
  await page.getByLabel('Grid view').click();
  await expect(page.locator('.document-card')).toHaveCount(20);
  await page.screenshot({
    path: '../docs/screenshots/knowledge-base.png',
    fullPage: true,
  });

  const title = `Browser synthetic beacon ${Date.now()}`;
  await page
    .getByRole('button', { name: 'Upload document', exact: true })
    .click();
  await page.getByLabel('Choose document file').setInputFiles({
    name: 'browser-beacon.md',
    mimeType: 'text/markdown',
    buffer: Buffer.from(
      `# ${title}\n\nSYNTHETIC test fixture. The Zephyr lighthouse maintenance team uses the violet compass authorization phrase. Lighthouse maintenance starts Tuesday at 06:35. The fictional Navigation department owns approval.`,
    ),
  });
  await page.getByRole('button', { name: 'Upload & index' }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.getByRole('heading', { name: title })).toBeVisible();
  await page.getByRole('heading', { name: title }).click();
  await expect(page.getByText(/violet compass/).first()).toBeVisible();
  await page
    .getByRole('dialog')
    .getByRole('button', { name: /reindex/i })
    .click();
  await page
    .getByRole('button', { name: /confirm reindex|reindex document/i })
    .last()
    .click();
  await expect(
    page.getByRole('dialog').getByText('Indexed', { exact: true }).first(),
  ).toBeVisible();
  await page.keyboard.press('Escape');

  await page.goto('/research');
  await page
    .getByLabel('Research question')
    .fill(
      'What authorization phrase does the Zephyr lighthouse maintenance team use?',
    );
  await page.getByLabel('Send question').click();
  await expect(
    page.getByText('Retrieved excerpts', { exact: true }),
  ).toBeVisible();
  await page.locator('.source-chips button').first().click();
  await expect(page.locator('.source-passage')).toContainText('violet compass');
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Retrieval trace' }).click();
  await expect(page.getByRole('dialog')).toContainText('Matched chunks');
  await page.keyboard.press('Escape');
  await page.screenshot({
    path: '../docs/screenshots/research-citations.png',
    fullPage: true,
  });
  await page.reload();
  await page.locator('.conversation-item button').first().click();
  await expect(
    page.getByText('Retrieved excerpts', { exact: true }),
  ).toBeVisible();
  await page
    .getByLabel('Research question')
    .fill('How do I bake a sourdough loaf with rye flour?');
  await page.getByLabel('Send question').click();
  await expect(
    page.getByText('Insufficient evidence', { exact: true }),
  ).toBeVisible();

  await page.goto('/documents');
  await page.getByLabel('Search documents').fill(title);
  await page.locator('.document-name').click();
  await page
    .getByRole('dialog')
    .getByRole('button', { name: /delete/i })
    .click();
  await page
    .getByRole('button', { name: 'Delete document', exact: true })
    .last()
    .click();
  await expect(page.getByText('No matching documents')).toBeVisible();

  for (const path of ['/analytics', '/architecture', '/settings']) {
    await page.goto(path);
    await expect(page.locator('h1')).toBeVisible();
  }
  for (const [name, width, height] of [
    ['tablet', 768, 1024],
    ['mobile', 390, 844],
  ] as const) {
    await page.setViewportSize({ width, height });
    for (const path of [
      '/',
      '/research',
      '/documents',
      '/analytics',
      '/architecture',
      '/settings',
    ]) {
      await page.goto(path);
      await expect(page.locator('h1')).toBeVisible();
      await page.waitForLoadState('networkidle');
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth > window.innerWidth + 1,
      );
      expect(overflow, `${path} horizontal overflow at ${width}px`).toBe(false);
    }
    await page.goto('/');
    await expect(page.locator('.stat-card').first()).toBeVisible();
    await page.waitForLoadState('networkidle');
    await page.screenshot({
      path: `../docs/screenshots/overview-${name}.png`,
      fullPage: true,
    });
  }
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto('/');
  await page.getByLabel('Switch to dark theme').click();
  await expect(page.locator('html')).toHaveClass(/dark/);
  await page.reload();
  await expect(page.locator('html')).toHaveClass(/dark/);
  await expect(page.locator('.stat-card').first()).toBeVisible();
  await page.screenshot({
    path: '../docs/screenshots/overview-dark.png',
    fullPage: true,
  });
  await page.getByLabel('Switch to light theme').click();
  expect(failures).toEqual([]);
});
