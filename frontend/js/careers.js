/**
 * PUVIMA Consultancy — Careers Page Interactive Logic
 * Handles dynamic position fetching, filtering, application modal workflows, and validation.
 */

(function () {
  'use strict';

  const API_BASE = ''; // Relative to host
  let allPositions = [];
  let currentFilter = 'all';
  let selectedFile = null;

  // DOM Elements
  const container = document.getElementById('positionsContainer');
  const filterChips = document.querySelectorAll('.filter-chip');
  const modalOverlay = document.getElementById('applicationModalOverlay');
  const modalTitle = document.getElementById('appModalTitle');
  const modalPositionSubtitle = document.getElementById('appModalPositionSubtitle');
  const closeAppModalBtn = document.getElementById('closeAppModalBtn');
  const form = document.getElementById('jobApplicationForm');
  const appJobIdInput = document.getElementById('appJobId');
  const submitAppBtn = document.getElementById('submitAppBtn');
  const formAlertBox = document.getElementById('formAlertBox');
  const appSuccessView = document.getElementById('appSuccessView');
  const appSuccessRefId = document.getElementById('appSuccessRefId');
  const successDoneBtn = document.getElementById('successDoneBtn');

  // File Upload Elements
  const fileDropzone = document.getElementById('fileDropzone');
  const resumeFileInput = document.getElementById('resumeFileInput');
  const fileSelectedCard = document.getElementById('fileSelectedCard');
  const selectedFileName = document.getElementById('selectedFileName');
  const selectedFileSize = document.getElementById('selectedFileSize');
  const replaceFileBtn = document.getElementById('replaceFileBtn');

  document.addEventListener('DOMContentLoaded', () => {
    setupEventListeners();
    fetchPositions();
  });

  function setupEventListeners() {
    // Filter chip clicks
    filterChips.forEach(chip => {
      chip.addEventListener('click', () => {
        filterChips.forEach(c => {
          c.classList.remove('active');
          c.setAttribute('aria-selected', 'false');
        });
        chip.classList.add('active');
        chip.setAttribute('aria-selected', 'true');
        currentFilter = chip.getAttribute('data-filter');
        renderPositions();
      });
    });

    // Modal close
    if (closeAppModalBtn) {
      closeAppModalBtn.addEventListener('click', closeApplicationModal);
    }
    if (successDoneBtn) {
      successDoneBtn.addEventListener('click', closeApplicationModal);
    }

    if (modalOverlay) {
      modalOverlay.addEventListener('click', (e) => {
        if (e.target === modalOverlay) closeApplicationModal();
      });
    }

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && modalOverlay && modalOverlay.classList.contains('open')) {
        closeApplicationModal();
      }
    });

    // File Upload handling
    if (fileDropzone && resumeFileInput) {
      fileDropzone.addEventListener('click', () => resumeFileInput.click());
      fileDropzone.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          resumeFileInput.click();
        }
      });

      // Drag & Drop
      ['dragenter', 'dragover'].forEach(eventName => {
        fileDropzone.addEventListener(eventName, (e) => {
          e.preventDefault();
          e.stopPropagation();
          fileDropzone.classList.add('dragover');
        });
      });

      ['dragleave', 'drop'].forEach(eventName => {
        fileDropzone.addEventListener(eventName, (e) => {
          e.preventDefault();
          e.stopPropagation();
          fileDropzone.classList.remove('dragover');
        });
      });

      fileDropzone.addEventListener('drop', (e) => {
        if (e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files.length) {
          handleFileSelect(e.dataTransfer.files[0]);
        }
      });

      resumeFileInput.addEventListener('change', () => {
        if (resumeFileInput.files && resumeFileInput.files.length) {
          handleFileSelect(resumeFileInput.files[0]);
        }
      });
    }

    if (replaceFileBtn) {
      replaceFileBtn.addEventListener('click', () => {
        resumeFileInput.click();
      });
    }

    // Form submission
    if (form) {
      form.addEventListener('submit', handleApplicationSubmit);
    }
  }

  // ==========================================================================
  // FETCH & RENDER POSITIONS
  // ==========================================================================

  async function fetchPositions() {
    try {
      const res = await fetch(`${API_BASE}/api/careers`);
      if (!res.ok) {
        throw new Error(`Server returned HTTP ${res.status}`);
      }
      const data = await res.json();
      allPositions = data.positions || [];
      renderPositions();
    } catch (err) {
      console.error('[Careers] Error fetching open roles:', err.message);
      renderErrorState();
    }
  }

  function renderPositions() {
    let filtered = allPositions;
    if (currentFilter && currentFilter !== 'all') {
      filtered = allPositions.filter(p => p.department && p.department.toLowerCase() === currentFilter.toLowerCase());
    }

    if (!filtered || filtered.length === 0) {
      renderEmptyState();
      return;
    }

    const html = `
      <div class="job-cards-grid">
        ${filtered.map(renderJobCardHtml).join('')}
      </div>
    `;

    container.innerHTML = html;

    // Attach Apply Now button listeners
    container.querySelectorAll('.btn-apply-job').forEach(btn => {
      btn.addEventListener('click', () => {
        const jobId = btn.getAttribute('data-job-id');
        const job = allPositions.find(p => String(p.id) === String(jobId) || p.reference_id === jobId);
        if (job) {
          openApplicationModal(job);
        }
      });
    });
  }

  function renderJobCardHtml(job) {
    const skillsList = job.required_skills
      ? job.required_skills.split(',').map(s => s.trim()).filter(Boolean)
      : [];

    return `
      <article class="job-card" id="job-${job.id}">
        <div class="job-card-header">
          <div class="job-card-title-group">
            <h2 class="job-card-title">${escapeHtml(job.title)}</h2>
            <div class="job-card-badges">
              <span class="job-badge job-badge-dept">${escapeHtml(job.department)}</span>
              <span class="job-badge job-badge-type">${escapeHtml(job.employment_type || 'Full-time')}</span>
              <span class="job-badge job-badge-arrangement">${escapeHtml(job.work_arrangement || 'Hybrid')}</span>
            </div>
          </div>
          <button type="button" class="btn btn-primary btn-apply-job" data-job-id="${job.id}">
            <span>Apply Now</span>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <line x1="5" y1="12" x2="19" y2="12"></line>
              <polyline points="12 5 19 12 12 19"></polyline>
            </svg>
          </button>
        </div>

        <div class="job-meta-row">
          <div class="job-meta-item">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path>
              <circle cx="12" cy="10" r="3"></circle>
            </svg>
            <span>${escapeHtml(job.location || 'Chennai / Bangalore, India')}</span>
          </div>

          <div class="job-meta-item">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <rect x="2" y="7" width="20" height="14" rx="2" ry="2"></rect>
              <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"></path>
            </svg>
            <span>${escapeHtml(job.experience_requirements || 'Mid-Level')}</span>
          </div>

          ${job.salary_range ? `
            <div class="job-meta-item">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <circle cx="12" cy="12" r="10"></circle>
                <path d="M16 8h-6a2 2 0 1 0 0 4h4a2 2 0 1 1 0 4H8"></path>
                <line x1="12" y1="6" x2="12" y2="18"></line>
              </svg>
              <span>${escapeHtml(job.salary_range)}</span>
            </div>
          ` : ''}
        </div>

        <p class="job-description-text">${escapeHtml(job.description)}</p>

        ${job.responsibilities ? `
          <div class="job-responsibilities-box">
            <div class="job-section-heading">Key Deliverables &amp; Focus:</div>
            <div style="font-size: 0.9rem; color: var(--text-secondary); line-height: 1.6;">
              ${escapeHtml(job.responsibilities).replace(/\n/g, '<br>')}
            </div>
          </div>
        ` : ''}

        ${skillsList.length > 0 ? `
          <div>
            <div class="job-section-heading" style="margin-bottom: 8px;">Technical Competencies:</div>
            <div class="job-skills-chips">
              ${skillsList.map(skill => `<span class="skill-chip">${escapeHtml(skill)}</span>`).join('')}
            </div>
          </div>
        ` : ''}

        <div class="job-card-footer">
          <span class="job-ref-label">Opportunity Ref: ${escapeHtml(job.reference_id)}</span>
          <button type="button" class="btn btn-secondary btn-apply-job" data-job-id="${job.id}" style="padding: 7px 16px; font-size: 0.84rem;">
            Apply for Position &rarr;
          </button>
        </div>
      </article>
    `;
  }

  function renderEmptyState() {
    container.innerHTML = `
      <div class="careers-empty-state">
        <div class="empty-state-icon">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="12" cy="12" r="10"></circle>
            <line x1="12" y1="8" x2="12" y2="12"></line>
            <line x1="12" y1="16" x2="12.01" y2="16"></line>
          </svg>
        </div>
        <h3 class="empty-state-title">There are currently no open positions. Please check back later.</h3>
        <p class="empty-state-desc">
          We frequently update our engineering and research opportunities as new consultancy engagements and prototyping pipelines develop. In the meantime, explore our technical domains or discuss prospective collaboration.
        </p>
        <div style="display: flex; gap: 12px; justify-content: center; flex-wrap: wrap;">
          <a href="contact.html" class="btn btn-primary" style="padding: 9px 20px;">Discuss a Project</a>
          <a href="services.html" class="btn btn-secondary" style="padding: 9px 20px;">View Service Catalog</a>
        </div>
      </div>
    `;
  }

  function renderErrorState() {
    container.innerHTML = `
      <div class="careers-empty-state" style="border-color: #fda4af;">
        <div class="empty-state-icon" style="background: rgba(239, 68, 68, 0.1); color: #dc2626;">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path>
            <line x1="12" y1="9" x2="12" y2="13"></line>
            <line x1="12" y1="17" x2="12.01" y2="17"></line>
          </svg>
        </div>
        <h3 class="empty-state-title">Unable to Load Career Opportunities</h3>
        <p class="empty-state-desc">
          Our careers service is momentarily unreachable. Please check your network connection or refresh the page to retry.
        </p>
        <button type="button" class="btn btn-primary" onclick="window.location.reload()" style="margin: 0 auto;">
          Reload Opportunities
        </button>
      </div>
    `;
  }

  // ==========================================================================
  // APPLICATION MODAL WORKFLOW
  // ==========================================================================

  function openApplicationModal(job) {
    if (!modalOverlay) return;

    resetForm();

    appJobIdInput.value = job.id;
    modalTitle.textContent = `Apply for ${job.title}`;
    modalPositionSubtitle.textContent = `Department: ${job.department} • Ref: ${job.reference_id}`;

    modalOverlay.classList.add('open');
    document.body.style.overflow = 'hidden';

    const nameInput = document.getElementById('applicantName');
    if (nameInput) nameInput.focus();
  }

  function closeApplicationModal() {
    if (!modalOverlay) return;
    modalOverlay.classList.remove('open');
    document.body.style.overflow = '';
    resetForm();
  }

  function handleFileSelect(file) {
    if (!file) return;

    const allowed = ['.pdf', '.doc', '.docx'];
    const ext = '.' + file.name.split('.').pop().toLowerCase();

    if (!allowed.includes(ext)) {
      showFieldError('resume', 'Invalid file format. Please upload a PDF, DOC, or DOCX document.');
      return;
    }

    const maxSize = 5 * 1024 * 1024; // 5 MB
    if (file.size > maxSize) {
      showFieldError('resume', 'Resume file exceeds the 5MB upload limit. Please select a smaller file.');
      return;
    }

    clearFieldError('resume');
    selectedFile = file;

    selectedFileName.textContent = file.name;
    const sizeMb = (file.size / (1024 * 1024)).toFixed(2);
    selectedFileSize.textContent = `${sizeMb} MB`;

    fileDropzone.style.display = 'none';
    fileSelectedCard.style.display = 'flex';
  }

  function clearSelectedFile() {
    selectedFile = null;
    resumeFileInput.value = '';
    fileSelectedCard.style.display = 'none';
    fileDropzone.style.display = 'block';
  }

  // ==========================================================================
  // SUBMISSION & VALIDATION
  // ==========================================================================

  async function handleApplicationSubmit(e) {
    e.preventDefault();
    clearAllErrors();

    const jobId = appJobIdInput.value;
    const name = document.getElementById('applicantName').value.trim();
    const email = document.getElementById('applicantEmail').value.trim();
    const phone = document.getElementById('applicantPhone').value.trim();
    const education = document.getElementById('applicantEducation').value.trim();
    const experience = document.getElementById('applicantExperience').value.trim();
    const skills = document.getElementById('applicantSkills').value.trim();
    const linkedin = document.getElementById('applicantLinkedin').value.trim();
    const portfolio = document.getElementById('applicantPortfolio').value.trim();
    const coverLetter = document.getElementById('applicantCoverLetter').value.trim();
    const consent = document.getElementById('consentCheckbox').checked;

    let hasErrors = false;

    // Validate Name
    if (!name || name.length < 2) {
      showFieldError('applicant_name', 'Full legal name is required (minimum 2 characters).');
      hasErrors = true;
    }

    // Validate Email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!email || !emailRegex.test(email)) {
      showFieldError('applicant_email', 'Please provide a valid email address.');
      hasErrors = true;
    }

    // Validate Phone
    const phoneRegex = /^[+0-9()\-\s.]{7,30}$/;
    if (!phone || !phoneRegex.test(phone)) {
      showFieldError('applicant_phone', 'Please enter a valid phone number.');
      hasErrors = true;
    }

    // Validate Resume
    if (!selectedFile) {
      showFieldError('resume', 'Please attach your resume document (PDF, DOC, or DOCX).');
      hasErrors = true;
    }

    // Validate Consent
    if (!consent) {
      showFieldError('consent', 'You must acknowledge the privacy notice to submit your application.');
      hasErrors = true;
    }

    if (hasErrors) {
      showAlert('Please address the highlighted form errors before proceeding.', 'error');
      return;
    }

    // Build FormData
    const formData = new FormData();
    formData.append('applicant_name', name);
    formData.append('applicant_email', email);
    formData.append('applicant_phone', phone);
    formData.append('education', education);
    formData.append('experience_years', experience);
    formData.append('skills', skills);
    formData.append('linkedin_url', linkedin);
    formData.append('portfolio_url', portfolio);
    formData.append('cover_letter', coverLetter);
    formData.append('consent', 'true');
    formData.append('resume', selectedFile, selectedFile.name);

    // Disable button to prevent duplicate submissions
    submitAppBtn.disabled = true;
    const originalBtnHtml = submitAppBtn.innerHTML;
    submitAppBtn.innerHTML = `
      <span class="btn-spinner" style="display:inline-block; width:16px; height:16px; border:2px solid #ffffff; border-top-color:transparent; border-radius:50%; animation:spin 0.8s linear infinite; margin-right:8px;"></span>
      <span>Submitting Application...</span>
    `;

    try {
      const res = await fetch(`${API_BASE}/api/careers/${jobId}/apply`, {
        method: 'POST',
        body: formData
      });

      const data = await res.json();

      if (res.ok && data.success) {
        showSuccessState(data.referenceId);
      } else {
        if (data.errors) {
          Object.entries(data.errors).forEach(([field, msg]) => {
            showFieldError(field, msg);
          });
        }
        showAlert(data.message || 'Application submission failed. Please verify your inputs.', 'error');
      }
    } catch (err) {
      console.error('[Careers] Application submission network error:', err);
      showAlert('Network error: Unable to deliver application. Please check your connection and retry.', 'error');
    } finally {
      submitAppBtn.disabled = false;
      submitAppBtn.innerHTML = originalBtnHtml;
    }
  }

  function showSuccessState(refId) {
    form.style.display = 'none';
    appSuccessRefId.textContent = refId || 'APP-SAVED';
    appSuccessView.style.display = 'block';
  }

  function resetForm() {
    if (!form) return;
    form.reset();
    form.style.display = 'block';
    if (appSuccessView) appSuccessView.style.display = 'none';
    clearSelectedFile();
    clearAllErrors();
    if (formAlertBox) formAlertBox.style.display = 'none';
  }

  function showFieldError(field, message) {
    const errorEl = document.getElementById(`err-${field}`);
    if (errorEl) {
      errorEl.textContent = message;
      errorEl.classList.add('visible');
    }
    const input = form.querySelector(`[name="${field}"]`) || document.getElementById(`applicant${capitalize(field)}`);
    if (input) {
      input.classList.add('is-invalid');
    }
  }

  function clearFieldError(field) {
    const errorEl = document.getElementById(`err-${field}`);
    if (errorEl) {
      errorEl.classList.remove('visible');
    }
    const input = form.querySelector(`[name="${field}"]`) || document.getElementById(`applicant${capitalize(field)}`);
    if (input) {
      input.classList.remove('is-invalid');
    }
  }

  function clearAllErrors() {
    document.querySelectorAll('.field-error').forEach(el => el.classList.remove('visible'));
    document.querySelectorAll('.form-control').forEach(el => el.classList.remove('is-invalid'));
    if (formAlertBox) formAlertBox.style.display = 'none';
  }

  function showAlert(message, type = 'error') {
    if (!formAlertBox) return;
    formAlertBox.textContent = message;
    formAlertBox.style.display = 'block';
    if (type === 'error') {
      formAlertBox.style.background = '#fef2f2';
      formAlertBox.style.color = '#991b1b';
      formAlertBox.style.border = '1px solid #fecaca';
    } else {
      formAlertBox.style.background = '#f0fdf4';
      formAlertBox.style.color = '#166534';
      formAlertBox.style.border = '1px solid #bbf7d0';
    }
  }

  function capitalize(str) {
    return str.charAt(0).toUpperCase() + str.slice(1);
  }

  function escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

})();
