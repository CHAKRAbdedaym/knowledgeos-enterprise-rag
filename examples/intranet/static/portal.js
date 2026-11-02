import { mountKnowledgeOS } from '/widget/knowledgeos-widget.js';
let csrf = '';
let widget = null;
const $ = (selector) => document.querySelector(selector);
async function portal(path, body) {
  const response = await fetch(path, {
    credentials: 'same-origin',
    method: body === undefined ? 'GET' : 'POST',
    headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrf },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  const data = await response.json();
  if (!response.ok)
    throw new Error(data.detail || 'The portal request failed.');
  return data;
}
async function signedIn(data) {
  const config = await portal('/portal/config');
  csrf = data.csrf_token;
  widget?.remove();
  widget = mountKnowledgeOS({
    apiUrl: config.knowledgeos_api_url,
    title: 'Atlas knowledge assistant',
    accent: '#2458ff',
    getToken: () => portal('/portal/widget-session', {}),
  });
  $('#login').hidden = true;
  $('#dashboard').hidden = false;
  $('#logout').hidden = false;
  $('#employee-name').textContent = data.employee.name.split(' ')[0];
  $('#initials').textContent = data.employee.initials;
}
$('#login-form').onsubmit = async (e) => {
  e.preventDefault();
  $('#login-error').hidden = true;
  try {
    await signedIn(
      await portal('/portal/login', { persona: $('#persona').value }),
    );
  } catch (error) {
    $('#login-error').textContent = error.message;
    $('#login-error').hidden = false;
  }
};
$('#logout').onclick = async () => {
  try {
    await portal('/portal/logout', {});
    widget?.remove();
    widget = null;
    csrf = '';
    $('#dashboard').hidden = true;
    $('#login').hidden = false;
    $('#logout').hidden = true;
  } catch (error) {
    $('#portal-error').textContent = error.message;
    $('#portal-error').hidden = false;
  }
};
$('#open-assistant').onclick = () => widget?.toggle(true);
for (const b of document.querySelectorAll('.ask'))
  b.onclick = async () => {
    if (!widget) return;
    await widget.toggle(true);
    widget.shadowRoot.querySelector('textarea').value = b.dataset.question;
    widget.shadowRoot.querySelector('textarea').focus();
  };
try {
  await signedIn(await portal('/portal/me'));
} catch {
  /* An unauthenticated demo portal starts at the explicit persona selector. */
}
