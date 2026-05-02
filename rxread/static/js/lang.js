// Language system — EN / Tamil
const LANG_KEY = 'rxread_lang';
let currentLang = localStorage.getItem(LANG_KEY) || document.documentElement.getAttribute('data-lang') || 'en';

function applyLang(lang) {
  currentLang = lang;
  localStorage.setItem(LANG_KEY, lang);
  document.documentElement.setAttribute('data-lang', lang);

  document.querySelectorAll('[data-en]').forEach(el => {
    const text = el.getAttribute('data-' + lang);
    if (!text) return;
    if (el.tagName === 'INPUT' && el.hasAttribute('placeholder')) {
      const ph = el.getAttribute('data-' + lang + '-placeholder') || el.getAttribute('data-' + lang);
      if (ph) el.placeholder = ph;
    } else if (el.tagName === 'INPUT' || el.tagName === 'BUTTON' && el.type === 'submit') {
      el.value = text;
    } else {
      el.innerHTML = text;
    }
  });

  const btn = document.getElementById('langToggle');
  if (btn) {
    const lbl = btn.querySelector('.lang-label');
    if (lbl) lbl.textContent = lang === 'en' ? 'தமிழ்' : 'English';
  }

  // Sync dashboard lang pills if present
  document.querySelectorAll('.lang-pill').forEach(p => {
    p.classList.toggle('active', p.dataset.lang === lang);
  });
}

document.addEventListener('DOMContentLoaded', () => {
  applyLang(currentLang);

  const toggle = document.getElementById('langToggle');
  if (toggle) {
    toggle.addEventListener('click', () => {
      const next = currentLang === 'en' ? 'ta' : 'en';
      applyLang(next);
      // Persist to server if logged in
      fetch('/api/set-language', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ language: next })
      }).catch(() => {});
    });
  }
});

window.getCurrentLang = () => currentLang;
window.applyLang = applyLang;
