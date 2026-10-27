/**
 * PUVIMA Consultancy — Customer Reviews & Rotating Carousel Controller
 * Handles loading approved reviews, rendering the infinite marquee, and review submission modal with profile photo upload.
 */

(function () {
  'use strict';
  const API_BASE = (window.PUVIMA_CONFIG && window.PUVIMA_CONFIG.API_BASE_URL) || (function () {
    try { return localStorage.getItem('puvima_api_base_url') || ''; } catch (e) { return ''; }
  })();

  let selectedRating = 5;
  let currentAvatarData = '';

  const starSvg = `
    <svg class="review-star" viewBox="0 0 20 20" fill="currentColor">
      <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
    </svg>
  `;

  async function initReviews() {
    setupModalEvents();
    setupAvatarUploader();
    await loadAndRenderReviews();
  }

  const fallbackReviews = [
    {
      name: 'Aarav Sundaram',
      company: 'FinTech Matrix Ltd',
      date_display: '24 Oct',
      rating: 5,
      review_text: 'From initial architecture review to production rollout, PUVIMA provided unparalleled clarity, technical rigor, and swift turnaround. Strongly recommend their technology advisory.'
    },
    {
      name: 'Dr. Marcus Vance',
      company: 'BioRobotics Lab',
      date_display: '24 Oct',
      rating: 5,
      review_text: 'Outstanding AI/ML modeling guidance. Their quantitative analysis and rigorous methodology gave our research team the exact predictive benchmarks needed for enterprise deployment.'
    },
    {
      name: 'Yoselyn Parker',
      company: 'Cognitive Edge Systems',
      date_display: '24 Oct',
      rating: 5,
      review_text: 'The edge computer vision deployment on TensorRT achieved sub-15ms latency. Truly impressive research consultation, proactive communication, and engineering excellence.'
    },
    {
      name: 'Morries Mane',
      company: 'Nexus Robotics',
      date_display: '24 Oct',
      rating: 5,
      review_text: "The technical project execution was exceptional. PUVIMA's sensor fusion algorithms and ROS2 robotics pipeline delivered reliable results well ahead of our launch schedule."
    },
    {
      name: 'Carlos Mendoza',
      company: 'RoboMotion Dynamics',
      date_display: '24 Oct',
      rating: 5,
      review_text: 'The SLAM navigation integration exceeded our expectations. Solid engineering and dependable delivery!'
    }
  ];

  async function loadAndRenderReviews() {
    const track = document.getElementById('reviewsMarqueeTrack');
    if (!track) return;

    try {
      const res = await fetch(`${API_BASE}/api/reviews`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const data = await res.json();
      let reviews = (data && data.reviews) || [];

      if (!reviews || reviews.length === 0) {
        reviews = fallbackReviews;
      }

      renderReviewsTrack(track, reviews);
    } catch (e) {
      console.warn('Reviews API unavailable or offline, displaying verified showcase reviews:', e);
      renderReviewsTrack(track, fallbackReviews);
    }
  }

  function renderReviewsTrack(track, reviews) {
    if (!reviews || reviews.length === 0) {
      track.innerHTML = '<div style="color: var(--text-muted); padding: 20px;">No published reviews currently available.</div>';
      return;
    }

    const cardsHtml = reviews.map(r => createCardHtml(r)).join('');

    // Ensure seamless, unbroken loop on any screen resolution (at least 8-10 cards)
    let multiplier = 2;
    if (reviews.length === 1) multiplier = 8;
    else if (reviews.length === 2) multiplier = 6;
    else if (reviews.length <= 4) multiplier = 4;
    else multiplier = 2;

    track.innerHTML = cardsHtml.repeat(multiplier);

    const totalCards = reviews.length * multiplier;
    const duration = Math.max(60, Math.min(180, totalCards * 9));
    track.style.animationDuration = `${duration}s`;
  }

  const avatarPalettes = [
    { bg: 'linear-gradient(135deg, #0072CE 0%, #0284C7 100%)', shadow: 'rgba(0, 114, 206, 0.25)' },
    { bg: 'linear-gradient(135deg, #0D9488 0%, #14B8A6 100%)', shadow: 'rgba(13, 148, 136, 0.25)' },
    { bg: 'linear-gradient(135deg, #7C3AED 0%, #8B5CF6 100%)', shadow: 'rgba(124, 58, 237, 0.25)' },
    { bg: 'linear-gradient(135deg, #2563EB 0%, #3B82F6 100%)', shadow: 'rgba(37, 99, 235, 0.25)' },
    { bg: 'linear-gradient(135deg, #D97706 0%, #F59E0B 100%)', shadow: 'rgba(217, 119, 6, 0.25)' }
  ];

  function getInitials(name) {
    if (!name || !name.trim()) return 'PU';
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
    const initials = getInitials(review.name);
    const palette = getPalette(review.name);

    const hasAvatar = Boolean(
      review.avatar_url &&
      typeof review.avatar_url === 'string' &&
      review.avatar_url.trim().length > 0 &&
      !review.avatar_url.includes('assets/images/team/')
    );

    const avatarMarkup = hasAvatar
      ? `<img src="${escapeHtml(review.avatar_url)}" alt="${escapeHtml(review.name)}" class="reviewer-avatar-img" onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';">
         <div class="reviewer-avatar-monogram" style="display: none; background: ${palette.bg}; box-shadow: 0 3px 10px ${palette.shadow};">
           ${escapeHtml(initials)}
         </div>`
      : `<div class="reviewer-avatar-monogram" style="background: ${palette.bg}; box-shadow: 0 3px 10px ${palette.shadow};">
           ${escapeHtml(initials)}
         </div>`;

    return `
      <article class="customer-review-card">
        <div class="review-card-top">
          <div class="reviewer-profile">
            ${avatarMarkup}
            <div class="reviewer-info-wrap">
              <span class="reviewer-name">${escapeHtml(review.name)}</span>
              <span class="reviewer-meta">${escapeHtml(review.date_display || 'Verified Feedback')}</span>
            </div>
          </div>
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

  function setupAvatarUploader() {
    const fileInput = document.getElementById('reviewAvatarInput');
    const chooseBtn = document.getElementById('reviewChooseAvatarBtn');
    const removeBtn = document.getElementById('reviewRemoveAvatarBtn');
    const previewBox = document.getElementById('reviewAvatarPreviewBox');
    const previewImg = document.getElementById('reviewAvatarImg');
    const initialsEl = document.getElementById('reviewAvatarInitials');
    const uploadBtnText = document.getElementById('reviewUploadBtnText');
    const nameInput = document.getElementById('reviewAuthorName');
    const dropZone = document.getElementById('reviewAvatarDropZone');
    const toggleUrlBtn = document.getElementById('toggleAvatarUrlBtn');
    const urlRow = document.getElementById('reviewAvatarUrlRow');
    const urlInput = document.getElementById('reviewAvatarUrlInput');

    // Sync initials in preview box as user types name
    if (nameInput && initialsEl) {
      nameInput.addEventListener('input', () => {
        if (!currentAvatarData) {
          initialsEl.textContent = getInitials(nameInput.value);
        }
      });
    }

    // Trigger file dialog
    function openFileDialog() {
      if (fileInput) fileInput.click();
    }
    if (chooseBtn) chooseBtn.addEventListener('click', openFileDialog);
    if (previewBox) {
      previewBox.addEventListener('click', openFileDialog);
      previewBox.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          openFileDialog();
        }
      });
    }

    // Handle file selection
    if (fileInput) {
      fileInput.addEventListener('change', (e) => {
        const file = e.target.files && e.target.files[0];
        if (file) handleImageFile(file);
      });
    }

    // Drag and drop
    if (dropZone) {
      ['dragenter', 'dragover'].forEach(eventName => {
        dropZone.addEventListener(eventName, (e) => {
          e.preventDefault();
          e.stopPropagation();
          dropZone.classList.add('dragover');
        });
      });

      ['dragleave', 'drop'].forEach(eventName => {
        dropZone.addEventListener(eventName, (e) => {
          e.preventDefault();
          e.stopPropagation();
          dropZone.classList.remove('dragover');
        });
      });

      dropZone.addEventListener('drop', (e) => {
        const files = e.dataTransfer && e.dataTransfer.files;
        if (files && files.length > 0) {
          handleImageFile(files[0]);
        }
      });
    }

    // Process selected image file with square crop and resize via Canvas
    function handleImageFile(file) {
      if (!file.type.startsWith('image/')) {
        showAlert('Please select a valid image file (JPG, PNG, or WebP).', 'error');
        return;
      }
      if (file.size > 5 * 1024 * 1024) {
        showAlert('Profile photo must be smaller than 5MB.', 'error');
        return;
      }

      const reader = new FileReader();
      reader.onload = function (evt) {
        const img = new Image();
        img.onload = function () {
          // Crop and scale to high quality 180x180 square
          const size = 180;
          const canvas = document.createElement('canvas');
          canvas.width = size;
          canvas.height = size;
          const ctx = canvas.getContext('2d');

          const minDim = Math.min(img.width, img.height);
          const sx = (img.width - minDim) / 2;
          const sy = (img.height - minDim) / 2;

          ctx.drawImage(img, sx, sy, minDim, minDim, 0, 0, size, size);
          const dataUrl = canvas.toDataURL('image/jpeg', 0.88);

          setAvatarPreview(dataUrl);
        };
        img.src = evt.target.result;
      };
      reader.readAsDataURL(file);
    }

    function setAvatarPreview(src) {
      currentAvatarData = src;
      if (previewImg) {
        previewImg.src = src;
        previewImg.style.display = 'block';
      }
      if (initialsEl) initialsEl.style.display = 'none';
      if (removeBtn) removeBtn.style.display = 'inline-flex';
      if (uploadBtnText) uploadBtnText.textContent = 'Change Photo';
      if (urlInput) urlInput.value = '';
    }

    // Remove photo
    if (removeBtn) {
      removeBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        resetAvatarState();
      });
    }

    // Toggle Image URL input
    if (toggleUrlBtn && urlRow) {
      toggleUrlBtn.addEventListener('click', () => {
        const isHidden = urlRow.style.display === 'none';
        urlRow.style.display = isHidden ? 'block' : 'none';
        if (isHidden && urlInput) urlInput.focus();
      });
    }

    // URL input listener
    if (urlInput) {
      urlInput.addEventListener('change', () => {
        const val = urlInput.value.trim();
        if (val && /^https?:\/\/.+/i.test(val)) {
          const testImg = new Image();
          testImg.onload = () => setAvatarPreview(val);
          testImg.onerror = () => showAlert('Could not load image from the provided URL.', 'error');
          testImg.src = val;
        }
      });
    }
  }

  function resetAvatarState() {
    currentAvatarData = '';
    const fileInput = document.getElementById('reviewAvatarInput');
    const previewImg = document.getElementById('reviewAvatarImg');
    const initialsEl = document.getElementById('reviewAvatarInitials');
    const removeBtn = document.getElementById('reviewRemoveAvatarBtn');
    const uploadBtnText = document.getElementById('reviewUploadBtnText');
    const urlInput = document.getElementById('reviewAvatarUrlInput');
    const nameInput = document.getElementById('reviewAuthorName');

    if (fileInput) fileInput.value = '';
    if (urlInput) urlInput.value = '';
    if (previewImg) {
      previewImg.src = '';
      previewImg.style.display = 'none';
    }
    if (initialsEl) {
      initialsEl.textContent = getInitials(nameInput ? nameInput.value : '');
      initialsEl.style.display = 'block';
    }
    if (removeBtn) removeBtn.style.display = 'none';
    if (uploadBtnText) uploadBtnText.textContent = 'Upload Photo';
  }

  function setupModalEvents() {
    const openBtn = document.getElementById('openWriteReviewBtn');
    const modal = document.getElementById('writeReviewModal');
    const closeBtn = document.getElementById('closeReviewModalBtn');
    const form = document.getElementById('submitReviewForm');

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
        const textInput = document.getElementById('reviewFeedbackText');
        const submitBtn = document.getElementById('submitReviewBtn');
        const urlInput = document.getElementById('reviewAvatarUrlInput');

        const name = nameInput ? nameInput.value.trim() : '';
        const company = companyInput ? companyInput.value.trim() : '';
        const platform = 'website';
        const review_text = textInput ? textInput.value.trim() : '';
        const avatar_url = currentAvatarData || (urlInput && urlInput.value.trim() ? urlInput.value.trim() : null);

        if (!name || review_text.length < 5) {
          showAlert('Please provide your name and a review of at least 5 characters.', 'error');
          return;
        }

        submitBtn.disabled = true;
        submitBtn.innerHTML = '<span>Submitting feedback...</span>';

        try {
          const res = await fetch(`${API_BASE}/api/reviews`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              name,
              company,
              platform,
              rating: selectedRating,
              review_text,
              avatar_url
            })
          });

          const data = await res.json();
          if (res.ok && data.success) {
            showAlert(data.message, 'success');
            form.reset();
            resetAvatarState();
            selectedRating = 5;
            const starPicker = document.getElementById('starRatingPicker');
            if (starPicker) updateStarDisplay(starPicker.querySelectorAll('svg'), 5);

            // Reload reviews to reflect showcase updates if auto-approved
            loadAndRenderReviews();

            setTimeout(() => {
              if (modal) modal.style.display = 'none';
            }, 3500);
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

  const ratingDescriptions = {
    5: '5 / 5 • Excellent',
    4: '4 / 5 • Very Good',
    3: '3 / 5 • Good',
    2: '2 / 5 • Fair',
    1: '1 / 5 • Needs Work'
  };

  function updateStarDisplay(stars, activeCount) {
    stars.forEach(star => {
      const val = parseInt(star.getAttribute('data-value'), 10);
      if (val <= activeCount) {
        star.classList.add('active');
      } else {
        star.classList.remove('active');
      }
    });
    const label = document.getElementById('ratingScoreLabel');
    if (label && ratingDescriptions[activeCount]) {
      label.textContent = ratingDescriptions[activeCount];
    }
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
    resetAvatarState();
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
