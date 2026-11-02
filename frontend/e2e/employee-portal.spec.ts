import { test, expect } from '@playwright/test';

test('real employee portal: Gemini, authorized citations, abstention and identity isolation', async ({
  page,
}) => {
  test.skip(
    process.env.KNOWLEDGEOS_LIVE_E2E !== '1',
    'Opt in to real provider requests with KNOWLEDGEOS_LIVE_E2E=1.',
  );
  test.setTimeout(180_000);
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto(process.env.PORTAL_E2E_URL || 'http://127.0.0.1:8090');
  await page.locator('#persona').selectOption('camille');
  await page.locator('#login-form button[type=submit]').click();
  await expect(page.locator('#dashboard')).toBeVisible();
  const widget = page.locator('knowledgeos-chat');
  await widget
    .getByRole('button', { name: 'Open knowledge assistant', exact: true })
    .click();
  await widget.locator('.new').click();
  const result = page.waitForResponse(
    (response) =>
      response.request().method() === 'POST' &&
      /\/api\/v1\/conversations\/[^/]+\/messages$/.test(response.url()),
  );
  await widget
    .getByRole('textbox', { name: 'Ask your knowledge base' })
    .fill('What is the remote work policy?');
  await widget
    .getByRole('button', { name: 'Send question', exact: true })
    .click();
  const response = await result;
  expect(response.status()).toBe(201);
  const answer = await response.json();
  expect(answer.mode).toBe('grounded');
  expect(answer.answer).toMatch(/\[\d+\]/);
  expect(answer.sources.length).toBeGreaterThan(0);
  expect(
    answer.sources.every(
      (source: { title: string }) =>
        source.title === 'Atlas demonstration — employee handbook',
    ),
  ).toBe(true);
  await expect(widget.locator('.mode').last()).toHaveText('Grounded answer');
  const remoteSourceIndex = answer.sources.findIndex(
    (source: { text: string }) =>
      source.text.includes('three remote-work days'),
  );
  expect(remoteSourceIndex).toBeGreaterThanOrEqual(0);
  const remoteSource = widget.locator('.source').nth(remoteSourceIndex);
  await remoteSource.locator('summary').click();
  await expect(remoteSource.locator('p').first()).toHaveText(
    answer.sources[remoteSourceIndex].text,
  );
  await page.screenshot({
    path: '../docs/screenshots/employee-intranet-gemini.png',
    fullPage: true,
  });
  const conversationId = answer.conversation_id;
  await page.reload();
  await expect(page.locator('#dashboard')).toBeVisible();
  await widget
    .getByRole('button', { name: 'Open knowledge assistant', exact: true })
    .click();
  await widget.locator('.history').selectOption(conversationId);
  await expect(widget.locator('.mode').last()).toHaveText('Grounded answer');
  await page.setViewportSize({ width: 390, height: 844 });
  const bounds = await widget.locator('.panel').boundingBox();
  expect(bounds).not.toBeNull();
  expect(bounds!.x).toBeGreaterThanOrEqual(0);
  expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(390);
  expect(bounds!.y).toBeGreaterThanOrEqual(0);
  expect(bounds!.y + bounds!.height).toBeLessThanOrEqual(844);
  await page.screenshot({
    path: '../docs/screenshots/employee-intranet-gemini-mobile.png',
    fullPage: true,
  });
  await widget.locator('.new').click();
  const unsupported = page.waitForResponse(
    (r) =>
      r.request().method() === 'POST' &&
      /\/api\/v1\/conversations\/[^/]+\/messages$/.test(r.url()),
  );
  await widget
    .getByRole('textbox', { name: 'Ask your knowledge base' })
    .fill('What is the exact monthly employee pension contribution rate?');
  await widget
    .getByRole('button', { name: 'Send question', exact: true })
    .click();
  const unsupportedResponse = await unsupported;
  expect(unsupportedResponse.status()).toBe(201);
  expect((await unsupportedResponse.json()).mode).toBe('abstained');
  await expect(widget.locator('.mode').last()).toHaveText(
    'Insufficient evidence',
  );
  expect(
    (await page.request.get('http://localhost:8000/api/documents')).status(),
  ).toBe(401);
  expect(await page.evaluate(() => localStorage.length)).toBe(0);
  expect((await page.request.get('http://127.0.0.1:8090/.env')).status()).toBe(
    404,
  );
  await widget.getByRole('button', { name: 'Close assistant' }).click();
  await page.locator('#logout').click();
  await page.locator('#persona').selectOption('samir');
  await page.locator('#login-form button[type=submit]').click();
  await expect(page.locator('#dashboard')).toBeVisible();
  await widget
    .getByRole('button', { name: 'Open knowledge assistant', exact: true })
    .click();
  await expect(
    widget.locator(`.history option[value="${conversationId}"]`),
  ).toHaveCount(0);
  expect(errors).toEqual([]);
});
