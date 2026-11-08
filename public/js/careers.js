/**
 * PUVIMA Consultancy — Internship Application Wizard Controller
 * Manages the 5-step application questionnaire, drag-and-drop resume upload,
 * client-side validations, review summary generation, and API submission.
 */

(function () {
  'use strict';

  const API_BASE = (window.PUVIMA_CONFIG && window.PUVIMA_CONFIG.API_BASE_URL) || (function () {
    try {
      let stored = localStorage.getItem('puvima_api_base_url') || '';
      if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
        if (stored && stored.includes('vercel.app')) {
          stored = '';
          localStorage.removeItem('puvima_api_base_url');
        }
      }
      return stored;
    } catch (e) { return ''; }
  })();

  const MAX_RESUME_BYTES = 5 * 1024 * 1024; // 5 MB
  const ALLOWED_EXTS = ['.pdf', '.doc', '.docx'];

  let currentStep = 1;
  let selectedResumeFile = null;
  let isSubmitting = false;

  document.addEventListener('DOMContentLoaded', () => {
    initWizard();
  });

  function initWizard() {
    setupStepperNav();
    setupNextPrevButtons();
    setupConditionalFields();
    setupResumeDropzone();
    setupSkillsChips();
    setupFormSubmission();
    setupSuccessActions();
  }

  // ==========================================================================
  // 1. STEP NAVIGATION & STEPPER
  // ==========================================================================
  function setupStepperNav() {
    const stepperItems = document.querySelectorAll('.stepper-item');
    stepperItems.forEach(item => {
      item.addEventListener('click', () => {
        const targetStep = parseInt(item.getAttribute('data-step-nav'), 10);
        // Only allow jumping backward, or forward if all intermediate steps are valid
        if (targetStep < currentStep) {
          goToStep(targetStep);
        } else if (targetStep > currentStep) {
          if (validateCurrentStep()) {
            goToStep(targetStep);
          }
        }
      });
    });

    // Jump-to buttons in Step 5 review
    document.querySelectorAll('[data-jump-to]').forEach(btn => {
      btn.addEventListener('click', () => {
        const stepNum = parseInt(btn.getAttribute('data-jump-to'), 10);
        goToStep(stepNum);
      });
    });
  }

  function setupNextPrevButtons() {
    // Next buttons with Step 1 Eligibility Pre-check
    document.querySelectorAll('[data-next-to]').forEach(btn => {
      btn.addEventListener('click', async () => {
        const nextStep = parseInt(btn.getAttribute('data-next-to'), 10);
        if (!validateCurrentStep()) return;

        // If advancing from Step 1, verify candidate reapplication eligibility
        if (currentStep === 1 && nextStep > 1) {
          const email = (document.getElementById('appEmail')?.value || '').trim();
          const phone = (document.getElementById('appPhone')?.value || '').trim();
          const originalText = btn.textContent;

          btn.disabled = true;
          btn.textContent = 'Checking Eligibility...';

          try {
            const checkRes = await fetch(`${API_BASE}/api/internship-applications/check-eligibility`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ email, phone })
            });

            if (checkRes.ok) {
              const checkData = await checkRes.json();
              if (checkData && !checkData.allowed) {
                showEligibilityAlert(checkData.reason, checkData.status);
                btn.disabled = false;
                btn.textContent = originalText;
                return;
              }
            }
          } catch (chkErr) {
            console.warn('[EligibilityCheck] Pre-flight notice:', chkErr);
          } finally {
            btn.disabled = false;
            btn.textContent = originalText;
          }
        }

        goToStep(nextStep);
      });
    });

    // Prev buttons
    document.querySelectorAll('[data-prev-to]').forEach(btn => {
      btn.addEventListener('click', () => {
        const prevStep = parseInt(btn.getAttribute('data-prev-to'), 10);
        goToStep(prevStep);
      });
    });
  }

  function goToStep(stepNumber) {
    if (stepNumber < 1 || stepNumber > 5) return;

    // Hide all step panels
    document.querySelectorAll('.wizard-step').forEach(panel => {
      panel.classList.remove('active-step');
    });

    // Show target step panel
    const targetPanel = document.getElementById(`stepPanel${stepNumber}`);
    if (targetPanel) {
      targetPanel.classList.add('active-step');
    }

    // Update Stepper Navigation visuals
    document.querySelectorAll('.stepper-item').forEach(item => {
      const itemStep = parseInt(item.getAttribute('data-step-nav'), 10);
      item.classList.remove('active', 'completed');
      const indicator = item.querySelector('.step-indicator');

      if (itemStep === stepNumber) {
        item.classList.add('active');
        if (indicator) indicator.textContent = itemStep;
      } else if (itemStep < stepNumber) {
        item.classList.add('completed');
        if (indicator) indicator.innerHTML = '&#10003;'; // Checkmark
      } else {
        if (indicator) indicator.textContent = itemStep;
      }
    });

    currentStep = stepNumber;

    // If entering Step 5, populate Review Summary
    if (currentStep === 5) {
      populateReviewSummary();
    }

    // Smooth scroll to top of wizard card
    const card = document.getElementById('internshipFormWrapper');
    if (card) {
      card.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }

  // ==========================================================================
  // 2. STEP VALIDATION
  // ==========================================================================
  function validateCurrentStep() {
    clearErrors();
    let isValid = true;

    if (currentStep === 1) {
      const fullName = (document.getElementById('appFullName')?.value || '').trim();
      const email = (document.getElementById('appEmail')?.value || '').trim();
      const phone = (document.getElementById('appPhone')?.value || '').trim();
      const cityState = (document.getElementById('appCityState')?.value || '').trim();
      const linkedin = (document.getElementById('appLinkedin')?.value || '').trim();
      const college = (document.getElementById('appCollege')?.value || '').trim();
      const degree = (document.getElementById('appDegree')?.value || '').trim();
      const studyYear = document.getElementById('appStudyYear')?.value;
      const gradYear = document.getElementById('appGraduationYear')?.value;
      const cgpa = document.getElementById('appCgpaRange')?.value;

      if (!fullName || fullName.length < 2) {
        showError('full_name', 'appFullName');
        isValid = false;
      }
      if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        showError('email', 'appEmail');
        isValid = false;
      }
      if (!phone || phone.length < 7) {
        showError('phone', 'appPhone');
        isValid = false;
      }
      if (!cityState || cityState.length < 2) {
        showError('city_state', 'appCityState');
        isValid = false;
      }
      if (linkedin && !linkedin.startsWith('http://') && !linkedin.startsWith('https://')) {
        showError('linkedin_url', 'appLinkedin');
        isValid = false;
      }
      if (!college || college.length < 2) {
        showError('college', 'appCollege');
        isValid = false;
      }
      if (!degree || degree.length < 2) {
        showError('degree', 'appDegree');
        isValid = false;
      }
      if (!studyYear) {
        showError('study_year', 'appStudyYear');
        isValid = false;
      }
      if (!gradYear) {
        showError('graduation_year', 'appGraduationYear');
        isValid = false;
      }
      if (!cgpa) {
        showError('cgpa_range', 'appCgpaRange');
        isValid = false;
      }
    } else if (currentStep === 2) {
      const role = document.getElementById('appRole')?.value;
      const checkedSkills = document.querySelectorAll('input[name="skills"]:checked');
      const strongest = (document.getElementById('appStrongestSkills')?.value || '').trim();
      const portfolioUrl = (document.getElementById('appPortfolioUrl')?.value || '').trim();

      if (!role) {
        showError('internship_role', 'appRole');
        isValid = false;
      }
      if (checkedSkills.length === 0) {
        showError('skills');
        isValid = false;
      }
      if (!strongest || strongest.length < 10) {
        showError('strongest_skills', 'appStrongestSkills');
        isValid = false;
      }
      if (portfolioUrl && !portfolioUrl.startsWith('http://') && !portfolioUrl.startsWith('https://')) {
        showError('github_portfolio_url', 'appPortfolioUrl');
        isValid = false;
      }
      if (!selectedResumeFile) {
        showError('resume');
        isValid = false;
      }
    } else if (currentStep === 3) {
      const motivation = (document.getElementById('appMotivation')?.value || '').trim();
      const contribution = (document.getElementById('appContribution')?.value || '').trim();
      const mode = document.getElementById('appMode')?.value;
      const duration = document.getElementById('appDuration')?.value;
      const joining = document.getElementById('appJoining')?.value;
      const hours = document.getElementById('appHours')?.value;

      if (!motivation || motivation.length < 10) {
        showError('motivation', 'appMotivation');
        isValid = false;
      }
      if (!contribution || contribution.length < 10) {
        showError('expected_contribution', 'appContribution');
        isValid = false;
      }
      if (!mode) {
        showError('internship_mode', 'appMode');
        isValid = false;
      }
      if (!duration) {
        showError('duration', 'appDuration');
        isValid = false;
      }
      if (!joining) {
        showError('joining_availability', 'appJoining');
        isValid = false;
      }
      if (joining === 'On a specific future date') {
        const specificDate = document.getElementById('appSpecificDate')?.value;
        if (!specificDate) {
          showError('specific_joining_date', 'appSpecificDate');
          isValid = false;
        }
      }
      if (!hours) {
        showError('weekly_hours', 'appHours');
        isValid = false;
      }
    } else if (currentStep === 4) {
      const referral = document.getElementById('appReferral')?.value;
      if (!referral) {
        showError('referral_source', 'appReferral');
        isValid = false;
      }
      if (referral === 'Other') {
        const otherDetail = (document.getElementById('appOtherReferral')?.value || '').trim();
        if (!otherDetail) {
          showError('other_referral_details', 'appOtherReferral');
          isValid = false;
        }
      }
    }

    return isValid;
  }

  function showError(fieldKey, inputId = null) {
    const hint = document.getElementById(`err_${fieldKey}`);
    if (hint) hint.classList.add('visible');
    if (inputId) {
      const input = document.getElementById(inputId);
      if (input) {
        input.classList.add('field-has-error');
        input.addEventListener('input', () => {
          input.classList.remove('field-has-error');
          if (hint) hint.classList.remove('visible');
        }, { once: true });
        input.addEventListener('change', () => {
          input.classList.remove('field-has-error');
          if (hint) hint.classList.remove('visible');
        }, { once: true });
      }
    }
  }

  function showEligibilityAlert(reason, status) {
    const alertBox = document.getElementById('step1EligibilityAlert');
    const titleEl = document.getElementById('step1EligibilityTitle');
    const msgEl = document.getElementById('step1EligibilityMessage');

    if (alertBox && msgEl) {
      if (titleEl) {
        if (status === 'Pending') titleEl.textContent = 'Application Currently Pending in Review';
        else if (status === 'Rejected') titleEl.textContent = 'Reapplication Cooldown Active (2 Months)';
        else if (status === 'Selected') titleEl.textContent = 'Application Already Accepted';
        else titleEl.textContent = 'Reapplication Notice';
      }
      msgEl.textContent = reason || 'An existing application was found for this contact information.';
      alertBox.style.display = 'block';
      alertBox.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }

  function clearEligibilityAlert() {
    const alertBox = document.getElementById('step1EligibilityAlert');
    if (alertBox) {
      alertBox.style.display = 'none';
    }
  }

  function clearErrors() {
    document.querySelectorAll('.field-error-hint').forEach(el => el.classList.remove('visible'));
    document.querySelectorAll('.field-has-error').forEach(el => el.classList.remove('field-has-error'));
    clearEligibilityAlert();
    const banner = document.getElementById('submitErrorBanner');
    if (banner) {
      banner.style.display = 'none';
      banner.textContent = '';
    }
  }

  // ==========================================================================
  // 3. CONDITIONAL FIELDS
  // ==========================================================================
  function setupConditionalFields() {
    // 1. Specific Future Date Picker
    const joiningSelect = document.getElementById('appJoining');
    const specificDateGroup = document.getElementById('specificDateGroup');
    const specificDateInput = document.getElementById('appSpecificDate');

    if (specificDateInput) {
      // Set min date to today
      const today = new Date().toISOString().split('T')[0];
      specificDateInput.setAttribute('min', today);
    }

    if (joiningSelect && specificDateGroup) {
      joiningSelect.addEventListener('change', () => {
        if (joiningSelect.value === 'On a specific future date') {
          specificDateGroup.style.display = 'flex';
          if (specificDateInput) specificDateInput.required = true;
        } else {
          specificDateGroup.style.display = 'none';
          if (specificDateInput) {
            specificDateInput.required = false;
            specificDateInput.value = '';
          }
        }
      });
    }

    // 2. Referral Source "Other"
    const referralSelect = document.getElementById('appReferral');
    const otherReferralGroup = document.getElementById('otherReferralGroup');
    const otherReferralInput = document.getElementById('appOtherReferral');

    if (referralSelect && otherReferralGroup) {
      referralSelect.addEventListener('change', () => {
        if (referralSelect.value === 'Other') {
          otherReferralGroup.style.display = 'flex';
          if (otherReferralInput) otherReferralInput.required = true;
        } else {
          otherReferralGroup.style.display = 'none';
          if (otherReferralInput) {
            otherReferralInput.required = false;
            otherReferralInput.value = '';
          }
        }
      });
    }
  }

  // ==========================================================================
  // 4. RESUME DRAG-AND-DROP UPLOAD
  // ==========================================================================
  function setupResumeDropzone() {
    const dropzone = document.getElementById('resumeDropzone');
    const fileInput = document.getElementById('resumeFileInput');
    const previewCard = document.getElementById('resumePreviewCard');
    const previewName = document.getElementById('resumePreviewName');
    const previewSize = document.getElementById('resumePreviewSize');
    const formatBadge = document.getElementById('resumeFormatBadge');
    const removeBtn = document.getElementById('resumeRemoveBtn');
    const resumeErrorHint = document.getElementById('err_resume');

    if (!dropzone || !fileInput) return;

    ['dragenter', 'dragover'].forEach(eventName => {
      dropzone.addEventListener(eventName, (e) => {
        e.preventDefault();
        e.stopPropagation();
        dropzone.classList.add('dragover');
      });
    });

    ['dragleave', 'drop'].forEach(eventName => {
      dropzone.addEventListener(eventName, (e) => {
        e.preventDefault();
        e.stopPropagation();
        dropzone.classList.remove('dragover');
      });
    });

    dropzone.addEventListener('drop', (e) => {
      const files = e.dataTransfer && e.dataTransfer.files;
      if (files && files.length > 0) {
        handleSelectedFile(files[0]);
      }
    });

    fileInput.addEventListener('change', () => {
      if (fileInput.files && fileInput.files.length > 0) {
        handleSelectedFile(fileInput.files[0]);
      }
    });

    if (removeBtn) {
      removeBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        selectedResumeFile = null;
        fileInput.value = '';
        if (previewCard) previewCard.style.display = 'none';
        dropzone.style.display = 'block';
      });
    }

    function handleSelectedFile(file) {
      if (resumeErrorHint) resumeErrorHint.classList.remove('visible');

      const fileName = file.name || '';
      const ext = (fileName.slice(fileName.lastIndexOf('.')) || '').toLowerCase();

      if (!ALLOWED_EXTS.includes(ext)) {
        if (resumeErrorHint) {
          resumeErrorHint.textContent = `Unsupported file format '${ext}'. Only PDF (.pdf) and Word (.doc, .docx) documents are accepted.`;
          resumeErrorHint.classList.add('visible');
        }
        fileInput.value = '';
        return;
      }

      if (file.size > MAX_RESUME_BYTES) {
        if (resumeErrorHint) {
          resumeErrorHint.textContent = `File size (${(file.size / (1024 * 1024)).toFixed(2)} MB) exceeds 5MB limit. Please compress or select a smaller document.`;
          resumeErrorHint.classList.add('visible');
        }
        fileInput.value = '';
        return;
      }

      selectedResumeFile = file;

      // Update preview card
      if (previewName) previewName.textContent = fileName;
      if (previewSize) {
        const sizeKb = Math.round(file.size / 1024);
        previewSize.textContent = sizeKb > 1024 ? `${(sizeKb / 1024).toFixed(2)} MB` : `${sizeKb} KB`;
      }
      if (formatBadge) {
        formatBadge.textContent = ext.replace('.', '').toUpperCase();
      }

      if (previewCard) previewCard.style.display = 'flex';
      dropzone.style.display = 'none';
    }
  }

  // ==========================================================================
  // 5. SKILLS CHIPS INTERACTION
  // ==========================================================================
  function setupSkillsChips() {
    const chips = document.querySelectorAll('input[name="skills"]');
    chips.forEach(chip => {
      chip.addEventListener('change', () => {
        const errHint = document.getElementById('err_skills');
        if (errHint && document.querySelectorAll('input[name="skills"]:checked').length > 0) {
          errHint.classList.remove('visible');
        }
      });
    });
  }

  // ==========================================================================
  // 6. POPULATE REVIEW SUMMARY (STEP 5)
  // ==========================================================================
  function populateReviewSummary() {
    // Section 1
    const fullName = document.getElementById('appFullName')?.value || '';
    const email = document.getElementById('appEmail')?.value || '';
    const phone = document.getElementById('appPhone')?.value || '';
    const cityState = document.getElementById('appCityState')?.value || '';
    const college = document.getElementById('appCollege')?.value || '';
    const degree = document.getElementById('appDegree')?.value || '';
    const studyYear = document.getElementById('appStudyYear')?.value || '';
    const gradYear = document.getElementById('appGraduationYear')?.value || '';
    const cgpa = document.getElementById('appCgpaRange')?.value || '';

    setVal('rev_full_name', fullName);
    setVal('rev_email', email);
    setVal('rev_phone', phone);
    setVal('rev_city_state', cityState);
    setVal('rev_college', college);
    setVal('rev_degree', degree);
    setVal('rev_study_grad', `${studyYear} (Grad: ${gradYear})`);
    setVal('rev_cgpa', cgpa);

    // Section 2
    const role = document.getElementById('appRole')?.value || '';
    const checkedSkills = Array.from(document.querySelectorAll('input[name="skills"]:checked')).map(c => c.value);
    setVal('rev_role', role);
    setVal('rev_skills', checkedSkills.length > 0 ? checkedSkills.join(', ') : 'None selected');
    setVal('rev_resume_file', selectedResumeFile ? `${selectedResumeFile.name} (${Math.round(selectedResumeFile.size / 1024)} KB)` : 'No file selected');

    // Section 3
    const mode = document.getElementById('appMode')?.value || '';
    const duration = document.getElementById('appDuration')?.value || '';
    const joining = document.getElementById('appJoining')?.value || '';
    const specificDate = document.getElementById('appSpecificDate')?.value;
    const hours = document.getElementById('appHours')?.value || '';

    setVal('rev_mode', mode);
    setVal('rev_duration', duration);
    setVal('rev_joining', joining === 'On a specific future date' && specificDate ? `Specific Date: ${specificDate}` : joining);
    setVal('rev_hours', hours);
  }

  function setVal(elementId, text) {
    const el = document.getElementById(elementId);
    if (el) el.textContent = text || '--';
  }

  // ==========================================================================
  // 7. FORM SUBMISSION
  // ==========================================================================
  function setupFormSubmission() {
    const form = document.getElementById('internshipApplicationForm');
    const submitBtn = document.getElementById('btnSubmitApplication');
    const submitBtnText = document.getElementById('submitBtnText');
    const consentBox = document.getElementById('appConsent');
    const consentErr = document.getElementById('err_consent');
    const errorBanner = document.getElementById('submitErrorBanner');

    if (!form) return;

    form.addEventListener('submit', async (e) => {
      e.preventDefault();

      if (isSubmitting) return;

      // Verify consent
      if (!consentBox || !consentBox.checked) {
        if (consentErr) consentErr.classList.add('visible');
        return;
      }
      if (consentErr) consentErr.classList.remove('visible');

      // Final validation check across all steps
      if (!selectedResumeFile) {
        goToStep(2);
        showError('resume');
        return;
      }

      isSubmitting = true;
      if (submitBtn) submitBtn.disabled = true;
      if (submitBtnText) submitBtnText.textContent = 'Uploading to Google Drive & Submitting...';
      if (errorBanner) {
        errorBanner.style.display = 'none';
        errorBanner.textContent = '';
      }

      try {
        const formData = new FormData(form);

        // Ensure resume file is attached from selectedResumeFile
        if (selectedResumeFile) {
          formData.set('resume', selectedResumeFile);
        }

        // Skills as array/json
        const checkedSkills = Array.from(document.querySelectorAll('input[name="skills"]:checked')).map(c => c.value);
        formData.set('skills', JSON.stringify(checkedSkills));

        const response = await fetch(`${API_BASE}/api/internship-applications`, {
          method: 'POST',
          body: formData
        });

        const data = await response.json();

        if (response.ok && data.success) {
          showSuccessScreen(data);
        } else {
          const errMsg = data.message || (data.errors ? Object.values(data.errors)[0] : 'Application submission encountered an issue. Please review your fields and try again.');
          if (errorBanner) {
            errorBanner.textContent = errMsg;
            errorBanner.style.display = 'block';
            errorBanner.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
          }
        }
      } catch (err) {
        console.error('[InternshipApp] Submission network error:', err);
        if (errorBanner) {
          errorBanner.textContent = 'A connection error occurred while submitting your application. Please verify your internet connection and try again.';
          errorBanner.style.display = 'block';
        }
      } finally {
        isSubmitting = false;
        if (submitBtn) submitBtn.disabled = false;
        if (submitBtnText) submitBtnText.textContent = 'Submit Application Now';
      }
    });
  }

  // ==========================================================================
  // 8. SUCCESS SCREEN & RESET
  // ==========================================================================
  function showSuccessScreen(data) {
    const form = document.getElementById('internshipApplicationForm');
    const stepper = document.querySelector('.internship-stepper');
    const successBanner = document.getElementById('submissionSuccessBanner');
    const refDisplay = document.getElementById('successRefIdDisplay');

    if (form) form.style.display = 'none';
    if (stepper) stepper.style.display = 'none';

    if (refDisplay && data.referenceId) {
      refDisplay.textContent = data.referenceId;
    }

    if (successBanner) {
      successBanner.style.display = 'block';
      successBanner.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }

  function setupSuccessActions() {
    // Copy Ref ID button
    const copyBtn = document.getElementById('copyRefBtn');
    const refDisplay = document.getElementById('successRefIdDisplay');

    if (copyBtn && refDisplay) {
      copyBtn.addEventListener('click', async () => {
        const text = refDisplay.textContent.trim();
        try {
          await navigator.clipboard.writeText(text);
          const original = copyBtn.textContent;
          copyBtn.textContent = 'Copied! ✓';
          setTimeout(() => {
            copyBtn.textContent = original;
          }, 2500);
        } catch (e) {
          // Fallback selection
          const range = document.createRange();
          range.selectNodeContents(refDisplay);
          const sel = window.getSelection();
          sel.removeAllRanges();
          sel.addRange(range);
        }
      });
    }

    // Reset button
    const resetBtn = document.getElementById('resetApplicationBtn');
    if (resetBtn) {
      resetBtn.addEventListener('click', () => {
        const form = document.getElementById('internshipApplicationForm');
        const stepper = document.querySelector('.internship-stepper');
        const successBanner = document.getElementById('submissionSuccessBanner');
        const previewCard = document.getElementById('resumePreviewCard');
        const dropzone = document.getElementById('resumeDropzone');

        if (form) {
          form.reset();
          form.style.display = 'block';
        }
        if (stepper) stepper.style.display = 'flex';
        if (successBanner) successBanner.style.display = 'none';
        if (previewCard) previewCard.style.display = 'none';
        if (dropzone) dropzone.style.display = 'block';

        selectedResumeFile = null;
        goToStep(1);
      });
    }
  }

})();
