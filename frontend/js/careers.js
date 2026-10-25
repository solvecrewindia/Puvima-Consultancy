/**
 * PUVIMA Consultancy — Careers Application Portal Logic
 * Dynamically binds the administrative Application Form URL to the public Apply button.
 */

(function () {
  'use strict';

  const API_BASE = (window.PUVIMA_CONFIG && window.PUVIMA_CONFIG.API_BASE_URL) || (function () {
    try { return localStorage.getItem('puvima_api_base_url') || ''; } catch (e) { return ''; }
  })();

  let careersFormUrl = '';

  document.addEventListener('DOMContentLoaded', () => {
    initCareersPage();
  });

  async function initCareersPage() {
    const applyBtn = document.getElementById('careersApplyBtn');
    const noticeEl = document.getElementById('careersFormNotice');

    try {
      const res = await fetch(`${API_BASE}/api/site-settings`, { cache: 'no-store' });
      if (res.ok) {
        const data = await res.json();
        if (data.success && data.settings) {
          careersFormUrl = (data.settings.careersFormUrl || (data.settings.careers && data.settings.careers.formUrl) || '').trim();
        }
      }
    } catch (e) {
      console.warn('[Careers] Could not sync site-settings:', e.message);
    }

    if (applyBtn) {
      if (careersFormUrl && (careersFormUrl.startsWith('http://') || careersFormUrl.startsWith('https://'))) {
        applyBtn.href = careersFormUrl;
        applyBtn.target = '_blank';
        applyBtn.rel = 'noopener noreferrer';
      } else {
        applyBtn.href = 'mailto:careers@puvima.com?subject=PUVIMA%20Career%20Application';
      }

      applyBtn.addEventListener('click', (e) => {
        if (!careersFormUrl || (!careersFormUrl.startsWith('http://') && !careersFormUrl.startsWith('https://'))) {
          if (noticeEl) {
            noticeEl.style.display = 'block';
            noticeEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
          }
        }
      });
    }
  }

})();
