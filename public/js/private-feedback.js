// Fixed public product metadata only; no account, connect or URL context.
import { ImproveItEmbed } from './improveit-embed.js';

const button = document.querySelector('[data-private-feedback]');
const screen = document.querySelector('script[data-feedback-screen]')?.dataset.feedbackScreen;
const screens = new Set(['ovdb-account', 'ovdb-apps', 'ovdb-vaults', 'ovdb-connect']);
if (button && screens.has(screen)) {
  let failed = false, busy = false;
  const embed = new ImproveItEmbed(document, window, {
    space: 'ao58m', app: '0e96104c8a9188fbdae1ea49369ece23',
    origins: ['https://openvaultdb.com'], screen,
  }, () => {}, value => { failed = value; }, (available, loading) => {
    button.hidden = !available;
    busy = loading;
    button.setAttribute('aria-disabled', String(loading));
    button.setAttribute('aria-busy', String(loading));
    button.textContent = loading ? 'Loading feedback…' : failed ? 'Feedback unavailable · Retry' : 'Suggest an improvement';
  });
  const update = () => embed.setEnabled(!document.documentElement.hasAttribute('data-auth-modal-open'));
  const observer = new MutationObserver(update);
  observer.observe(document.documentElement, {attributes: true, attributeFilter: ['data-auth-modal-open']});
  button.addEventListener('click', () => { if (!busy) failed ? embed.retry(button) : embed.open(button); });
  window.addEventListener('pagehide', event => {
    if (event.persisted) embed.setEnabled(false);
    else { observer.disconnect(); embed.destroy(); }
  });
  window.addEventListener('pageshow', event => { if (event.persisted) update(); });
  update();
}
