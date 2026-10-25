/**
 * PUVIMA Consultancy — Live Main Page Settings Synchronizer
 * Dynamically applies announcement banners, customized headlines, and advisory contact details
 * published from the Executive Admin Portal (/admin).
 */

(function () {
  'use strict';
  const API_BASE = (window.PUVIMA_CONFIG && window.PUVIMA_CONFIG.API_BASE_URL) || (function () {
    try { return localStorage.getItem('puvima_api_base_url') || ''; } catch (e) { return ''; }
  })();

  async function syncSiteSettings() {
    try {
      const res = await fetch(`${API_BASE}/api/site-settings`, { cache: 'no-store' });
      if (!res.ok) return;

      const data = await res.json();
      if (!data.success || !data.settings) return;

      const s = data.settings;

      removeAnnouncementRibbon();

      // 2. Main Hero Section Elements (if on index page)
      if (s.hero) {
        // Headline
        const displayHeadline = document.querySelector('.section-hero .display-headline');
        if (displayHeadline && (s.hero.headlineMain || s.hero.headlineGradient)) {
          displayHeadline.innerHTML = `
            ${escapeHtml(s.hero.headlineMain || 'Innovation.')} 
            <span class="text-gradient">${escapeHtml(s.hero.headlineGradient || 'Research. Excellence.')}</span>
          `;
        }

        // Subhead
        const subheadEl = document.querySelector('.section-hero .editorial-subhead');
        if (subheadEl && s.hero.subhead) {
          subheadEl.textContent = s.hero.subhead;
        }
      }

      // 3. Contact Coordinates
      if (s.contact) {
        if (s.contact.email) {
          document.querySelectorAll('a[href^="mailto:"]').forEach(el => {
            if (el.textContent.includes('@puvima.com')) {
              el.textContent = s.contact.email;
              el.href = `mailto:${s.contact.email}`;
            }
          });
        }
      }

      // 4. Careers Form Link Synchronization
      const careersUrl = (s.careersFormUrl || (s.careers && s.careers.formUrl) || '').trim();
      const careersBtns = document.querySelectorAll('[data-careers-form-btn], #homeCareersApplyBtn, #careersApplyBtn');
      careersBtns.forEach(btn => {
        if (careersUrl && (careersUrl.startsWith('http://') || careersUrl.startsWith('https://'))) {
          btn.href = careersUrl;
          btn.target = '_blank';
          btn.rel = 'noopener noreferrer';
        } else {
          // If on subpage (e.g. pages/), keep relative path correct
          const isSubpage = window.location.pathname.includes('/pages/');
          btn.href = isSubpage ? 'careers.html' : 'pages/careers.html';
        }
      });
    } catch (e) {
      // Graceful fallback to static HTML content
    }
  }

  function renderAnnouncementRibbon(ann) {
    let ribbon = document.getElementById('puvimaAnnouncementRibbon');
    if (!ribbon) {
      ribbon = document.createElement('aside');
      ribbon.id = 'puvimaAnnouncementRibbon';
      ribbon.className = 'announcement-ribbon';
      ribbon.setAttribute('aria-label', 'Announcement');
      document.body.prepend(ribbon);
    }

    ribbon.innerHTML = `
      <div class="announcement-content">
        <span class="announcement-badge">${escapeHtml(ann.badge || 'UPDATE')}</span>
        <span class="announcement-text">${escapeHtml(ann.text)}</span>
        ${ann.linkText ? `
          <a href="${escapeHtml(ann.linkUrl || '#')}" class="announcement-link">
            <span>${escapeHtml(ann.linkText)}</span>
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
              <path d="M6 12L10 8L6 4" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
          </a>
        ` : ''}
      </div>
    `;
  }

  function removeAnnouncementRibbon() {
    const ribbon = document.getElementById('puvimaAnnouncementRibbon');
    if (ribbon) ribbon.remove();
  }

  function escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', syncSiteSettings);
  } else {
    syncSiteSettings();
  }
})();
