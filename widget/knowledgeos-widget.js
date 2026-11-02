/** Independent KnowledgeOS employee widget. Never accepts a permanent API key. */
const css = `
:host{--accent:#2458ff;font-family:Inter,Arial,sans-serif;font-size:14px;color:#17213b;position:fixed;right:24px;bottom:24px;z-index:2147483000;text-align:left;color-scheme:light}*{box-sizing:border-box}button,input,select,textarea{font:inherit}button{cursor:pointer}button:disabled{cursor:wait;opacity:.55}button:focus-visible,select:focus-visible,textarea:focus-visible{outline:3px solid #91adff;outline-offset:3px}.launcher{width:60px;height:60px;border:0;border-radius:50%;background:var(--accent);color:white;box-shadow:0 8px 30px #15213b33;display:grid;place-items:center;margin-left:auto}.launcher svg{width:26px;height:26px}.panel{position:absolute;bottom:78px;right:0;width:390px;height:min(650px,calc(100dvh - 126px));max-height:750px;display:flex;flex-direction:column;background:#fff;border:1px solid #e1e7f1;border-radius:23px;box-shadow:0 25px 90px #14213b30;overflow:hidden}.panel[hidden]{display:none}.header{display:flex;align-items:center;gap:11px;padding:20px;background:#151d38;color:#fff}.logo{width:40px;height:40px;object-fit:contain;padding:4px;background:white;border-radius:10px}.brand{flex:1;min-width:0}.brand strong{display:block;font-size:15px;overflow-wrap:anywhere}.brand small{display:block;font-size:11px;color:#b7c8e9;margin-top:5px}.icon{width:30px;height:32px;border:0;background:transparent;color:inherit;border-radius:50%;font-size:23px}.icon:hover{background:#ffffff18}.tools{display:flex;align-items:center;gap:8px;padding:12px 16px;border-bottom:1px solid #e9edf5;background:#f9fbff}.history{min-width:0;flex:1;border:1px solid #dce4f2;border-radius:20px;padding:7px;background:#fff;color:#45516a;font-size:11px}.new{border:1px solid #dce4f2;border-radius:20px;padding:7px 10px;background:#fff;color:#2458ff;font-size:11px}.scroll{flex:1;overflow:auto;padding:20px;overscroll-behavior:contain;min-height:0}.welcome h2{font-size:27px;letter-spacing:-.9px;line-height:1.16;margin:22px 0 12px}.welcome h2 span{color:var(--accent)}.welcome p{font-size:12px;color:#68758d;line-height:1.7}.suggestion{display:block;width:100%;text-align:left;margin-top:12px;padding:12px;border:1px solid #dfe6f3;border-radius:15px;background:#fff;color:#36425c;font-size:12px;line-height:1.5}.suggestion:hover{border-color:var(--accent)}.message{margin-bottom:20px}.message.user{margin-left:25px;padding:14px 16px;border-radius:18px 18px 4px 18px;background:var(--accent);color:#fff}.byline{font-size:11px;font-weight:bold;margin-bottom:8px}.body{white-space:pre-wrap;overflow-wrap:anywhere;line-height:1.75;font-size:13px}.mode{display:inline-block;background:#edf2ff;color:#315ed5;border-radius:15px;font-size:10px;padding:4px 7px;margin-bottom:8px}.sources{margin-top:12px}.source{margin:6px 0;border:1px solid #e3e9f5;border-radius:10px;background:#f7f9ff;font-size:11px;overflow:hidden}.source summary{padding:10px;cursor:pointer;color:#2855bb;line-height:1.5}.source p{white-space:pre-wrap;overflow-wrap:anywhere;line-height:1.7;padding:0 12px 12px;margin:0;color:#45516a}.status{font-size:12px;line-height:1.6;color:#62718c;margin:10px 0}.error{padding:11px 14px;background:#fff1f1;border:1px solid #f0caca;border-radius:12px;color:#9b3030;font-size:12px;line-height:1.6;margin-top:12px}.retry{border:0;background:transparent;color:inherit;text-decoration:underline;padding:5px 0;font-size:12px}.footer{padding:12px 16px 10px;border-top:1px solid #e9edf5;background:white}.form{display:flex;gap:8px;align-items:center;border:1px solid #d5dff3;background:#f7f9ff;border-radius:25px;padding:8px 8px 8px 15px}.form:focus-within{border-color:var(--accent)}textarea{resize:none;border:0;background:transparent;outline:none!important;box-shadow:none;color:#24314d;font-size:12px;min-height:36px;max-height:90px;width:100%;padding:9px 0;line-height:1.5}.send{border:0;border-radius:50%;width:35px;height:35px;flex:none;background:var(--accent);color:white;font-size:20px}.notice{text-align:center;color:#75809a;font-size:9px;margin:9px 0 0;line-height:1.4}@media(max-width:480px){:host{right:15px;bottom:15px}.launcher{width:55px;height:55px}.panel{width:calc(100vw - 24px);right:-3px;bottom:69px;height:min(650px,calc(100dvh - 101px));border-radius:21px}.scroll{padding:17px}}@media(prefers-reduced-motion:no-preference){.launcher{transition:transform .15s}.launcher:hover{transform:translateY(-3px)}}`;
const chatIcon =
  '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M21 11.5a8.4 8.4 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.4 8.4 0 0 1-3.8-.9L3 21l1.9-5.7a8.4 8.4 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.4 8.4 0 0 1 3.8-.9h.5a8.5 8.5 0 0 1 8 8v.5Z" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/></svg>';
function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}
function safeUrl(value, { logo = false } = {}) {
  const url = new URL(value, location.href);
  if (url.username || url.password || url.hash || (!logo && url.search))
    throw new Error('Invalid widget URL.');
  if (
    url.protocol !== 'https:' &&
    !(
      url.protocol === 'http:' &&
      (['localhost', '127.0.0.1', '[::1]'].includes(url.hostname) ||
        (logo && url.origin === location.origin))
    )
  )
    throw new Error('Use HTTPS for KnowledgeOS outside local development.');
  return url.href.replace(/\/$/, '');
}
export class KnowledgeOSChat extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this._abort = new AbortController();
    this._token = null;
    this._conversation = null;
    this._history = [];
    this._pending = false;
    this._opened = false;
  }
  configure(options) {
    if (this.isConnected)
      throw new Error('Configure before connecting the widget.');
    if (typeof options.getToken !== 'function')
      throw new Error('A server-backed getToken callback is required.');
    this._options = {
      apiUrl: safeUrl(options.apiUrl),
      title: String(options.title || 'Knowledge assistant').slice(0, 70),
      getToken: options.getToken,
    };
    if (options.logo)
      this._options.logo = safeUrl(options.logo, { logo: true });
    if (options.accent) {
      if (!/^#[0-9a-f]{6}$/i.test(options.accent))
        throw new Error('Use a six-digit hexadecimal accent color.');
      this.style.setProperty('--accent', options.accent);
    }
    return this;
  }
  connectedCallback() {
    if (!this._options)
      throw new Error('Use mountKnowledgeOS or configure() before append.');
    const sheet = new CSSStyleSheet();
    sheet.replaceSync(css);
    this.shadowRoot.adoptedStyleSheets = [sheet];
    this.shadowRoot.innerHTML = `<section class="panel" role="dialog" aria-label="Knowledge assistant" hidden><header class="header"><div class="brand"><strong></strong><small>Your knowledge, connected.</small></div><button class="icon close" aria-label="Close assistant">×</button></header><div class="tools"><select class="history" aria-label="Conversation history"><option value="">New conversation</option></select><button class="new">＋ New chat</button></div><div class="scroll"><div class="messages" role="log" aria-live="polite" aria-label="Chat messages"></div><div class="status" role="status"></div><div class="error" role="alert" hidden></div></div><footer class="footer"><form class="form"><textarea aria-label="Ask your knowledge base" placeholder="Ask about your company documents…" rows="1" maxlength="2000" required></textarea><button class="send" aria-label="Send question">↑</button></form><p class="notice">Answers depend on your authorized documents. Inspect the sources.</p></footer></section><button class="launcher" aria-label="Open knowledge assistant" aria-expanded="false">${chatIcon}</button>`;
    this.$ = (s) => this.shadowRoot.querySelector(s);
    this.$('.brand strong').textContent = this._options.title;
    if (this._options.logo) {
      const img = el('img', 'logo');
      img.src = this._options.logo;
      img.alt = 'Assistant logo';
      this.$('.header').prepend(img);
    }
    this.$('.launcher').onclick = () => this.toggle();
    this.$('.close').onclick = () => this.toggle(false);
    this.$('.new').onclick = () => this.newConversation();
    this.$('.history').onchange = () =>
      this.loadConversation(this.$('.history').value);
    this.$('form').onsubmit = (e) => {
      e.preventDefault();
      void this.submit();
    };
    this.$('textarea').onkeydown = (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        void this.submit();
      }
    };
    this.shadowRoot.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        this.toggle(false);
      }
    });
    this.welcome();
  }
  disconnectedCallback() {
    this._abort.abort();
    this._token = null;
    this._history = [];
    this._conversation = null;
  }
  welcome() {
    this.$('.messages').replaceChildren();
    const welcome = el('div', 'welcome');
    const heading = el('h2', null, 'Your knowledge.');
    heading.append(
      document.createElement('br'),
      el('span', null, 'One conversation.'),
    );
    welcome.append(
      heading,
      el(
        'p',
        null,
        'Ask a question and explore the evidence in the documents available to you.',
      ),
    );
    for (const question of [
      'What is the remote work policy?',
      'How do I request IT access?',
    ]) {
      const b = el('button', 'suggestion', question);
      b.onclick = () => {
        this.$('textarea').value = question;
        void this.submit();
      };
      welcome.append(b);
    }
    this.$('.messages').append(welcome);
  }
  async toggle(open = !this._opened) {
    this._opened = open;
    this.$('.panel').hidden = !open;
    this.$('.launcher').setAttribute('aria-expanded', String(open));
    this.$('.launcher').setAttribute(
      'aria-label',
      open ? 'Close knowledge assistant' : 'Open knowledge assistant',
    );
    if (open) {
      this.$('textarea').focus();
      if (!this._initialized) {
        this._initialized = true;
        try {
          await this.refreshHistory();
        } catch (error) {
          this.showError(error, () => this.refreshHistory());
        }
      }
    } else this.$('.launcher').focus();
  }
  async token(refresh = false) {
    if (!refresh && this._token && this._token.expiresAt > Date.now() + 10000)
      return this._token.value;
    const result = await this._options.getToken();
    if (
      !result ||
      typeof result.access_token !== 'string' ||
      !result.access_token.startsWith('kws_')
    )
      throw new Error(
        'The portal could not open an employee session. Sign in again.',
      );
    const expiry = result.expires_at
      ? Date.parse(result.expires_at)
      : Date.now() + Number(result.expires_in || 300) * 1000;
    if (!Number.isFinite(expiry) || expiry <= Date.now())
      throw new Error('The employee session has expired.');
    this._token = { value: result.access_token, expiresAt: expiry };
    return this._token.value;
  }
  async request(path, options = {}, retried = false) {
    const token = await this.token();
    const response = await fetch(this._options.apiUrl + path, {
      ...options,
      credentials: 'omit',
      signal: this._abort.signal,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
    });
    if (response.status === 401 && !retried) {
      await this.token(true);
      return this.request(path, options, true);
    }
    let body;
    try {
      body = await response.json();
    } catch {
      throw new Error('The knowledge service returned an unreadable response.');
    }
    if (!response.ok) {
      if (response.status === 429)
        throw new Error(
          `Too many requests. Please wait ${response.headers.get('Retry-After') || 'a few'} seconds and retry.`,
        );
      throw new Error(
        typeof body.detail === 'string'
          ? body.detail.slice(0, 400)
          : 'The knowledge service is unavailable. Please try again.',
      );
    }
    return body;
  }
  async refreshHistory() {
    const result = await this.request('/conversations');
    this._history = Array.isArray(result) ? result : result.conversations || [];
    const select = this.$('.history');
    select.replaceChildren(new Option('New conversation', ''));
    for (const item of this._history)
      select.append(new Option(String(item.title || 'Conversation'), item.id));
    select.value = this._conversation || '';
  }
  busy(value) {
    this._pending = value;
    for (const button of this.shadowRoot.querySelectorAll(
      '.send,.new,.suggestion,.history',
    ))
      button.disabled = value;
    this.$('.status').textContent = value
      ? 'Searching authorized documents and preparing your response…'
      : '';
  }
  clearError() {
    this.$('.error').hidden = true;
    this.$('.error').replaceChildren();
  }
  showError(error, retry) {
    if (error?.name === 'AbortError') return;
    const box = this.$('.error');
    box.replaceChildren(
      el(
        'div',
        null,
        error instanceof Error ? error.message : 'The request failed.',
      ),
    );
    if (retry) {
      const b = el('button', 'retry', 'Try again');
      b.onclick = async () => {
        this.clearError();
        try {
          await retry();
        } catch (e) {
          this.showError(e, retry);
        }
      };
      box.append(b);
    }
    box.hidden = false;
  }
  async newConversation() {
    if (this._pending) return;
    this._conversation = null;
    this.$('.history').value = '';
    this.$('textarea').value = '';
    this.clearError();
    this.welcome();
    this.$('textarea').focus();
  }
  async loadConversation(id) {
    if (this._pending) return;
    if (!id) {
      await this.newConversation();
      return;
    }
    this.clearError();
    this.busy(true);
    try {
      const result = await this.request(
        `/conversations/${encodeURIComponent(id)}`,
      );
      this._conversation = id;
      this.$('.messages').replaceChildren();
      for (const msg of result.messages || [])
        this.renderMessage(
          msg.role,
          msg.content ?? msg.answer ?? '',
          msg.mode,
          msg.sources || [],
        );
    } catch (error) {
      this.showError(error, () => this.loadConversation(id));
    } finally {
      this.busy(false);
    }
  }
  renderMessage(role, content, mode, sources = []) {
    this.$('.welcome')?.remove();
    const article = el(
      'article',
      `message ${role === 'user' ? 'user' : 'assistant'}`,
    );
    article.append(
      el('div', 'byline', role === 'user' ? 'You' : this._options.title),
    );
    if (mode)
      article.append(
        el(
          'span',
          'mode',
          {
            grounded: 'Grounded answer',
            retrieval_only: 'Retrieved passages · generation disabled',
            abstained: 'Insufficient evidence',
          }[mode] || 'Response',
        ),
      );
    article.append(el('div', 'body', String(content)));
    if (sources.length) {
      const list = el('div', 'sources');
      sources.forEach((s, index) => {
        const details = el('details', 'source');
        const passage = el('p', null, s.text ?? s.excerpt ?? '');
        details.append(
          el(
            'summary',
            null,
            `[${index + 1}] ${s.title || 'Document'}${s.page ? ` · page ${s.page}` : ''}`,
          ),
          passage,
        );
        if (Number.isFinite(s.score))
          details.append(
            el('p', null, `Retrieval score: ${s.score.toFixed(3)}`),
          );
        let checking = false;
        details.ontoggle = async () => {
          if (!details.open || checking || !s.chunk_id) return;
          checking = true;
          passage.textContent = 'Loading authorized source…';
          try {
            const current = await this.request(
              `/sources/${encodeURIComponent(s.chunk_id)}`,
            );
            passage.textContent = current.text ?? current.excerpt ?? '';
          } catch {
            passage.textContent =
              'This source is unavailable under your current permissions.';
          } finally {
            checking = false;
          }
        };
        list.append(details);
      });
      article.append(list);
    }
    this.$('.messages').append(article);
    this.$('.scroll').scrollTop = this.$('.scroll').scrollHeight;
  }
  async submit() {
    if (this._pending) return;
    const question = this.$('textarea').value.trim();
    if (!question) return;
    if (question.length > 2000) {
      this.showError(new Error('Use at most 2,000 characters.'));
      return;
    }
    this.clearError();
    this.busy(true);
    try {
      if (!this._conversation) {
        const c = await this.request('/conversations', {
          method: 'POST',
          body: JSON.stringify({ title: question.slice(0, 80) }),
        });
        this._conversation = c.id;
      }
      const result = await this.request(
        `/conversations/${encodeURIComponent(this._conversation)}/messages`,
        { method: 'POST', body: JSON.stringify({ question }) },
      );
      this.renderMessage('user', question);
      this.renderMessage(
        'assistant',
        result.answer ?? result.content ?? '',
        result.mode,
        result.sources || [],
      );
      this.$('textarea').value = '';
      await this.refreshHistory();
    } catch (error) {
      this.showError(error, () => this.submit());
    } finally {
      this.busy(false);
      this.$('textarea').focus();
    }
  }
}
if (!customElements.get('knowledgeos-chat'))
  customElements.define('knowledgeos-chat', KnowledgeOSChat);
export function mountKnowledgeOS(options) {
  const widget = new KnowledgeOSChat();
  widget.configure(options);
  (options.container || document.body).append(widget);
  return widget;
}
