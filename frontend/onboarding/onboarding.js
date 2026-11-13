/**
 * Puvima IT Service and Research Consultancy — Applicant Onboarding & Verification Client Logic
 */

(function () {
  'use strict';

  // Constants & Document Categories
  const DOC_CATEGORIES = [
    { key: 'resume', title: 'Updated Resume / CV', desc: 'Latest CV highlighting technical stack and projects (PDF preferred)', mandatory: true },
    { key: 'govt_id', title: 'Government ID Proof', desc: 'Aadhaar Card, Passport, Voter ID, or Driving License', mandatory: true },
    { key: 'academic_marks', title: 'Academic Mark Sheets / Degree', desc: 'Consolidated mark sheets or degree/provisional certificate', mandatory: true },
    { key: 'photo', title: 'Passport Size Photograph', desc: 'Recent professional photo with clean background (JPG / PNG)', mandatory: true },
    { key: 'bank_proof', title: 'Bank Account Proof', desc: 'Cancelled cheque or first page of bank passbook for stipend', mandatory: false },
    { key: 'offer_letter', title: 'Signed Offer / Acceptance Letter', desc: 'Executed PUVIMA offer letter if previously issued', mandatory: false },
    { key: 'other', title: 'Other Supporting Documents', desc: 'Certifications, publications, recommendation letters (Optional)', mandatory: false }
  ];

  // State
  let currentApp = null;
  let currentToken = null;
  let activeStep = 1;
  let isCorrectionMode = false;
  let correctionFields = [];

  // DOM Elements
  const viewInitial = document.getElementById('viewInitial');
  const viewWizard = document.getElementById('viewWizard');
  const viewTracking = document.getElementById('viewTracking');

  // Stepper Elements
  const stepperIndicator = document.getElementById('stepperIndicator');
  const stepperStepTitle = document.getElementById('stepperStepTitle');
  const stepperAppIdDisplay = document.getElementById('stepperAppIdDisplay');
  const stepperSteps = document.querySelectorAll('.stepper-step');

  // Modals
  const trackModal = document.getElementById('trackModal');
  const docPreviewModal = document.getElementById('docPreviewModal');
  const submitSuccessModal = document.getElementById('submitSuccessModal');

  // Initialize
  window.addEventListener('DOMContentLoaded', init);

  async function init() {
    bindGlobalEvents();
    renderUploadDropzones();
    
    // Check URL parameters for application tracking or resumption
    const urlParams = new URLSearchParams(window.location.search);
    const paramId = urlParams.get('id') || urlParams.get('application_id') || urlParams.get('app_id');
    const paramToken = urlParams.get('token');
    const paramEmail = urlParams.get('email');
    const paramName = urlParams.get('name');
    const paramPos = urlParams.get('position');

    if (paramEmail) {
      const emailInput = document.getElementById('initEmail');
      if (emailInput) emailInput.value = paramEmail;
    }
    if (paramName) {
      const nameInput = document.getElementById('initName');
      if (nameInput) nameInput.value = paramName;
    }
    if (paramPos) {
      const posSelect = document.getElementById('initPosition');
      if (posSelect) posSelect.value = paramPos;
    }

    // Also check sessionStorage
    const savedToken = paramToken || sessionStorage.getItem('puvima_onboarding_token');
    const savedAppId = paramId || sessionStorage.getItem('puvima_onboarding_app_id');

    if (savedAppId) {
      await loadApplication(savedAppId, savedToken);
    } else if (paramEmail) {
      // If worker came directly with their email, attempt to load their existing application
      await loadApplication(paramEmail, savedToken);
    }
  }

  function bindGlobalEvents() {
    // Initial Form Submit
    const initForm = document.getElementById('initForm');
    if (initForm) {
      initForm.addEventListener('submit', handleInitSubmit);
    }

    // Modal Toggles
    const btnToggleTrackModal = document.getElementById('btnToggleTrackModal');
    if (btnToggleTrackModal) {
      btnToggleTrackModal.addEventListener('click', () => {
        trackModal.style.display = 'flex';
      });
    }

    const btnCloseTrackModal = document.getElementById('btnCloseTrackModal');
    const btnCancelTrackModal = document.getElementById('btnCancelTrackModal');
    if (btnCloseTrackModal) btnCloseTrackModal.addEventListener('click', () => trackModal.style.display = 'none');
    if (btnCancelTrackModal) btnCancelTrackModal.addEventListener('click', () => trackModal.style.display = 'none');

    const linkTrackStatus = document.getElementById('linkTrackStatus');
    if (linkTrackStatus) {
      linkTrackStatus.addEventListener('click', (e) => {
        e.preventDefault();
        trackModal.style.display = 'flex';
      });
    }

    // Track Search Form
    const trackSearchForm = document.getElementById('trackSearchForm');
    if (trackSearchForm) {
      trackSearchForm.addEventListener('submit', handleTrackSearch);
    }

    // Stepper Navigation clicks
    stepperSteps.forEach(stepEl => {
      stepEl.addEventListener('click', () => {
        const stepNum = parseInt(stepEl.getAttribute('data-step'), 10);
        if (currentApp) {
          goToStep(stepNum);
        }
      });
    });

    // Step Next / Prev buttons
    document.querySelectorAll('.btn-next-step').forEach(btn => {
      btn.addEventListener('click', () => {
        const target = parseInt(btn.getAttribute('data-target'), 10);
        handleStepSaveAndAdvance(activeStep, target);
      });
    });

    document.querySelectorAll('.btn-prev-step').forEach(btn => {
      btn.addEventListener('click', () => {
        const target = parseInt(btn.getAttribute('data-target'), 10);
        goToStep(target);
      });
    });

    // Jump to step from review
    document.querySelectorAll('[data-goto-step]').forEach(btn => {
      btn.addEventListener('click', () => {
        const stepNum = parseInt(btn.getAttribute('data-goto-step'), 10);
        goToStep(stepNum);
      });
    });

    // Same address toggle
    const chkSameAddress = document.getElementById('chkSameAddress');
    if (chkSameAddress) {
      chkSameAddress.addEventListener('change', () => {
        const perm = document.getElementById('cnt_permanent_address').value;
        const curr = document.getElementById('cnt_current_address');
        if (chkSameAddress.checked) {
          curr.value = perm;
          curr.setAttribute('readonly', 'true');
        } else {
          curr.removeAttribute('readonly');
        }
      });
    }

    // Add Academic button
    const btnAddAcademic = document.getElementById('btnAddAcademic');
    if (btnAddAcademic) {
      btnAddAcademic.addEventListener('click', () => addAcademicRow());
    }

    // Add Project button
    const btnAddProject = document.getElementById('btnAddProject');
    if (btnAddProject) {
      btnAddProject.addEventListener('click', () => addProjectRow());
    }

    // PDF Preview button
    const btnPreviewPdf = document.getElementById('btnPreviewPdf');
    if (btnPreviewPdf) {
      btnPreviewPdf.addEventListener('click', () => {
        if (!currentApp) return;
        window.open(`/api/onboarding/${currentApp.id}/pdf`, '_blank');
      });
    }

    // Final Confirm and Submit
    const btnConfirmSubmit = document.getElementById('btnConfirmSubmit');
    if (btnConfirmSubmit) {
      btnConfirmSubmit.addEventListener('click', handleFinalSubmit);
    }

    // Close preview modal
    const btnCloseDocPreview = document.getElementById('btnCloseDocPreview');
    if (btnCloseDocPreview) {
      btnCloseDocPreview.addEventListener('click', () => {
        docPreviewModal.style.display = 'none';
        document.getElementById('docPreviewContent').innerHTML = '';
      });
    }

    // Success Modal buttons
    const btnSuccessDownloadPdf = document.getElementById('btnSuccessDownloadPdf');
    if (btnSuccessDownloadPdf) {
      btnSuccessDownloadPdf.addEventListener('click', () => {
        if (currentApp) window.open(`/api/onboarding/${currentApp.id}/pdf`, '_blank');
      });
    }

    const btnSuccessGoToTracking = document.getElementById('btnSuccessGoToTracking');
    if (btnSuccessGoToTracking) {
      btnSuccessGoToTracking.addEventListener('click', () => {
        submitSuccessModal.style.display = 'none';
        showTrackingView();
      });
    }

    // Tracking view buttons
    const btnDownloadSubmittedPdf = document.getElementById('btnDownloadSubmittedPdf');
    if (btnDownloadSubmittedPdf) {
      btnDownloadSubmittedPdf.addEventListener('click', () => {
        if (currentApp) window.open(`/api/onboarding/${currentApp.id}/pdf`, '_blank');
      });
    }

    const btnTrackRefresh = document.getElementById('btnTrackRefresh');
    if (btnTrackRefresh) {
      btnTrackRefresh.addEventListener('click', () => {
        if (currentApp) loadApplication(currentApp.id, currentToken);
      });
    }

    const btnFixCorrectionsNow = document.getElementById('btnFixCorrectionsNow');
    if (btnFixCorrectionsNow) {
      btnFixCorrectionsNow.addEventListener('click', () => {
        showWizardView();
        goToStep(1);
      });
    }
  }

  // --- APPLICATION INITIALIZATION ---
  async function handleInitSubmit(e) {
    e.preventDefault();
    const email = document.getElementById('initEmail').value.trim();
    const name = document.getElementById('initName').value.trim();
    const position = document.getElementById('initPosition').value;

    const btn = document.getElementById('btnStartOnboarding');
    const origText = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = 'Connecting...';

    try {
      const res = await fetch('/api/onboarding/init', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, name, position })
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.message || 'Failed to initialize application.');

      currentApp = data.application;
      currentToken = data.token;
      sessionStorage.setItem('puvima_onboarding_token', currentToken);
      sessionStorage.setItem('puvima_onboarding_app_id', currentApp.id);

      // Populate initial values into form inputs
      populateFormsFromApplication(currentApp);

      if (['submitted', 'under_review', 'documents_under_verification', 'approved', 'rejected'].includes(currentApp.status)) {
        showTrackingView();
      } else {
        showWizardView();
        goToStep(1);
      }
    } catch (err) {
      alert('Error initializing onboarding: ' + err.message);
    } finally {
      btn.disabled = false;
      btn.innerHTML = origText;
    }
  }

  // --- LOAD EXISTING APPLICATION ---
  async function loadApplication(appId, token) {
    try {
      const headers = {};
      if (token) headers['x-onboarding-token'] = token;

      const res = await fetch(`/api/onboarding/${encodeURIComponent(appId)}`, { headers });
      const data = await res.json();
      if (!data.success) {
        // Fallback to public status tracking endpoint
        return trackApplicationPublic(appId);
      }

      currentApp = data.application;
      currentToken = currentApp.access_token || token;
      sessionStorage.setItem('puvima_onboarding_token', currentToken);
      sessionStorage.setItem('puvima_onboarding_app_id', currentApp.id);

      populateFormsFromApplication(currentApp);

      if (currentApp.status === 'correction_required') {
        isCorrectionMode = true;
        showCorrectionBanner(currentApp.correction_request);
        showWizardView();
        goToStep(1);
      } else if (['submitted', 'under_review', 'documents_under_verification', 'approved', 'rejected', 'resubmitted'].includes(currentApp.status)) {
        showTrackingView();
      } else {
        showWizardView();
        goToStep(1);
      }
    } catch (err) {
      console.warn('Error loading full application:', err.message);
      trackApplicationPublic(appId);
    }
  }

  async function handleTrackSearch(e) {
    e.preventDefault();
    const query = document.getElementById('searchTrackInput').value.trim();
    if (!query) return;

    try {
      const res = await fetch(`/api/onboarding/${encodeURIComponent(query)}/status`);
      const data = await res.json();
      if (!data.success) throw new Error(data.message || 'No application record found.');

      trackModal.style.display = 'none';
      currentApp = data.application;
      sessionStorage.setItem('puvima_onboarding_app_id', currentApp.id);
      renderTrackingDetails(data);
      showTrackingView();
    } catch (err) {
      alert('Track Error: ' + err.message);
    }
  }

  async function trackApplicationPublic(appId) {
    try {
      const res = await fetch(`/api/onboarding/${encodeURIComponent(appId)}/status`);
      const data = await res.json();
      if (data.success) {
        currentApp = data.application;
        renderTrackingDetails(data);
        showTrackingView();
      }
    } catch (e) {}
  }

  // --- POPULATE FORMS ---
  function populateFormsFromApplication(app) {
    if (!app) return;

    // Display ID
    if (stepperAppIdDisplay) stepperAppIdDisplay.textContent = `ID: ${app.id}`;
    if (document.getElementById('revAppId')) document.getElementById('revAppId').textContent = app.id;

    // Step 1: Position
    if (document.getElementById('pos_position')) document.getElementById('pos_position').value = app.position || '';
    if (document.getElementById('pos_domain')) document.getElementById('pos_domain').value = app.domain || '';
    if (document.getElementById('pos_joining_date')) document.getElementById('pos_joining_date').value = app.joining_date || '';
    if (document.getElementById('pos_duration')) document.getElementById('pos_duration').value = app.duration || '';

    // Step 2: Personal
    if (document.getElementById('pi_name')) document.getElementById('pi_name').value = app.name || '';
    if (document.getElementById('pi_dob')) document.getElementById('pi_dob').value = app.dob || '';
    if (document.getElementById('pi_gender')) document.getElementById('pi_gender').value = app.gender || '';
    if (document.getElementById('pi_nationality')) document.getElementById('pi_nationality').value = app.nationality || 'Indian';
    if (document.getElementById('pi_aadhaar')) document.getElementById('pi_aadhaar').value = app.aadhaar_masked || app.aadhaar || '';
    if (document.getElementById('pi_blood_group')) document.getElementById('pi_blood_group').value = app.blood_group || '';

    // Step 3: Contact
    if (document.getElementById('cnt_mobile')) document.getElementById('cnt_mobile').value = app.phone || '';
    if (document.getElementById('cnt_email')) document.getElementById('cnt_email').value = app.email || '';
    if (document.getElementById('cnt_permanent_address')) document.getElementById('cnt_permanent_address').value = app.permanent_address || '';
    if (document.getElementById('cnt_current_address')) document.getElementById('cnt_current_address').value = app.current_address || '';

    // Step 4: Academic
    const academicContainer = document.getElementById('academicContainer');
    if (academicContainer) {
      academicContainer.innerHTML = '';
      if (app.academic_details && app.academic_details.length > 0) {
        app.academic_details.forEach(item => addAcademicRow(item));
      } else {
        addAcademicRow({ qualification: 'UG' });
      }
    }

    // Step 5: Skills & Projects
    if (document.getElementById('sk_technical')) document.getElementById('sk_technical').value = app.technical_skills || '';
    if (document.getElementById('sk_tools')) document.getElementById('sk_tools').value = app.tools_platforms || '';
    const projectsContainer = document.getElementById('projectsContainer');
    if (projectsContainer) {
      projectsContainer.innerHTML = '';
      if (app.projects_experience && app.projects_experience.length > 0) {
        app.projects_experience.forEach(p => addProjectRow(p));
      } else {
        addProjectRow();
      }
    }

    // Step 6: Emergency
    const emg = app.emergency_contacts && app.emergency_contacts[0] ? app.emergency_contacts[0] : {};
    if (document.getElementById('emg_name')) document.getElementById('emg_name').value = emg.name || '';
    if (document.getElementById('emg_relationship')) document.getElementById('emg_relationship').value = emg.relationship || '';
    if (document.getElementById('emg_mobile')) document.getElementById('emg_mobile').value = emg.mobile || '';
    if (document.getElementById('emg_alternate')) document.getElementById('emg_alternate').value = emg.alternate_phone || '';

    // Step 7: Bank Details
    const bnk = app.bank_details || {};
    if (document.getElementById('bnk_holder')) document.getElementById('bnk_holder').value = bnk.account_holder_name || '';
    if (document.getElementById('bnk_name')) document.getElementById('bnk_name').value = bnk.bank_name || '';
    if (document.getElementById('bnk_account')) document.getElementById('bnk_account').value = bnk.account_number_masked || '';
    if (document.getElementById('bnk_account_confirm')) document.getElementById('bnk_account_confirm').value = bnk.account_number_masked || '';
    if (document.getElementById('bnk_ifsc')) document.getElementById('bnk_ifsc').value = bnk.ifsc_code || '';

    // Render document cards with existing uploads
    renderUploadDropzones();
  }

  // --- STEPPER VIEW CONTROLS ---
  function showWizardView() {
    viewInitial.style.display = 'none';
    viewTracking.style.display = 'none';
    viewWizard.style.display = 'block';
  }

  function showTrackingView() {
    viewInitial.style.display = 'none';
    viewWizard.style.display = 'none';
    viewTracking.style.display = 'block';
    if (currentApp) {
      renderTrackingDetails({ application: currentApp, timeline: currentApp.timeline, documents: currentApp.documents });
    }
  }

  function goToStep(stepNum) {
    if (stepNum < 1 || stepNum > 9) return;
    activeStep = stepNum;

    // Hide all step sections
    for (let i = 1; i <= 9; i++) {
      const sec = document.getElementById(`stepSection${i}`);
      if (sec) sec.style.display = (i === activeStep) ? 'block' : 'none';
    }

    // Update Stepper Badges
    stepperSteps.forEach(el => {
      const num = parseInt(el.getAttribute('data-step'), 10);
      el.classList.remove('active');
      if (num === activeStep) {
        el.classList.add('active');
      } else if (num < activeStep) {
        el.classList.add('completed');
      }
    });

    if (stepperIndicator) stepperIndicator.textContent = `Step ${activeStep} of 9`;
    
    const titles = [
      'Step 1 — Position Details',
      'Step 2 — Personal Information',
      'Step 3 — Contact & Address Details',
      'Step 4 — Academic Information',
      'Step 5 — Skills & Experience',
      'Step 6 — Emergency Contact',
      'Step 7 — Bank Account Details',
      'Step 8 — Document Upload',
      'Step 9 — Final Application Review'
    ];
    if (stepperStepTitle) stepperStepTitle.textContent = titles[activeStep - 1] || 'Onboarding Step';

    if (activeStep === 9) {
      populateReviewSheet();
    }

    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  // --- SAVE STEP & ADVANCE ---
  async function handleStepSaveAndAdvance(currentStepNum, nextStepNum) {
    if (!currentApp) return;

    const payload = gatherStepData(currentStepNum);
    if (!validateStep(currentStepNum, payload)) return;

    try {
      const res = await fetch(`/api/onboarding/${currentApp.id}/step/${currentStepNum}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'x-onboarding-token': currentToken || ''
        },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.message || 'Failed to save step.');

      // Update local state with returned application
      if (data.application) {
        currentApp = { ...currentApp, ...data.application };
      }

      goToStep(nextStepNum);
    } catch (err) {
      alert('Error saving step: ' + err.message);
    }
  }

  function gatherStepData(stepNum) {
    switch (stepNum) {
      case 1:
        return {
          position: document.getElementById('pos_position').value,
          domain: document.getElementById('pos_domain').value,
          joining_date: document.getElementById('pos_joining_date').value,
          duration: document.getElementById('pos_duration').value
        };
      case 2:
        return {
          name: document.getElementById('pi_name').value,
          dob: document.getElementById('pi_dob').value,
          gender: document.getElementById('pi_gender').value,
          nationality: document.getElementById('pi_nationality').value,
          aadhaar: document.getElementById('pi_aadhaar').value,
          blood_group: document.getElementById('pi_blood_group').value
        };
      case 3:
        return {
          phone: document.getElementById('cnt_mobile').value,
          email: document.getElementById('cnt_email').value,
          permanent_address: document.getElementById('cnt_permanent_address').value,
          current_address: document.getElementById('cnt_current_address').value
        };
      case 4: {
        const rows = document.querySelectorAll('#academicContainer .repeater-card');
        const qualifications = [];
        rows.forEach(r => {
          qualifications.push({
            qualification: r.querySelector('.ac-qual').value,
            degree_name: r.querySelector('.ac-degree').value,
            institution: r.querySelector('.ac-inst').value,
            year_of_passing: r.querySelector('.ac-year').value,
            cgpa_percentage: r.querySelector('.ac-score').value
          });
        });
        return { qualifications };
      }
      case 5: {
        const rows = document.querySelectorAll('#projectsContainer .repeater-card');
        const projects = [];
        rows.forEach(r => {
          projects.push({
            title: r.querySelector('.pj-title').value,
            organization: r.querySelector('.pj-org').value,
            duration: r.querySelector('.pj-dur').value,
            description: r.querySelector('.pj-desc').value
          });
        });
        return {
          technical_skills: document.getElementById('sk_technical').value,
          tools_platforms: document.getElementById('sk_tools').value,
          projects
        };
      }
      case 6:
        return {
          name: document.getElementById('emg_name').value,
          relationship: document.getElementById('emg_relationship').value,
          mobile: document.getElementById('emg_mobile').value,
          alternate_phone: document.getElementById('emg_alternate').value
        };
      case 7:
        return {
          account_holder_name: document.getElementById('bnk_holder').value,
          bank_name: document.getElementById('bnk_name').value,
          account_number: document.getElementById('bnk_account').value,
          ifsc_code: document.getElementById('bnk_ifsc').value
        };
      default:
        return {};
    }
  }

  function validateStep(stepNum, data) {
    if (stepNum === 1) {
      if (!data.position || !data.domain || !data.joining_date || !data.duration) {
        alert('Please fill all mandatory position details.');
        return false;
      }
    }
    if (stepNum === 2) {
      if (!data.name || !data.dob || !data.gender) {
        alert('Please fill mandatory personal details.');
        return false;
      }
    }
    if (stepNum === 3) {
      if (!data.phone || !data.permanent_address || !data.current_address) {
        alert('Please provide your active mobile number and addresses.');
        return false;
      }
    }
    if (stepNum === 7) {
      const p1 = document.getElementById('bnk_account').value;
      const p2 = document.getElementById('bnk_account_confirm').value;
      if (p1 && p2 && p1 !== p2 && !p1.includes('X')) {
        alert('Bank account numbers do not match.');
        return false;
      }
    }
    if (stepNum === 8) {
      // Check mandatory documents: resume, govt_id, academic_marks, photo
      const docs = currentApp.documents || [];
      const mandatoryCats = ['resume', 'govt_id', 'academic_marks', 'photo'];
      const missing = mandatoryCats.filter(cat => !docs.some(d => d.category === cat));
      if (missing.length > 0) {
        const missingLabels = missing.map(m => DOC_CATEGORIES.find(c => c.key === m)?.title || m);
        alert('Please upload the following required documents before proceeding:\n• ' + missingLabels.join('\n• '));
        return false;
      }
    }
    return true;
  }

  // --- DYNAMIC REPEATERS ---
  function addAcademicRow(data = {}) {
    const container = document.getElementById('academicContainer');
    const idx = container.children.length + 1;
    const card = document.createElement('div');
    card.className = 'repeater-card';
    card.innerHTML = `
      <div class="repeater-card-header">
        <span class="repeater-title">Qualification #${idx}</span>
        ${idx > 1 ? '<button type="button" class="btn-remove-row remove-ac">&times; Remove</button>' : ''}
      </div>
      <div class="form-grid">
        <div class="form-group col-3">
          <label class="form-label">Level <span class="required">*</span></label>
          <select class="form-control ac-qual" required>
            <option value="UG" ${data.qualification === 'UG' ? 'selected' : ''}>UG (Bachelor's)</option>
            <option value="PG" ${data.qualification === 'PG' ? 'selected' : ''}>PG (Master's)</option>
            <option value="Diploma" ${data.qualification === 'Diploma' ? 'selected' : ''}>Diploma</option>
            <option value="Higher Secondary" ${data.qualification === 'Higher Secondary' ? 'selected' : ''}>12th / HSC</option>
            <option value="Others" ${data.qualification === 'Others' ? 'selected' : ''}>Others</option>
          </select>
        </div>
        <div class="form-group col-4">
          <label class="form-label">Degree / Course Name <span class="required">*</span></label>
          <input type="text" class="form-control ac-degree" placeholder="e.g. B.Tech Computer Science" value="${data.degree_name || ''}" required>
        </div>
        <div class="form-group col-5">
          <label class="form-label">Institution / University <span class="required">*</span></label>
          <input type="text" class="form-control ac-inst" placeholder="College or University Name" value="${data.institution || ''}" required>
        </div>
        <div class="form-group col-4">
          <label class="form-label">Year of Passing <span class="required">*</span></label>
          <input type="number" class="form-control ac-year" placeholder="e.g. 2026" min="1990" max="2035" value="${data.year_of_passing || ''}" required>
        </div>
        <div class="form-group col-4">
          <label class="form-label">CGPA / Percentage <span class="required">*</span></label>
          <input type="text" class="form-control ac-score" placeholder="e.g. 8.65 or 85%" value="${data.cgpa_percentage || ''}" required>
        </div>
      </div>
    `;

    const removeBtn = card.querySelector('.remove-ac');
    if (removeBtn) {
      removeBtn.addEventListener('click', () => card.remove());
    }
    container.appendChild(card);
  }

  function addProjectRow(data = {}) {
    const container = document.getElementById('projectsContainer');
    const idx = container.children.length + 1;
    const card = document.createElement('div');
    card.className = 'repeater-card';
    card.innerHTML = `
      <div class="repeater-card-header">
        <span class="repeater-title">Project / Experience #${idx}</span>
        ${idx > 1 ? '<button type="button" class="btn-remove-row remove-pj">&times; Remove</button>' : ''}
      </div>
      <div class="form-grid">
        <div class="form-group col-6">
          <label class="form-label">Project Title / Role Name <span class="required">*</span></label>
          <input type="text" class="form-control pj-title" placeholder="e.g. Autonomous Robotic Arm" value="${data.title || ''}" required>
        </div>
        <div class="form-group col-6">
          <label class="form-label">Organization / Academic Project</label>
          <input type="text" class="form-control pj-org" placeholder="e.g. PUVIMA Lab / College Project" value="${data.organization || ''}">
        </div>
        <div class="form-group col-4">
          <label class="form-label">Duration</label>
          <input type="text" class="form-control pj-dur" placeholder="e.g. 6 Months / Jan-Jun 2026" value="${data.duration || ''}">
        </div>
        <div class="form-group col-8">
          <label class="form-label">Description / Achievements</label>
          <input type="text" class="form-control pj-desc" placeholder="Brief overview of tools and deliverables" value="${data.description || ''}">
        </div>
      </div>
    `;

    const removeBtn = card.querySelector('.remove-pj');
    if (removeBtn) {
      removeBtn.addEventListener('click', () => card.remove());
    }
    container.appendChild(card);
  }

  // --- DOCUMENT UPLOAD DROPZONES ---
  function renderUploadDropzones() {
    const container = document.getElementById('uploadDropzonesContainer');
    if (!container) return;

    container.innerHTML = '';
    const uploadedDocs = (currentApp && currentApp.documents) ? currentApp.documents : [];

    DOC_CATEGORIES.forEach(cat => {
      const existingDoc = uploadedDocs.find(d => d.category === cat.key);
      const card = document.createElement('div');
      card.className = 'upload-card';
      card.id = `card_upload_${cat.key}`;

      let badgeHtml = '<span class="upload-status-badge status-badge-pending">Pending</span>';
      if (existingDoc) {
        if (existingDoc.verification_status === 'verified') {
          badgeHtml = '<span class="upload-status-badge status-badge-verified">Verified</span>';
        } else if (existingDoc.verification_status === 'correction_required') {
          badgeHtml = '<span class="upload-status-badge status-badge-correction">Correction Req.</span>';
        } else {
          badgeHtml = '<span class="upload-status-badge status-badge-uploaded">Uploaded</span>';
        }
      }

      card.innerHTML = `
        <div class="upload-header">
          <div>
            <div class="upload-category-title">
              ${cat.title} ${cat.mandatory ? '<span class="required" style="color: var(--status-correction);">*</span>' : ''}
            </div>
            <div class="upload-category-desc">${cat.desc}</div>
          </div>
          ${badgeHtml}
        </div>

        ${existingDoc ? `
          <div class="file-info-bar">
            <div class="file-name-meta" title="${existingDoc.original_name}">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path></svg>
              <span>${existingDoc.original_name}</span>
            </div>
            <div class="file-actions">
              <button type="button" class="btn btn-secondary btn-sm btn-doc-preview" data-doc-id="${existingDoc.id}" data-doc-name="${existingDoc.original_name}">Preview</button>
              <button type="button" class="btn-remove-row btn-doc-delete" data-doc-id="${existingDoc.id}">&times; Remove</button>
            </div>
          </div>
        ` : `
          <div class="dropzone" id="dropzone_${cat.key}">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="17 8 12 3 7 8"></polyline><line x1="12" y1="3" x2="12" y2="15"></line></svg>
            <p><strong>Click to browse</strong> or drag &amp; drop file here</p>
            <small>PDF, JPG, JPEG, PNG (Max 10MB)</small>
            <input type="file" id="file_input_${cat.key}" accept=".pdf,.jpg,.jpeg,.png" style="display: none;">
          </div>
          <div class="upload-progress-container" id="prog_cont_${cat.key}">
            <div class="upload-progress-bar" id="prog_bar_${cat.key}"></div>
          </div>
        `}
      `;

      // Attach file listeners
      if (!existingDoc) {
        const dropzone = card.querySelector(`#dropzone_${cat.key}`);
        const fileInput = card.querySelector(`#file_input_${cat.key}`);

        dropzone.addEventListener('click', () => fileInput.click());
        fileInput.addEventListener('change', (e) => {
          if (e.target.files && e.target.files[0]) {
            uploadFile(cat.key, e.target.files[0]);
          }
        });

        dropzone.addEventListener('dragover', (e) => {
          e.preventDefault();
          dropzone.classList.add('dragover');
        });
        dropzone.addEventListener('dragleave', () => dropzone.classList.remove('dragover'));
        dropzone.addEventListener('drop', (e) => {
          e.preventDefault();
          dropzone.classList.remove('dragover');
          if (e.dataTransfer.files && e.dataTransfer.files[0]) {
            uploadFile(cat.key, e.dataTransfer.files[0]);
          }
        });
      } else {
        const previewBtn = card.querySelector('.btn-doc-preview');
        if (previewBtn) {
          previewBtn.addEventListener('click', () => {
            previewDocument(existingDoc.id, existingDoc.original_name);
          });
        }
        const deleteBtn = card.querySelector('.btn-doc-delete');
        if (deleteBtn) {
          deleteBtn.addEventListener('click', () => {
            deleteDocument(existingDoc.id);
          });
        }
      }

      container.appendChild(card);
    });
  }

  // --- UPLOAD FILE IMPLEMENTATION ---
  function uploadFile(category, file) {
    if (!currentApp) {
      alert('Please start or resume an application first.');
      return;
    }

    const progCont = document.getElementById(`prog_cont_${category}`);
    const progBar = document.getElementById(`prog_bar_${category}`);
    if (progCont) progCont.style.display = 'block';

    const formData = new FormData();
    formData.append('file', file);
    formData.append('category', category);

    const xhr = new XMLHttpRequest();
    xhr.open('POST', `/api/onboarding/${currentApp.id}/document`);
    if (currentToken) {
      xhr.setRequestHeader('x-onboarding-token', currentToken);
    }

    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable && progBar) {
        const percent = Math.round((e.loaded / e.total) * 100);
        progBar.style.width = percent + '%';
      }
    };

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          const res = JSON.parse(xhr.responseText);
          if (res.success) {
            // Update documents list in local application
            if (!currentApp.documents) currentApp.documents = [];
            currentApp.documents = currentApp.documents.filter(d => d.category !== category);
            currentApp.documents.push(res.document);
            renderUploadDropzones();
          } else {
            alert('Upload failed: ' + res.message);
          }
        } catch (e) {
          alert('Upload failed parsing response.');
        }
      } else {
        alert('Upload failed with status ' + xhr.status);
      }
      if (progCont) progCont.style.display = 'none';
    };

    xhr.onerror = () => {
      alert('Network error during file upload.');
      if (progCont) progCont.style.display = 'none';
    };

    xhr.send(formData);
  }

  async function deleteDocument(docId) {
    if (!confirm('Are you sure you want to remove this uploaded document?')) return;
    try {
      const res = await fetch(`/api/onboarding/${currentApp.id}/document/${docId}`, {
        method: 'DELETE',
        headers: { 'x-onboarding-token': currentToken || '' }
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.message || 'Delete failed.');

      currentApp.documents = currentApp.documents.filter(d => d.id !== docId);
      renderUploadDropzones();
    } catch (err) {
      alert('Error removing document: ' + err.message);
    }
  }

  function previewDocument(docId, docName) {
    const url = `/api/onboarding/${currentApp.id}/document/${docId}`;
    const modal = document.getElementById('docPreviewModal');
    const title = document.getElementById('docPreviewTitle');
    const content = document.getElementById('docPreviewContent');

    title.textContent = `Preview: ${docName}`;
    const ext = docName.split('.').pop().toLowerCase();

    if (['jpg', 'jpeg', 'png'].includes(ext)) {
      content.innerHTML = `<img src="${url}" style="max-width: 100%; max-height: 100%; object-fit: contain;">`;
    } else {
      content.innerHTML = `<iframe src="${url}" style="width: 100%; height: 100%; border: none;"></iframe>`;
    }
    modal.style.display = 'flex';
  }

  // --- REVIEW SHEET POPULATION ---
  function populateReviewSheet() {
    if (!currentApp) return;

    document.getElementById('revAppId').textContent = currentApp.id;
    document.getElementById('revAppDate').textContent = 'Date: ' + new Date().toISOString().split('T')[0];

    // Position
    document.getElementById('revPosTitle').textContent = document.getElementById('pos_position').value || '-';
    document.getElementById('revPosDomain').textContent = document.getElementById('pos_domain').value || '-';
    document.getElementById('revPosJoin').textContent = document.getElementById('pos_joining_date').value || '-';
    document.getElementById('revPosDuration').textContent = document.getElementById('pos_duration').value || '-';

    // Personal
    document.getElementById('revPiName').textContent = document.getElementById('pi_name').value || '-';
    document.getElementById('revPiDob').textContent = document.getElementById('pi_dob').value || '-';
    document.getElementById('revPiGender').textContent = document.getElementById('pi_gender').value || '-';
    document.getElementById('revPiNationality').textContent = document.getElementById('pi_nationality').value || 'Indian';
    const rawAadhaar = document.getElementById('pi_aadhaar').value;
    document.getElementById('revPiAadhaar').textContent = rawAadhaar ? (rawAadhaar.length > 4 ? `XXXX-XXXX-${rawAadhaar.slice(-4)}` : rawAadhaar) : '-';
    document.getElementById('revPiBlood').textContent = document.getElementById('pi_blood_group').value || '-';

    // Contact
    document.getElementById('revCntMobile').textContent = document.getElementById('cnt_mobile').value || '-';
    document.getElementById('revCntEmail').textContent = document.getElementById('cnt_email').value || '-';
    document.getElementById('revCntPerm').textContent = document.getElementById('cnt_permanent_address').value || '-';
    document.getElementById('revCntCurr').textContent = document.getElementById('cnt_current_address').value || '-';

    // Academic
    const acBody = document.getElementById('revAcademicBody');
    const acRows = document.querySelectorAll('#academicContainer .repeater-card');
    if (acRows.length > 0) {
      acBody.innerHTML = '';
      acRows.forEach(r => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
          <td>${r.querySelector('.ac-qual').value}</td>
          <td>${r.querySelector('.ac-degree').value}</td>
          <td>${r.querySelector('.ac-inst').value}</td>
          <td>${r.querySelector('.ac-year').value}</td>
          <td><strong>${r.querySelector('.ac-score').value}</strong></td>
        `;
        acBody.appendChild(tr);
      });
    }

    // Skills & Experience
    document.getElementById('revSkills').textContent = document.getElementById('sk_technical').value || '-';
    document.getElementById('revTools').textContent = document.getElementById('sk_tools').value || '-';
    const pjCont = document.getElementById('revProjectsContainer');
    const pjRows = document.querySelectorAll('#projectsContainer .repeater-card');
    pjCont.innerHTML = '';
    pjRows.forEach(r => {
      const title = r.querySelector('.pj-title').value;
      if (title) {
        const div = document.createElement('div');
        div.style.marginBottom = '6px';
        div.innerHTML = `<strong>• ${title}</strong> (${r.querySelector('.pj-org').value || 'Academic'}) — <em>${r.querySelector('.pj-desc').value || ''}</em>`;
        pjCont.appendChild(div);
      }
    });

    // Emergency
    document.getElementById('revEmgName').textContent = document.getElementById('emg_name').value || '-';
    document.getElementById('revEmgRel').textContent = document.getElementById('emg_relationship').value || '-';
    document.getElementById('revEmgMobile').textContent = document.getElementById('emg_mobile').value || '-';
    document.getElementById('revEmgAlt').textContent = document.getElementById('emg_alternate').value || '-';

    // Bank
    document.getElementById('revBnkHolder').textContent = document.getElementById('bnk_holder').value || '-';
    document.getElementById('revBnkName').textContent = document.getElementById('bnk_name').value || '-';
    const bAcc = document.getElementById('bnk_account').value;
    document.getElementById('revBnkAcc').textContent = bAcc ? `XXXX-XXXX-${bAcc.slice(-4)}` : '-';
    document.getElementById('revBnkIfsc').textContent = document.getElementById('bnk_ifsc').value || '-';

    // Documents
    const docsBody = document.getElementById('revDocsBody');
    const docs = currentApp.documents || [];
    if (docs.length > 0) {
      docsBody.innerHTML = '';
      docs.forEach(d => {
        const catObj = DOC_CATEGORIES.find(c => c.key === d.category);
        const tr = document.createElement('tr');
        tr.innerHTML = `
          <td><strong>${catObj ? catObj.title : d.category}</strong></td>
          <td>${d.original_name}</td>
          <td>${new Date(d.uploaded_at).toLocaleString()}</td>
          <td><span class="upload-status-badge status-badge-uploaded">${d.verification_status || 'Uploaded'}</span></td>
        `;
        docsBody.appendChild(tr);
      });
    }
  }

  // --- FINAL SUBMISSION ---
  async function handleFinalSubmit() {
    const c1 = document.getElementById('chkDecl1').checked;
    const c2 = document.getElementById('chkDecl2').checked;
    const c3 = document.getElementById('chkDecl3').checked;

    if (!c1 || !c2 || !c3) {
      alert('Please check and confirm all three declaration statements before submitting.');
      return;
    }

    const btn = document.getElementById('btnConfirmSubmit');
    const origText = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = 'Submitting & Generating Application...';

    try {
      const endpoint = isCorrectionMode ? `/api/onboarding/${currentApp.id}/resubmit` : `/api/onboarding/${currentApp.id}/submit`;
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-onboarding-token': currentToken || ''
        },
        body: JSON.stringify({
          signature: document.getElementById('pi_name').value,
          notes: isCorrectionMode ? 'Corrections addressed by applicant.' : ''
        })
      });

      const data = await res.json();
      if (!data.success) throw new Error(data.message || 'Submission failed.');

      currentApp = data.application;
      document.getElementById('successModalAppId').textContent = currentApp.id;
      submitSuccessModal.style.display = 'flex';
    } catch (err) {
      alert('Submission Error: ' + err.message);
    } finally {
      btn.disabled = false;
      btn.innerHTML = origText;
    }
  }

  // --- TRACKING DETAILS RENDERING ---
  function renderTrackingDetails(data) {
    const app = data.application;
    if (!app) return;

    document.getElementById('trackApplicantName').textContent = app.name || 'Applicant';
    document.getElementById('trackAppIdDisplay').textContent = app.id;

    // Status Badge
    const badge = document.getElementById('trackStatusBadge');
    badge.textContent = (app.status || 'SUBMITTED').replace(/_/g, ' ').toUpperCase();

    if (app.status === 'approved') {
      badge.style.background = 'var(--status-approved-bg)';
      badge.style.color = 'var(--status-approved)';
    } else if (app.status === 'correction_required') {
      badge.style.background = 'var(--status-correction-bg)';
      badge.style.color = 'var(--status-correction)';
    } else {
      badge.style.background = 'var(--status-pending-bg)';
      badge.style.color = 'var(--secondary)';
    }

    document.getElementById('trackPosTitle').textContent = app.position || '-';
    document.getElementById('trackPosDomain').textContent = app.domain || '-';
    document.getElementById('trackSubmittedAt').textContent = app.submitted_at ? new Date(app.submitted_at).toLocaleString() : 'Draft';
    document.getElementById('trackOverallStatus').textContent = (app.status || 'Submitted').toUpperCase();

    // Check correction alert
    const corrAlert = document.getElementById('trackCorrectionAlert');
    if (app.status === 'correction_required') {
      corrAlert.style.display = 'flex';
      const corr = data.correction_request || app.correction_request || {};
      document.getElementById('trackCorrectionMessage').textContent = corr.remarks || 'Please update the requested information.';
      const fList = document.getElementById('trackCorrectionFieldsList');
      if (corr.fields && corr.fields.length > 0) {
        fList.innerHTML = '<strong>Requested items:</strong> ' + corr.fields.join(', ');
      } else {
        fList.innerHTML = '';
      }
    } else {
      corrAlert.style.display = 'none';
    }

    // Documents status table
    const docTbody = document.getElementById('trackDocumentsStatusBody');
    docTbody.innerHTML = '';
    const docs = data.documents || app.documents || [];
    if (docs.length === 0) {
      docTbody.innerHTML = '<tr><td colspan="3" style="text-align: center; color: var(--text-muted);">No documents recorded</td></tr>';
    } else {
      docs.forEach(d => {
        const tr = document.createElement('tr');
        const catObj = DOC_CATEGORIES.find(c => c.key === d.category);
        const stat = d.verification_status || 'Pending';
        let badgeCls = 'status-badge-pending';
        if (stat === 'verified') badgeCls = 'status-badge-verified';
        if (stat === 'correction_required' || stat === 'invalid') badgeCls = 'status-badge-correction';

        tr.innerHTML = `
          <td><strong>${catObj ? catObj.title : d.category}</strong> (${d.original_name})</td>
          <td><span class="upload-status-badge ${badgeCls}">${stat}</span></td>
          <td style="color: ${d.remarks ? 'var(--status-correction)' : 'var(--text-muted)'};">${d.remarks || 'No remarks recorded'}</td>
        `;
        docTbody.appendChild(tr);
      });
    }

    // Timeline Rendering
    updateTimeline(app);
  }

  function updateTimeline(app) {
    const s = app.status;
    const tCreated = document.getElementById('tlItemCreated');
    const tSub = document.getElementById('tlItemSubmitted');
    const tReview = document.getElementById('tlItemHrReview');
    const tVerify = document.getElementById('tlItemDocVerify');
    const tDec = document.getElementById('tlItemFinalDecision');

    document.getElementById('tlDateCreated').textContent = app.created_at ? new Date(app.created_at).toLocaleDateString() : 'Recorded';

    if (app.submitted_at) {
      tSub.classList.add('completed');
      document.getElementById('tlDateSubmitted').textContent = new Date(app.submitted_at).toLocaleDateString();
    }

    if (['under_review', 'documents_under_verification', 'correction_required', 'resubmitted', 'approved', 'rejected'].includes(s)) {
      tReview.classList.add('completed');
      document.getElementById('tlDateHrReview').textContent = 'In Progress / Completed';
    }

    if (['documents_under_verification', 'approved', 'rejected'].includes(s)) {
      tVerify.classList.add('completed');
      document.getElementById('tlDateDocVerify').textContent = 'Verified by HR';
    }

    if (s === 'approved') {
      tDec.classList.add('completed');
      document.getElementById('tlDateFinalDecision').textContent = 'APPROVED';
    } else if (s === 'rejected') {
      tDec.classList.add('completed');
      document.getElementById('tlDateFinalDecision').textContent = 'REJECTED';
    }
  }

  function showCorrectionBanner(corr) {
    const banner = document.getElementById('correctionAlertBanner');
    if (!banner || !corr) return;

    banner.style.display = 'flex';
    document.getElementById('correctionBannerRemarks').textContent = corr.remarks || 'HR has requested corrections on your application.';
    const fieldsDiv = document.getElementById('correctionBannerFields');
    if (corr.fields && corr.fields.length > 0) {
      fieldsDiv.textContent = 'Fields needing attention: ' + corr.fields.join(', ');
    }
  }

})();

