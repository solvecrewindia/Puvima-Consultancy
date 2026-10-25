/**
 * PUVIMA Consultancy — Customer Reviews & Rotating Carousel Controller
 * Handles loading approved reviews, rendering the infinite left marquee, and review submission modal.
 */

(function () {
  'use strict';
  const API_BASE = (window.PUVIMA_CONFIG && window.PUVIMA_CONFIG.API_BASE_URL) || (function () {
    try { return localStorage.getItem('puvima_api_base_url') || ''; } catch (e) { return ''; }
  })();

  let selectedRating = 5;

  const starSvg = `
    <svg class="review-star" viewBox="0 0 20 20" fill="currentColor">
      <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
    </svg>
  `;

  const googleIconSvg = `
    <div class="review-platform-badge platform-google" title="Verified Google Review">
      <svg width="18" height="18" viewBox="0 0 24 24">
        <path fill="#4285F4" d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.8-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.17z"/>
        <path fill="#34A853" d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.25v3.15C3.26 21.36 7.33 24 12 24z"/>
        <path fill="#FBBC05" d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.25C.45 8.17 0 9.99 0 12s.45 3.83 1.25 5.42l4.03-3.15z"/>
        <path fill="#EA4335" d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.33 0 3.26 2.64 1.25 6.58l4.03 3.15c.95-2.83 3.6-4.98 6.72-4.98z"/>
      </svg>
    </div>
  `;

  const facebookIconSvg = `
    <div class="review-platform-badge platform-facebook" title="Verified Facebook Review">
      <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
        <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
      </svg>
    </div>
  `;

  const linkedinIconSvg = `
    <div class="review-platform-badge platform-linkedin" title="Verified LinkedIn Partner">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
        <path d="M19 0h-14c-2.761 0-5 2.239-5 5v14c0 2.761 2.239 5 5 5h14c2.762 0 5-2.239 5-5v-14c0-2.761-2.238-5-5-5zm-11 19h-3v-11h3v11zm-1.5-12.268c-.966 0-1.75-.79-1.75-1.764s.784-1.764 1.75-1.764 1.75.79 1.75 1.764-.783 1.764-1.75 1.764zm13.5 12.268h-3v-5.604c0-3.368-4-3.113-4 0v5.604h-3v-11h3v1.765c1.396-2.586 7-2.777 7 2.476v6.759z"/>
      </svg>
    </div>
  `;

  async function initReviews() {
    setupModalEvents();
    await loadAndRenderReviews();
  }

  async function loadAndRenderReviews() {
    const track = document.getElementById('reviewsMarqueeTrack');
    if (!track) return;

    try {
      const res = await fetch(`${API_BASE}/api/reviews`);
      if (!res.ok) return;

      const data = await res.json();
      const reviews = data.reviews || [];

      if (reviews.length === 0) {
        track.innerHTML = '<div style="color: var(--text-muted); padding: 20px;">No published reviews currently available.</div>';
        return;
      }

      // Render cards (duplicated to create a seamless infinite loop)
      const cardsHtml = reviews.map(r => createCardHtml(r)).join('');
      // Duplicate at least once for infinite scrolling
      track.innerHTML = cardsHtml + cardsHtml;

      // Slow, comfortable reading speed (approx 16-18s per review card)
      const slowDuration = Math.max(90, reviews.length * 16);
      track.style.animationDuration = `${slowDuration}s`;
    } catch (e) {
      console.error('Error loading reviews:', e);
    }
  }

  const avatarPalettes = [
    { bg: 'linear-gradient(135deg, #0072CE 0%, #0284C7 100%)', shadow: 'rgba(0, 114, 206, 0.25)' },
    { bg: 'linear-gradient(135deg, #0D9488 0%, #14B8A6 100%)', shadow: 'rgba(13, 148, 136, 0.25)' },
    { bg: 'linear-gradient(135deg, #7C3AED 0%, #8B5CF6 100%)', shadow: 'rgba(124, 58, 237, 0.25)' },
    { bg: 'linear-gradient(135deg, #2563EB 0%, #3B82F6 100%)', shadow: 'rgba(37, 99, 235, 0.25)' },
    { bg: 'linear-gradient(135deg, #D97706 0%, #F59E0B 100%)', shadow: 'rgba(217, 119, 6, 0.25)' }
  ];

  function getInitials(name) {
    if (!name) return 'CL';
    const parts = name.trim().split(/\s+/);
    if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }

  function getPalette(name) {
    let hash = 0;
    for (let i = 0; i < (name || '').length; i++) {
      hash = (hash << 5) - hash + name.charCodeAt(i);
      hash |= 0;
    }
    const idx = Math.abs(hash) % avatarPalettes.length;
    return avatarPalettes[idx];
  }

  function createCardHtml(review) {
    const starsCount = Math.min(5, Math.max(1, review.rating || 5));
    const starsHtml = Array(starsCount).fill(starSvg).join('');

    let platformBadge = googleIconSvg;
    if (review.platform === 'facebook') platformBadge = facebookIconSvg;
    if (review.platform === 'linkedin') platformBadge = linkedinIconSvg;

    const initials = getInitials(review.name);
    const palette = getPalette(review.name);

    return `
      <article class="customer-review-card">
        <div class="review-card-top">
          <div class="reviewer-profile">
            <div class="reviewer-avatar-monogram" style="background: ${palette.bg}; box-shadow: 0 3px 10px ${palette.shadow};">
              ${escapeHtml(initials)}
            </div>
            <div class="reviewer-info-wrap">
              <span class="reviewer-name">${escapeHtml(review.name)}</span>
              <span class="reviewer-meta">${escapeHtml(review.date_display || 'Verified Feedback')}</span>
            </div>
          </div>
          ${platformBadge}
        </div>

        <div class="review-stars-row" aria-label="${starsCount} out of 5 stars">
          ${starsHtml}
        </div>

        <p class="review-body-text">
          "${escapeHtml(review.review_text)}"
        </p>

        ${review.company ? `<div class="review-company-tag">${escapeHtml(review.company)}</div>` : ''}
      </article>
    `;
  }

  function setupModalEvents() {
    const openBtn = document.getElementById('openWriteReviewBtn');
    const modal = document.getElementById('writeReviewModal');
    const closeBtn = document.getElementById('closeReviewModalBtn');
    const form = document.getElementById('submitReviewForm');
    const alertBox = document.getElementById('reviewAlertBox');

    if (openBtn && modal) {
      openBtn.addEventListener('click', () => {
        modal.style.display = 'flex';
        resetFormState();
      });
    }

    if (closeBtn && modal) {
      closeBtn.addEventListener('click', () => {
        modal.style.display = 'none';
      });
    }

    if (modal) {
      modal.addEventListener('click', (e) => {
        if (e.target === modal) modal.style.display = 'none';
      });
    }

    // Star rating picker
    const starPicker = document.getElementById('starRatingPicker');
    if (starPicker) {
      const stars = starPicker.querySelectorAll('svg');
      stars.forEach(star => {
        star.addEventListener('click', () => {
          selectedRating = parseInt(star.getAttribute('data-value'), 10);
          updateStarDisplay(stars, selectedRating);
        });
        star.addEventListener('mouseenter', () => {
          const val = parseInt(star.getAttribute('data-value'), 10);
          updateStarDisplay(stars, val);
        });
      });

      starPicker.addEventListener('mouseleave', () => {
        updateStarDisplay(stars, selectedRating);
      });
    }

    // Form submission
    if (form) {
      form.addEventListener('submit', async (e) => {
        e.preventDefault();

        const nameInput = document.getElementById('reviewAuthorName');
        const companyInput = document.getElementById('reviewAuthorCompany');
        const platformSelect = document.getElementById('reviewPlatformSelect');
        const textInput = document.getElementById('reviewFeedbackText');
        const submitBtn = document.getElementById('submitReviewBtn');

        const name = nameInput.value.trim();
        const company = companyInput ? companyInput.value.trim() : '';
        const platform = platformSelect ? platformSelect.value : 'google';
        const review_text = textInput.value.trim();

        if (!name || review_text.length < 5) {
          showAlert('Please provide your name and a review of at least 5 characters.', 'error');
          return;
        }

        submitBtn.disabled = true;
        submitBtn.innerHTML = '<span>Transmitting feedback...</span>';

        try {
          const res = await fetch(`${API_BASE}/api/reviews`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              name,
              company,
              platform,
              rating: selectedRating,
              review_text
            })
          });

          const data = await res.json();
          if (res.ok && data.success) {
            showAlert(data.message, 'success');
            form.reset();
            selectedRating = 5;
            const starPicker = document.getElementById('starRatingPicker');
            if (starPicker) updateStarDisplay(starPicker.querySelectorAll('svg'), 5);

            setTimeout(() => {
              if (modal) modal.style.display = 'none';
            }, 4000);
          } else {
            showAlert(data.message || 'Unable to submit review at this time.', 'error');
          }
        } catch (err) {
          showAlert('Network error: Unable to transmit review to server.', 'error');
        } finally {
          submitBtn.disabled = false;
          submitBtn.innerHTML = '<span>Submit Review for Verification</span>';
        }
      });
    }
  }

  function updateStarDisplay(stars, activeCount) {
    stars.forEach(star => {
      const val = parseInt(star.getAttribute('data-value'), 10);
      if (val <= activeCount) {
        star.classList.add('active');
      } else {
        star.classList.remove('active');
      }
    });
  }

  function showAlert(msg, type) {
    const alertBox = document.getElementById('reviewAlertBox');
    if (!alertBox) return;
    alertBox.className = `review-status-alert ${type}`;
    alertBox.textContent = msg;
    alertBox.style.display = 'block';
  }

  function resetFormState() {
    const alertBox = document.getElementById('reviewAlertBox');
    if (alertBox) alertBox.style.display = 'none';
  }

  function escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initReviews);
  } else {
    initReviews();
  }
})();
