import { test, expect } from './admin-test';

test('administrator Playground uses real Gemini with trace and citations', async ({
  page,
}) => {
  test.skip(
    process.env.KNOWLEDGEOS_LIVE_E2E !== '1',
    'Opt in to real provider requests with KNOWLEDGEOS_LIVE_E2E=1.',
  );
  let conversationUrl: string | undefined;
  try {
    await page.goto('/research');
    await page
      .getByRole('textbox', { name: 'Research question' })
      .fill('What is the remote work policy?');
    const result = page.waitForResponse(
      (response) =>
        response.request().method() === 'POST' &&
        /\/api\/conversations\/[^/]+\/messages$/.test(response.url()),
    );
    await page
      .getByRole('button', { name: 'Send question', exact: true })
      .click();
    const response = await result;
    conversationUrl = response.url().replace(/\/messages$/, '');
    expect(response.status()).toBe(201);
    const answer = await response.json();
    expect(answer.mode).toBe('grounded');
    expect(answer.content).toMatch(/\[\d+\]/);
    expect(answer.sources.length).toBeGreaterThan(0);
    expect(answer.trace.provider).toBe('gemini');
    expect(answer.trace.model).toBe('gemini-3.5-flash-lite');
    await expect(
      page.getByText('Grounded answer', { exact: true }),
    ).toBeVisible();
    await page.screenshot({
      path: '../docs/screenshots/admin-playground-gemini.png',
      fullPage: true,
    });
    await page.locator('.source-chips button').first().click();
    await expect(page.getByRole('dialog')).toBeVisible();
  } finally {
    if (conversationUrl) {
      const session = await page.request.get('/api/auth/me');
      if (session.ok()) {
        const { csrf_token } = await session.json();
        const deletion = await page.request.delete(conversationUrl, {
          headers: {
            Origin: 'http://localhost:8080',
            'X-CSRF-Token': csrf_token,
          },
        });
        expect(deletion.status()).toBe(200);
      }
    }
  }
});
