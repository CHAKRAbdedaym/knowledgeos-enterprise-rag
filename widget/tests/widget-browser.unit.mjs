// Browser interaction UNIT test with mocked transport. Not a live-backend E2E claim.
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import assert from 'node:assert/strict';
const require = createRequire(
  new URL('../../frontend/package.json', import.meta.url),
);
const { chromium } = require('@playwright/test');
const widget = await readFile(
  new URL('../knowledgeos-widget.js', import.meta.url),
);
const server = createServer((req, res) => {
  res.setHeader(
    'Content-Security-Policy',
    "default-src 'self'; script-src 'self'; style-src 'self'; connect-src 'self'",
  );
  if (req.url === '/widget.js') {
    res.setHeader('Content-Type', 'text/javascript');
    res.end(widget);
  } else if (req.url === '/bootstrap.js') {
    res.setHeader('Content-Type', 'text/javascript');
    res.end(
      `import {mountKnowledgeOS} from '/widget.js';window.tokenCalls=0;window.widget=mountKnowledgeOS({apiUrl:location.origin+'/api/v1',title:'Atlas unit fixture',accent:'#2458ff',getToken:async()=>{window.tokenCalls++;return {access_token:'kws_unit_fixture_'+window.tokenCalls,expires_in:300};}});`,
    );
  } else {
    res.setHeader('Content-Type', 'text/html');
    res.end(
      '<!doctype html><html><meta name="viewport" content="width=device-width,initial-scale=1"><body><h1>Isolated widget unit fixture</h1><script type="module" src="/bootstrap.js"></script></body></html>',
    );
  }
});
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
const base = 'http://127.0.0.1:' + server.address().port;
const browser = await chromium.launch({
  executablePath: process.env.CHROME_PATH || '/usr/bin/google-chrome',
  headless: true,
  args: ['--no-sandbox'],
});
try {
  const page = await browser.newPage({
    viewport: { width: 1440, height: 1000 },
  });
  // Even a same-host ambient admin cookie must not accompany employee API fetches.
  await page
    .context()
    .addCookies([
      {
        name: 'admin_session_fixture',
        value: 'isolated-unit-cookie',
        domain: '127.0.0.1',
        path: '/',
        httpOnly: true,
        sameSite: 'Strict',
      },
    ]);
  const failures = [];
  page.on('pageerror', (e) => failures.push(e.message));
  let created = 0,
    posts = 0,
    failed = false,
    firstHistory = true;
  await page.route('**/api/v1/**', async (route) => {
    const req = route.request();
    assert.match(req.headers().authorization, /^Bearer kws_unit_fixture_/);
    assert.equal(req.headers().cookie, undefined);
    const path = new URL(req.url()).pathname;
    let status = 200,
      data = [];
    if (
      path === '/api/v1/conversations' &&
      req.method() === 'GET' &&
      firstHistory
    ) {
      firstHistory = false;
      status = 401;
      data = { detail: 'Expired unit token' };
    } else if (path === '/api/v1/conversations' && req.method() === 'POST') {
      created++;
      data = { id: 'conv-1', title: 'Remote policy' };
    } else if (path.endsWith('/messages')) {
      posts++;
      if (!failed) {
        failed = true;
        status = 503;
        data = { detail: 'Temporary unit transport error' };
      } else
        data = {
          conversation_id: 'conv-1',
          answer: 'Retrieved passages below.',
          mode: 'retrieval_only',
          sources: [
            {
              document_id: 'doc-1',
              chunk_id: 'chunk-1',
              title: 'Remote work',
              text: 'Up to three remote-work days with manager approval.',
              score: 0.8,
              page: null,
            },
          ],
        };
    } else if (path.endsWith('/sources/chunk-1'))
      data = { text: 'Up to three remote-work days with manager approval.' };
    else if (path.endsWith('/conv-1'))
      data = {
        id: 'conv-1',
        messages: [
          {
            role: 'assistant',
            content: 'Retained synthetic evidence.',
            mode: 'retrieval_only',
            sources: [],
          },
        ],
      };
    else if (path === '/api/v1/conversations')
      data = created ? [{ id: 'conv-1', title: 'Remote policy' }] : [];
    await route.fulfill({
      status,
      contentType: 'application/json',
      body: JSON.stringify(data),
    });
  });
  await page.goto(base);
  const launcher = page.getByRole('button', {
    name: 'Open knowledge assistant',
  });
  await launcher.click();
  await page.getByRole('dialog', { name: 'Knowledge assistant' }).waitFor();
  const input = page.getByRole('textbox', { name: 'Ask your knowledge base' });
  await input.fill('What is the remote work policy?');
  await page.getByRole('button', { name: 'Send question' }).click();
  await page.getByText('Temporary unit transport error').waitFor();
  assert.equal(await input.inputValue(), 'What is the remote work policy?');
  await page.getByRole('button', { name: 'Try again' }).click();
  await page.getByText('Retrieved passages below.').waitFor();
  await page.getByText('[1] Remote work', { exact: true }).click();
  await page
    .getByText('Up to three remote-work days with manager approval.')
    .waitFor();
  assert.equal(created, 1);
  assert.equal(posts, 2);
  assert.equal(await page.evaluate(() => window.tokenCalls), 2);
  await page.keyboard.press('Escape');
  await launcher.waitFor();
  await launcher.click();
  await page
    .getByRole('combobox', { name: 'Conversation history' })
    .selectOption('conv-1');
  await page.getByText('Retained synthetic evidence.').waitFor();
  await page.setViewportSize({ width: 390, height: 844 });
  const bounds = await page
    .getByRole('dialog', { name: 'Knowledge assistant' })
    .boundingBox();
  assert.ok(
    bounds.x >= 0 &&
      bounds.y >= 0 &&
      bounds.x + bounds.width <= 390 &&
      bounds.y + bounds.height <= 844,
  );
  await page.getByRole('button', { name: '＋ New chat', exact: true }).click();
  await page
    .getByRole('heading', { name: /Your knowledge\.\s*One conversation\./ })
    .waitFor();
  assert.equal(await page.evaluate(() => localStorage.length), 0);
  assert.deepEqual(failures, []);
  console.log(
    JSON.stringify({
      unitWidget: true,
      expiredTokenRenewal: true,
      openClose: true,
      realisticLoadingRetry: true,
      citations: true,
      history: true,
      newConversation: true,
      mobile390: true,
      noLocalStorageCredentials: true,
      pageErrors: failures,
    }),
  );
} finally {
  await browser.close();
  server.close();
}
