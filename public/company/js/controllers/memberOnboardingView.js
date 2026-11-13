/**
 * Puvima IT Service and Research Consultancy — Embedded Member Onboarding Module
 * Allows Employees and Interns to complete their full 8-step onboarding profile,
 * upload verification documents, and track HR verification status directly inside
 * their portal workspace without navigating away to another page.
 */

(function () {
  'use strict';

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
  let activeUser = null;
  let hostContainer = null;

  window.MemberOnboarding = {
    // 1. Check status and render top banner
    async checkAndRenderBanner(currentUser, bannerEl, badgeEl, onSwitchToTab) {
      activeUser = currentUser;
      if (!currentUser || !currentUser.email) return;

      try {
        const res = await fetch(`/api/onboarding/${encodeURIComponent(currentUser.email)}/status`);
        if (res.ok) {
          const data = await res.json();
          if (data.success && data.status) {
            currentApp = data.application || data;
            currentToken = data.token || (currentApp && currentApp.access_token);
          }
        }
      } catch (e) {
        console.warn('[MemberOnboarding] Status check error:', e.message);
      }

      // If user has not initialized or given details yet, initialize draft application record now
      if (!currentApp || !currentApp.id) {
        await this.ensureWorkerApplication(currentUser);
      }

      this.renderBanner(bannerEl, badgeEl, onSwitchToTab);
    },

    getApplication() {
      return currentApp;
    },

    isSubmitted() {
      if (!currentApp || !currentApp.status) return false;
      const s = String(currentApp.status).trim().toLowerCase();
      return ['submitted', 'under hr review', 'documents under verification', 'approved', 'resubmitted'].includes(s);
    },

    // 2. Render Banner
    renderBanner(bannerEl, badgeEl, onSwitchToTab) {
      if (!bannerEl) return;

      const app = currentApp;
      const status = app ? String(app.status || 'Draft').trim() : null;

      // SCENARIO 1: Not started or Draft
      if (!app || !status || status.toLowerCase() === 'draft') {
        if (badgeEl) {
          badgeEl.textContent = 'Action Required';
          badgeEl.className = 'badge badge-warning';
          badgeEl.style.display = 'inline-block';
          badgeEl.style.background = '#FEF3C7';
          badgeEl.style.color = '#B45309';
        }

        bannerEl.innerHTML = `
          <div class="card" style="border: 2px solid #D97706; background: linear-gradient(135deg, #FFFBEB 0%, #FEF3C7 100%); margin-bottom: 24px; padding: 20px; border-radius: 10px; box-shadow: 0 4px 6px -1px rgba(217, 119, 6, 0.15);">
            <div style="display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; flex-wrap: wrap;">
              <div style="display: flex; gap: 14px; align-items: flex-start; flex: 1; min-width: 280px;">
                <div style="width: 44px; height: 44px; border-radius: 8px; background: #D97706; color: #FFFFFF; display: flex; align-items: center; justify-content: center; flex-shrink: 0; box-shadow: 0 2px 4px rgba(217,119,6,0.3);">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>
                </div>
                <div>
                  <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 4px;">
                    <h3 style="font-size: 1.05rem; font-weight: 800; color: #92400E; margin: 0;">
                      Action Required: Complete Your Official Onboarding Profile
                    </h3>
                    <span style="background: #DC2626; color: #FFFFFF; font-size: 10px; font-weight: 700; padding: 2px 8px; border-radius: 9999px; text-transform: uppercase;">Pending</span>
                  </div>
                  <p style="font-size: 0.85rem; color: #78350F; margin: 0; line-height: 1.5;">
                    ${!app ? 'You have not submitted your onboarding profile yet.' : 'Your onboarding draft is started but incomplete.'} Please provide your official identification, academic qualifications, bank details for stipend/payroll, and mandatory verification documents.
                  </p>
                </div>
              </div>
              <div style="display: flex; gap: 10px; align-items: center;">
                <button type="button" class="btn btn-primary btn-start-onboarding-inline" style="background: #001D35; border-color: #001D35; color: #FFFFFF; font-size: 13px; font-weight: 700; padding: 10px 18px; white-space: nowrap; box-shadow: 0 2px 4px rgba(0,29,53,0.2); cursor: pointer;">
                  ${!app ? 'Complete Onboarding Details &rarr;' : 'Resume & Complete Draft &rarr;'}
                </button>
              </div>
            </div>
          </div>
        `;

        const btn = bannerEl.querySelector('.btn-start-onboarding-inline');
        if (btn && onSwitchToTab) {
          btn.addEventListener('click', () => onSwitchToTab('onboarding'));
        }
        return;
      }

      // SCENARIO 2: Correction Required
      if (status.toLowerCase() === 'correction required') {
        if (badgeEl) {
          badgeEl.textContent = 'Correction Req.';
          badgeEl.className = 'badge badge-danger';
          badgeEl.style.display = 'inline-block';
          badgeEl.style.background = '#FEE2E2';
          badgeEl.style.color = '#DC2626';
        }

        const remarks = app.correction_request ? app.correction_request.remarks : 'Please update the requested details.';
        bannerEl.innerHTML = `
          <div class="card" style="border: 2px solid #DC2626; background: #FEF2F2; margin-bottom: 24px; padding: 20px; border-radius: 10px;">
            <div style="display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; flex-wrap: wrap;">
              <div style="display: flex; gap: 14px; align-items: flex-start; flex: 1;">
                <div style="width: 44px; height: 44px; border-radius: 8px; background: #DC2626; color: #FFFFFF; display: flex; align-items: center; justify-content: center; flex-shrink: 0;">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>
                </div>
                <div>
                  <h3 style="font-size: 1.05rem; font-weight: 800; color: #991B1B; margin-bottom: 4px;">
                    Attention Required: HR Requested Corrections
                  </h3>
                  <p style="font-size: 0.85rem; color: #7F1D1D; margin-bottom: 6px;">
                    <strong>HR Remarks:</strong> ${window.UI.escapeHtml(remarks)}
                  </p>
                  <div style="font-size: 0.8rem; color: #991B1B;">
                    Application ID: <strong>${app.application_id || app.id}</strong>
                  </div>
                </div>
              </div>
              <div style="display: flex; gap: 10px; align-items: center;">
                <button type="button" class="btn btn-primary btn-start-onboarding-inline" style="background: #DC2626; border-color: #DC2626; color: #FFFFFF; font-size: 13px; font-weight: 700; padding: 10px 18px; white-space: nowrap; cursor: pointer;">
                  Fix Corrections &amp; Resubmit &rarr;
                </button>
              </div>
            </div>
          </div>
        `;

        const btn = bannerEl.querySelector('.btn-start-onboarding-inline');
        if (btn && onSwitchToTab) {
          btn.addEventListener('click', () => onSwitchToTab('onboarding'));
        }
        return;
      }

      // SCENARIO 3: Submitted / Under HR Review
      if (['submitted', 'under hr review', 'documents under verification', 'resubmitted'].includes(status.toLowerCase())) {
        if (badgeEl) {
          badgeEl.textContent = 'Under Review';
          badgeEl.className = 'badge badge-info';
          badgeEl.style.display = 'inline-block';
          badgeEl.style.background = '#E0F2FE';
          badgeEl.style.color = '#0284C7';
        }

        bannerEl.innerHTML = `
          <div class="card" style="border: 1px solid #BAE6FD; background: #F0F9FF; margin-bottom: 24px; padding: 18px; border-radius: 10px;">
            <div style="display: flex; align-items: center; justify-content: space-between; gap: 16px; flex-wrap: wrap;">
              <div style="display: flex; gap: 14px; align-items: center;">
                <div style="width: 40px; height: 40px; border-radius: 8px; background: #0284C7; color: #FFFFFF; display: flex; align-items: center; justify-content: center; flex-shrink: 0;">
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 14 14"></polyline></svg>
                </div>
                <div>
                  <h4 style="font-size: 0.95rem; font-weight: 700; color: #0369A1; margin-bottom: 2px;">
                    Onboarding Status: Under HR Verification (${app.application_id || app.id})
                  </h4>
                  <p style="font-size: 0.82rem; color: #075985; margin: 0;">
                    Your application has been received and is being verified by HR. You can view your record below.
                  </p>
                </div>
              </div>
              <div style="display: flex; gap: 10px;">
                <button type="button" class="btn btn-secondary btn-sm btn-view-onb-tab" style="font-size: 12px; cursor: pointer;">View Verification Details</button>
                <a href="/api/onboarding/${encodeURIComponent(app.application_id || app.id)}/pdf" target="_blank" class="btn btn-outline-primary btn-sm" style="font-size: 12px;">Download Form (PDF)</a>
              </div>
            </div>
          </div>
        `;

        const btn = bannerEl.querySelector('.btn-view-onb-tab');
        if (btn && onSwitchToTab) {
          btn.addEventListener('click', () => onSwitchToTab('onboarding'));
        }
        return;
      }

      // SCENARIO 4: Approved
      if (status.toLowerCase() === 'approved') {
        if (badgeEl) {
          badgeEl.textContent = 'Verified';
          badgeEl.className = 'badge badge-success';
          badgeEl.style.display = 'inline-block';
          badgeEl.style.background = '#DCFCE7';
          badgeEl.style.color = '#16A34A';
        }

        bannerEl.innerHTML = `
          <div class="card" style="border: 1px solid #BBF7D0; background: #F0FDF4; margin-bottom: 24px; padding: 14px 18px; border-radius: 8px;">
            <div style="display: flex; align-items: center; justify-content: space-between; gap: 12px; flex-wrap: wrap;">
              <div style="display: flex; align-items: center; gap: 10px;">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#16A34A" stroke-width="2.5"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>
                <span style="font-size: 0.88rem; font-weight: 600; color: #166534;">
                  Onboarding Verified &amp; Cleared (Record: <strong>${app.application_id || app.id}</strong>)
                </span>
              </div>
              <div>
                <a href="/api/onboarding/${encodeURIComponent(app.application_id || app.id)}/pdf" target="_blank" class="btn btn-secondary btn-sm" style="font-size: 12px; padding: 4px 10px;">
                  Download Official PDF
                </a>
              </div>
            </div>
          </div>
        `;
      }
    },

    // 3. Render Main Onboarding Tab Content
    async renderWorkspaceTab(container, currentUser) {
      activeUser = currentUser;
      hostContainer = container;
      if (!container) return;

      container.innerHTML = `
        <div style="padding: 40px; text-align: center; color: #64748B;">
          <div class="spinner-sm" style="margin: 0 auto 12px;"></div>
          Loading your onboarding profile...
        </div>
      `;

      // Ensure application is initialized for this worker
      if (!currentApp || !currentApp.id) {
        await this.ensureWorkerApplication(currentUser);
      }

      // Check status to decide whether to render the Wizard or the Status Dashboard
      const status = currentApp ? String(currentApp.status || 'Draft').trim() : 'Draft';

      if (['submitted', 'under hr review', 'documents under verification', 'approved', 'rejected', 'resubmitted'].includes(status.toLowerCase())) {
        this.renderStatusDashboardView(container);
      } else {
        // Draft or Correction Required
        if (status.toLowerCase() === 'correction required') {
          isCorrectionMode = true;
        }
        this.renderWizardView(container);
      }
    },

    // 4. Ensure Application Exists (Auto-initialize silently)
    async processWorkerInit(currentUser) {
      try {
        const res = await fetch('/api/onboarding/init', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: currentUser.email,
            name: currentUser.name || 'Member',
            position: currentUser.role || 'Intern'
          })
        });
        const data = await res.json();
        if (data.success && data.application) {
          currentApp = data.application;
          currentToken = data.token || currentApp.access_token;
          sessionStorage.setItem('puvima_onboarding_token', currentToken);
          sessionStorage.setItem('puvima_onboarding_app_id', currentApp.id);
        }
      } catch (e) {
        console.warn('[MemberOnboarding] Worker auto-init note:', e.message);
      }
    },

    async ensureWorkerApplication(currentUser) {
      try {
        const res = await fetch(`/api/onboarding/${encodeURIComponent(currentUser.email)}/status`);
        if (res.ok) {
          const data = await res.json();
          if (data.success && data.application) {
            currentApp = data.application;
            currentToken = data.token || currentApp.access_token;
            return;
          }
        }
      } catch (e) {}

      await this.processWorkerInit(currentUser);
    },

    // 5. Render Full In-Page Wizard View
    renderWizardView(container) {
      container.innerHTML = `
        <div class="embedded-onboarding-wizard">
          
          <!-- Stepper Card -->
          <div class="stepper-card" style="margin-bottom: 24px;">
            <div class="stepper-header">
              <span class="stepper-title" id="embStepTitle">Step 1 — Position Details</span>
              <div style="display: flex; align-items: center; gap: 12px;">
                <span style="font-family: monospace; font-size: 0.82rem; color: #64748B;" id="embAppIdDisplay">ID: ${currentApp ? (currentApp.application_id || currentApp.id) : 'PV-ONB-...'}</span>
                <span class="stepper-count" id="embStepIndicator">Step 1 of 9</span>
              </div>
            </div>
            
            <nav class="stepper-track internship-stepper" aria-label="Onboarding Application Steps">
              <button type="button" class="stepper-step stepper-item active" data-emb-step="1">
                <span class="step-indicator">1</span>
                <div class="step-label-group">
                  <span class="step-number-text">STEP 01</span>
                  <span class="step-name-text">Position Details</span>
                </div>
              </button>
              <button type="button" class="stepper-step stepper-item" data-emb-step="2">
                <span class="step-indicator">2</span>
                <div class="step-label-group">
                  <span class="step-number-text">STEP 02</span>
                  <span class="step-name-text">Personal Info</span>
                </div>
              </button>
              <button type="button" class="stepper-step stepper-item" data-emb-step="3">
                <span class="step-indicator">3</span>
                <div class="step-label-group">
                  <span class="step-number-text">STEP 03</span>
                  <span class="step-name-text">Contact Info</span>
                </div>
              </button>
              <button type="button" class="stepper-step stepper-item" data-emb-step="4">
                <span class="step-indicator">4</span>
                <div class="step-label-group">
                  <span class="step-number-text">STEP 04</span>
                  <span class="step-name-text">Academic History</span>
                </div>
              </button>
              <button type="button" class="stepper-step stepper-item" data-emb-step="5">
                <span class="step-indicator">5</span>
                <div class="step-label-group">
                  <span class="step-number-text">STEP 05</span>
                  <span class="step-name-text">Skills &amp; Projects</span>
                </div>
              </button>
              <button type="button" class="stepper-step stepper-item" data-emb-step="6">
                <span class="step-indicator">6</span>
                <div class="step-label-group">
                  <span class="step-number-text">STEP 06</span>
                  <span class="step-name-text">Emergency Contact</span>
                </div>
              </button>
              <button type="button" class="stepper-step stepper-item" data-emb-step="7">
                <span class="step-indicator">7</span>
                <div class="step-label-group">
                  <span class="step-number-text">STEP 07</span>
                  <span class="step-name-text">Bank Details</span>
                </div>
              </button>
              <button type="button" class="stepper-step stepper-item" data-emb-step="8">
                <span class="step-indicator">8</span>
                <div class="step-label-group">
                  <span class="step-number-text">STEP 08</span>
                  <span class="step-name-text">Document Upload</span>
                </div>
              </button>
              <button type="button" class="stepper-step stepper-item" data-emb-step="9">
                <span class="step-indicator">9</span>
                <div class="step-label-group">
                  <span class="step-number-text">STEP 09</span>
                  <span class="step-name-text">Review &amp; Submit</span>
                </div>
              </button>
            </nav>
          </div>
          </div>

          ${currentApp && currentApp.correction_request ? `
            <div class="onb-alert onb-alert-danger" style="margin-bottom: 20px;">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>
              <div>
                <strong>HR Requested Corrections:</strong> ${window.UI.escapeHtml(currentApp.correction_request.remarks)}
              </div>
            </div>
          ` : ''}

          <!-- STEP PANES -->
          <div id="embStepPanesContainer">
            
            <!-- STEP 1: POSITION DETAILS -->
            <section id="embStepSec1" class="form-card emb-step-sec">
              <div class="form-card-header">
                <div>
                  <h3 class="form-card-title">Step 1 — Position Details</h3>
                  <p class="form-card-subtitle">Specify your applied role, domain specialization, and engagement duration</p>
                </div>
              </div>
              <div class="form-card-body">
                <form id="embForm1">
                  <div class="form-grid">
                    <div class="form-group col-6">
                      <label class="form-label">Position Applied For <span class="required">*</span></label>
                      <select id="e_pos_position" class="form-control" required>
                        <option value="Intern">Intern</option>
                        <option value="Project Trainee">Project Trainee</option>
                        <option value="Research Associate">Research Associate</option>
                        <option value="Full-Time Software Engineer">Full-Time Software Engineer</option>
                        <option value="Other">Other</option>
                      </select>
                    </div>
                    <div class="form-group col-6">
                      <label class="form-label">Domain / Area of Interest <span class="required">*</span></label>
                      <input type="text" id="e_pos_domain" class="form-control" placeholder="e.g. AI / ML, Robotics, Full-Stack Engineering, FinTech" required>
                    </div>
                    <div class="form-group col-6">
                      <label class="form-label">Preferred Joining Date <span class="required">*</span></label>
                      <input type="date" id="e_pos_joining_date" class="form-control" required>
                    </div>
                    <div class="form-group col-6">
                      <label class="form-label">Engagement Duration <span class="required">*</span></label>
                      <select id="e_pos_duration" class="form-control" required>
                        <option value="3 Months">3 Months</option>
                        <option value="6 Months">6 Months</option>
                        <option value="12 Months">12 Months</option>
                        <option value="Other">Other</option>
                      </select>
                    </div>
                  </div>
                </form>
              </div>
              <div class="form-card-footer">
                <div></div>
                <button type="button" class="btn btn-primary btn-emb-next" data-target="2">Save &amp; Continue &rarr;</button>
              </div>
            </section>

            <!-- STEP 2: PERSONAL INFORMATION -->
            <section id="embStepSec2" class="form-card emb-step-sec" style="display: none;">
              <div class="form-card-header">
                <div>
                  <h3 class="form-card-title">Step 2 — Personal Information</h3>
                  <p class="form-card-subtitle">Official identification credentials. Sensitive fields are masked and encrypted.</p>
                </div>
              </div>
              <div class="form-card-body">
                <form id="embForm2">
                  <div class="form-grid">
                    <div class="form-group col-6">
                      <label class="form-label">Full Legal Name (as per ID) <span class="required">*</span></label>
                      <input type="text" id="e_pi_name" class="form-control" placeholder="As in official documents" required>
                    </div>
                    <div class="form-group col-3">
                      <label class="form-label">Date of Birth <span class="required">*</span></label>
                      <input type="date" id="e_pi_dob" class="form-control" required>
                    </div>
                    <div class="form-group col-3">
                      <label class="form-label">Gender <span class="required">*</span></label>
                      <select id="e_pi_gender" class="form-control" required>
                        <option value="Male">Male</option>
                        <option value="Female">Female</option>
                        <option value="Other">Other</option>
                      </select>
                    </div>
                    <div class="form-group col-4">
                      <label class="form-label">Nationality <span class="required">*</span></label>
                      <input type="text" id="e_pi_nationality" class="form-control" value="Indian" required>
                    </div>
                    <div class="form-group col-5">
                      <label class="form-label">Aadhaar / Government ID Number</label>
                      <input type="text" id="e_pi_aadhaar" class="form-control" placeholder="12-digit Aadhaar / ID number" maxlength="16">
                      <span class="form-hint">Stored encrypted. Masked on display for security.</span>
                    </div>
                    <div class="form-group col-3">
                      <label class="form-label">Blood Group</label>
                      <select id="e_pi_blood_group" class="form-control">
                        <option value="">Select</option>
                        <option value="A+">A+</option>
                        <option value="A-">A-</option>
                        <option value="B+">B+</option>
                        <option value="B-">B-</option>
                        <option value="O+">O+</option>
                        <option value="O-">O-</option>
                        <option value="AB+">AB+</option>
                        <option value="AB-">AB-</option>
                      </select>
                    </div>
                  </div>
                </form>
              </div>
              <div class="form-card-footer">
                <button type="button" class="btn btn-secondary btn-emb-prev" data-target="1">Back</button>
                <button type="button" class="btn btn-primary btn-emb-next" data-target="3">Save &amp; Continue &rarr;</button>
              </div>
            </section>

            <!-- STEP 3: CONTACT & ADDRESS DETAILS -->
            <section id="embStepSec3" class="form-card emb-step-sec" style="display: none;">
              <div class="form-card-header">
                <div>
                  <h3 class="form-card-title">Step 3 — Contact &amp; Address Details</h3>
                  <p class="form-card-subtitle">Active communication details and residential addresses</p>
                </div>
              </div>
              <div class="form-card-body">
                <form id="embForm3">
                  <div class="form-grid">
                    <div class="form-group col-6">
                      <label class="form-label">Mobile Number <span class="required">*</span></label>
                      <input type="tel" id="e_cnt_mobile" class="form-control" placeholder="10-digit mobile number" required pattern="[0-9]{10}">
                    </div>
                    <div class="form-group col-6">
                      <label class="form-label">Personal Email ID <span class="required">*</span></label>
                      <input type="email" id="e_cnt_email" class="form-control" required readonly>
                    </div>
                    <div class="form-group col-12">
                      <label class="form-label">Permanent Address <span class="required">*</span></label>
                      <textarea id="e_cnt_permanent_address" class="form-control" rows="2" placeholder="Door No., Street, City, District, State, PIN Code" required></textarea>
                    </div>
                    <div class="col-12">
                      <label style="display: flex; align-items: center; gap: 8px; font-size: 0.85rem; cursor: pointer;">
                        <input type="checkbox" id="e_chkSameAddress">
                        <span>Current Address is same as Permanent Address</span>
                      </label>
                    </div>
                    <div class="form-group col-12" id="e_groupCurrentAddress">
                      <label class="form-label">Current / Communication Address <span class="required">*</span></label>
                      <textarea id="e_cnt_current_address" class="form-control" rows="2" placeholder="Door No., Street, City, District, State, PIN Code" required></textarea>
                    </div>
                  </div>
                </form>
              </div>
              <div class="form-card-footer">
                <button type="button" class="btn btn-secondary btn-emb-prev" data-target="2">Back</button>
                <button type="button" class="btn btn-primary btn-emb-next" data-target="4">Save &amp; Continue &rarr;</button>
              </div>
            </section>

            <!-- STEP 4: ACADEMIC INFORMATION -->
            <section id="embStepSec4" class="form-card emb-step-sec" style="display: none;">
              <div class="form-card-header">
                <div>
                  <h3 class="form-card-title">Step 4 — Academic Information</h3>
                  <p class="form-card-subtitle">List your educational qualifications</p>
                </div>
                <button type="button" class="btn btn-secondary btn-sm" id="e_btnAddAcademic">
                  + Add Qualification
                </button>
              </div>
              <div class="form-card-body">
                <div id="e_academicContainer"></div>
              </div>
              <div class="form-card-footer">
                <button type="button" class="btn btn-secondary btn-emb-prev" data-target="3">Back</button>
                <button type="button" class="btn btn-primary btn-emb-next" data-target="5">Save &amp; Continue &rarr;</button>
              </div>
            </section>

            <!-- STEP 5: SKILLS & EXPERIENCE -->
            <section id="embStepSec5" class="form-card emb-step-sec" style="display: none;">
              <div class="form-card-header">
                <div>
                  <h3 class="form-card-title">Step 5 — Skills &amp; Experience</h3>
                  <p class="form-card-subtitle">Technical proficiencies and engineering projects</p>
                </div>
              </div>
              <div class="form-card-body">
                <form id="embForm5">
                  <div class="form-grid" style="margin-bottom: 20px;">
                    <div class="form-group col-6">
                      <label class="form-label">Technical Skills <span class="required">*</span></label>
                      <input type="text" id="e_sk_technical" class="form-control" placeholder="e.g. Python, C++, React, ROS2, PostgreSQL" required>
                    </div>
                    <div class="form-group col-6">
                      <label class="form-label">Tools &amp; Platforms</label>
                      <input type="text" id="e_sk_tools" class="form-control" placeholder="e.g. Git, Docker, Linux, VS Code, Supabase">
                    </div>
                  </div>
                  
                  <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
                    <h4 style="font-size: 0.95rem; font-weight: 700; color: #001D35;">Projects &amp; Deliverables</h4>
                    <button type="button" class="btn btn-secondary btn-sm" id="e_btnAddProject">+ Add Project</button>
                  </div>
                  <div id="e_projectsContainer"></div>
                </form>
              </div>
              <div class="form-card-footer">
                <button type="button" class="btn btn-secondary btn-emb-prev" data-target="4">Back</button>
                <button type="button" class="btn btn-primary btn-emb-next" data-target="6">Save &amp; Continue &rarr;</button>
              </div>
            </section>

            <!-- STEP 6: EMERGENCY CONTACT -->
            <section id="embStepSec6" class="form-card emb-step-sec" style="display: none;">
              <div class="form-card-header">
                <div>
                  <h3 class="form-card-title">Step 6 — Emergency Contact</h3>
                  <p class="form-card-subtitle">Responsible person to notify in urgent situations</p>
                </div>
              </div>
              <div class="form-card-body">
                <form id="embForm6">
                  <div class="form-grid">
                    <div class="form-group col-6">
                      <label class="form-label">Contact Person Name <span class="required">*</span></label>
                      <input type="text" id="e_emg_name" class="form-control" placeholder="Parent / Guardian / Spouse / Relative" required>
                    </div>
                    <div class="form-group col-6">
                      <label class="form-label">Relationship <span class="required">*</span></label>
                      <select id="e_emg_relationship" class="form-control" required>
                        <option value="Parent">Parent</option>
                        <option value="Guardian">Guardian</option>
                        <option value="Spouse">Spouse</option>
                        <option value="Sibling">Sibling</option>
                        <option value="Other">Other</option>
                      </select>
                    </div>
                    <div class="form-group col-6">
                      <label class="form-label">Primary Mobile Number <span class="required">*</span></label>
                      <input type="tel" id="e_emg_mobile" class="form-control" placeholder="10-digit mobile number" required pattern="[0-9]{10}">
                    </div>
                    <div class="form-group col-6">
                      <label class="form-label">Alternate Phone Number</label>
                      <input type="tel" id="e_emg_alternate" class="form-control" placeholder="Optional alternate number">
                    </div>
                  </div>
                </form>
              </div>
              <div class="form-card-footer">
                <button type="button" class="btn btn-secondary btn-emb-prev" data-target="5">Back</button>
                <button type="button" class="btn btn-primary btn-emb-next" data-target="7">Save &amp; Continue &rarr;</button>
              </div>
            </section>

            <!-- STEP 7: BANK DETAILS -->
            <section id="embStepSec7" class="form-card emb-step-sec" style="display: none;">
              <div class="form-card-header">
                <div>
                  <h3 class="form-card-title">Step 7 — Bank Account Details</h3>
                  <p class="form-card-subtitle">Required for monthly stipend or compensation disbursement</p>
                </div>
              </div>
              <div class="form-card-body">
                <div class="onb-alert onb-alert-info">
                  <strong>Secure Banking Protection:</strong> Encrypted using AES-256 and only accessible by authorized HR payroll personnel.
                </div>
                <form id="embForm7">
                  <div class="form-grid">
                    <div class="form-group col-6">
                      <label class="form-label">Account Holder Name <span class="required">*</span></label>
                      <input type="text" id="e_bnk_holder" class="form-control" placeholder="Must match bank records" required>
                    </div>
                    <div class="form-group col-6">
                      <label class="form-label">Bank Name <span class="required">*</span></label>
                      <input type="text" id="e_bnk_name" class="form-control" placeholder="e.g. State Bank of India, HDFC, ICICI" required>
                    </div>
                    <div class="form-group col-6">
                      <label class="form-label">Account Number <span class="required">*</span></label>
                      <input type="password" id="e_bnk_account" class="form-control" placeholder="Enter bank account number" required>
                    </div>
                    <div class="form-group col-6">
                      <label class="form-label">Confirm Account Number <span class="required">*</span></label>
                      <input type="text" id="e_bnk_account_confirm" class="form-control" placeholder="Re-enter bank account number" required>
                    </div>
                    <div class="form-group col-6">
                      <label class="form-label">IFSC Code <span class="required">*</span></label>
                      <input type="text" id="e_bnk_ifsc" class="form-control" placeholder="11-character IFSC (e.g. SBIN0001234)" style="text-transform: uppercase;" required>
                    </div>
                  </div>
                </form>
              </div>
              <div class="form-card-footer">
                <button type="button" class="btn btn-secondary btn-emb-prev" data-target="6">Back</button>
                <button type="button" class="btn btn-primary btn-emb-next" data-target="8">Save &amp; Continue &rarr;</button>
              </div>
            </section>

            <!-- STEP 8: DOCUMENT UPLOADS -->
            <section id="embStepSec8" class="form-card emb-step-sec" style="display: none;">
              <div class="form-card-header">
                <div>
                  <h3 class="form-card-title">Step 8 — Document Uploads</h3>
                  <p class="form-card-subtitle">Upload clear scanned copies or PDFs (PDF, JPG, JPEG, PNG, max 10MB each)</p>
                </div>
              </div>
              <div class="form-card-body">
                <div class="upload-grid" id="e_uploadDropzonesContainer"></div>
              </div>
              <div class="form-card-footer">
                <button type="button" class="btn btn-secondary btn-emb-prev" data-target="7">Back</button>
                <button type="button" class="btn btn-primary btn-emb-next" data-target="9">Proceed to Review &rarr;</button>
              </div>
            </section>

            <!-- STEP 9: APPLICATION REVIEW & SUBMIT -->
            <section id="embStepSec9" class="form-card emb-step-sec" style="display: none;">
              <div class="form-card-header">
                <div>
                  <h3 class="form-card-title">Step 9 — Final Review &amp; Confirmation</h3>
                  <p class="form-card-subtitle">Review all populated details and submit for HR verification</p>
                </div>
                <button type="button" class="btn btn-accent btn-sm" id="e_btnPreviewPdf">
                  Download / Preview PDF
                </button>
              </div>
              <div class="form-card-body">
                
                <div class="review-sheet" id="e_reviewSheet">
                  <div class="review-sheet-header">
                    <div>
                      <div class="review-company-title">PUVIMA IT SERVICE AND RESEARCH CONSULTANCY</div>
                      <div class="review-company-sub">OFFICIAL ONBOARDING &amp; VERIFICATION RECORD</div>
                    </div>
                    <div style="text-align: right;">
                      <div style="font-family: monospace; font-weight: 700; color: #001D35;" id="e_revAppId">PV-ONB-...</div>
                      <div style="font-size: 0.8rem; color: #64748B;" id="e_revAppDate">Date: ${new Date().toISOString().split('T')[0]}</div>
                    </div>
                  </div>

                  <!-- 1. Position -->
                  <div class="review-section">
                    <div class="review-section-title">
                      <span>1. Position Details</span>
                      <button type="button" class="review-section-edit-btn" data-e-jump="1">Edit</button>
                    </div>
                    <table class="review-table">
                      <tr>
                        <th style="width: 25%;">Position:</th><td style="width: 25%;" id="e_revPosTitle">-</td>
                        <th style="width: 25%;">Domain:</th><td style="width: 25%;" id="e_revPosDomain">-</td>
                      </tr>
                      <tr>
                        <th>Joining Date:</th><td id="e_revPosJoin">-</td>
                        <th>Duration:</th><td id="e_revPosDuration">-</td>
                      </tr>
                    </table>
                  </div>

                  <!-- 2. Personal -->
                  <div class="review-section">
                    <div class="review-section-title">
                      <span>2. Personal Information</span>
                      <button type="button" class="review-section-edit-btn" data-e-jump="2">Edit</button>
                    </div>
                    <table class="review-table">
                      <tr>
                        <th style="width: 25%;">Full Name:</th><td style="width: 25%;" id="e_revPiName">-</td>
                        <th style="width: 25%;">Date of Birth:</th><td style="width: 25%;" id="e_revPiDob">-</td>
                      </tr>
                      <tr>
                        <th>Gender:</th><td id="e_revPiGender">-</td>
                        <th>Govt ID / Aadhaar:</th><td id="e_revPiAadhaar">-</td>
                      </tr>
                    </table>
                  </div>

                  <!-- 3. Contact -->
                  <div class="review-section">
                    <div class="review-section-title">
                      <span>3. Contact &amp; Residential Address</span>
                      <button type="button" class="review-section-edit-btn" data-e-jump="3">Edit</button>
                    </div>
                    <table class="review-table">
                      <tr>
                        <th style="width: 25%;">Mobile:</th><td style="width: 25%;" id="e_revCntMobile">-</td>
                        <th style="width: 25%;">Email:</th><td style="width: 25%;" id="e_revCntEmail">-</td>
                      </tr>
                      <tr><th>Address:</th><td colspan="3" id="e_revCntPerm">-</td></tr>
                    </table>
                  </div>

                  <!-- 4. Academic -->
                  <div class="review-section">
                    <div class="review-section-title">
                      <span>4. Academic Qualifications</span>
                      <button type="button" class="review-section-edit-btn" data-e-jump="4">Edit</button>
                    </div>
                    <table class="review-table">
                      <thead>
                        <tr><th>Level</th><th>Degree</th><th>Institution</th><th>Year</th><th>Score</th></tr>
                      </thead>
                      <tbody id="e_revAcademicBody"></tbody>
                    </table>
                  </div>

                  <!-- 5. Bank -->
                  <div class="review-section">
                    <div class="review-section-title">
                      <span>5. Bank Details</span>
                      <button type="button" class="review-section-edit-btn" data-e-jump="7">Edit</button>
                    </div>
                    <table class="review-table">
                      <tr>
                        <th style="width: 25%;">Account Holder:</th><td style="width: 25%;" id="e_revBnkHolder">-</td>
                        <th style="width: 25%;">Bank Name:</th><td style="width: 25%;" id="e_revBnkName">-</td>
                      </tr>
                      <tr>
                        <th>Account Number:</th><td id="e_revBnkAcc">Masked (XXXX...XXXX)</td>
                        <th>IFSC Code:</th><td id="e_revBnkIfsc">-</td>
                      </tr>
                    </table>
                  </div>

                  <!-- 6. Documents -->
                  <div class="review-section">
                    <div class="review-section-title">
                      <span>6. Uploaded Documents</span>
                      <button type="button" class="review-section-edit-btn" data-e-jump="8">Edit</button>
                    </div>
                    <table class="review-table">
                      <thead>
                        <tr><th>Category</th><th>Filename</th><th>Status</th></tr>
                      </thead>
                      <tbody id="e_revDocsBody"></tbody>
                    </table>
                  </div>

                </div>

                <!-- Declaration & Submit -->
                <div style="border: 2px solid #D97706; border-radius: 8px; padding: 20px; background: #FFFBEB;">
                  <h4 style="font-size: 1rem; font-weight: 700; color: #001D35; margin-bottom: 12px;">
                    Applicant Declaration and Confirmation
                  </h4>
                  <div style="display: flex; flex-direction: column; gap: 8px; margin-bottom: 20px; font-size: 0.85rem;">
                    <label style="display: flex; gap: 8px; align-items: flex-start; cursor: pointer;">
                      <input type="checkbox" id="e_chkDecl1" required style="margin-top: 3px;">
                      <span>I hereby confirm that all information provided is true, accurate, and correct.</span>
                    </label>
                    <label style="display: flex; gap: 8px; align-items: flex-start; cursor: pointer;">
                      <input type="checkbox" id="e_chkDecl2" required style="margin-top: 3px;">
                      <span>I agree to abide by the policies and code of conduct of Puvima IT Service and Research Consultancy.</span>
                    </label>
                    <label style="display: flex; gap: 8px; align-items: flex-start; cursor: pointer;">
                      <input type="checkbox" id="e_chkDecl3" required style="margin-top: 3px;">
                      <span>I confirm that I have uploaded all mandatory supporting documents for HR verification.</span>
                    </label>
                  </div>
                  <div style="display: flex; justify-content: flex-end; gap: 10px;">
                    <button type="button" class="btn btn-secondary" data-e-jump="8">Back to Documents</button>
                    <button type="button" class="btn btn-success btn-lg" id="e_btnConfirmSubmit">
                      CONFIRM &amp; SUBMIT APPLICATION
                    </button>
                  </div>
                </div>

              </div>
            </section>

          </div>

        </div>
      `;

      this.bindWizardEvents();
      this.populateWizardFields();
      this.renderUploadDropzones();
      this.goToStep(1);
    },

    // 6. Bind Wizard DOM Events
    bindWizardEvents() {
      // Step click on Stepper
      document.querySelectorAll('[data-emb-step]').forEach(el => {
        el.addEventListener('click', () => {
          const num = parseInt(el.getAttribute('data-emb-step'), 10);
          this.goToStep(num);
        });
      });

      // Next / Prev buttons
      document.querySelectorAll('.btn-emb-next').forEach(btn => {
        btn.addEventListener('click', () => {
          const target = parseInt(btn.getAttribute('data-target'), 10);
          this.handleStepSaveAndAdvance(activeStep, target);
        });
      });

      document.querySelectorAll('.btn-emb-prev').forEach(btn => {
        btn.addEventListener('click', () => {
          const target = parseInt(btn.getAttribute('data-target'), 10);
          this.goToStep(target);
        });
      });

      // Jump buttons from review
      document.querySelectorAll('[data-e-jump]').forEach(btn => {
        btn.addEventListener('click', () => {
          const target = parseInt(btn.getAttribute('data-e-jump'), 10);
          this.goToStep(target);
        });
      });

      // Same address toggle
      const chkSame = document.getElementById('e_chkSameAddress');
      if (chkSame) {
        chkSame.addEventListener('change', () => {
          const perm = document.getElementById('e_cnt_permanent_address').value;
          const curr = document.getElementById('e_cnt_current_address');
          if (chkSame.checked) {
            curr.value = perm;
            curr.setAttribute('readonly', 'true');
          } else {
            curr.removeAttribute('readonly');
          }
        });
      }

      // Add Academic
      const btnAddAc = document.getElementById('e_btnAddAcademic');
      if (btnAddAc) {
        btnAddAc.addEventListener('click', () => this.addAcademicRow());
      }

      // Add Project
      const btnAddPj = document.getElementById('e_btnAddProject');
      if (btnAddPj) {
        btnAddPj.addEventListener('click', () => this.addProjectRow());
      }

      // PDF Preview
      const btnPdf = document.getElementById('e_btnPreviewPdf');
      if (btnPdf) {
        btnPdf.addEventListener('click', () => {
          if (currentApp) window.open(`/api/onboarding/${currentApp.id}/pdf`, '_blank');
        });
      }

      // Submit
      const btnSub = document.getElementById('e_btnConfirmSubmit');
      if (btnSub) {
        btnSub.addEventListener('click', () => this.handleFinalSubmit());
      }
    },

    goToStep(stepNum) {
      if (stepNum < 1 || stepNum > 9) return;
      activeStep = stepNum;

      for (let i = 1; i <= 9; i++) {
        const sec = document.getElementById(`embStepSec${i}`);
        if (sec) sec.style.display = (i === activeStep) ? 'block' : 'none';
      }

      document.querySelectorAll('[data-emb-step]').forEach(el => {
        const num = parseInt(el.getAttribute('data-emb-step'), 10);
        el.classList.remove('active');
        if (num === activeStep) el.classList.add('active');
        else if (num < activeStep) el.classList.add('completed');
      });

      const titleEl = document.getElementById('embStepTitle');
      const indEl = document.getElementById('embStepIndicator');
      if (indEl) indEl.textContent = `Step ${activeStep} of 9`;

      const titles = [
        'Step 1 — Position Details',
        'Step 2 — Personal Information',
        'Step 3 — Contact & Address Details',
        'Step 4 — Academic Information',
        'Step 5 — Skills & Experience',
        'Step 6 — Emergency Contact',
        'Step 7 — Bank Account Details',
        'Step 8 — Document Uploads',
        'Step 9 — Final Review & Confirmation'
      ];
      if (titleEl) titleEl.textContent = titles[activeStep - 1] || 'Onboarding Step';

      if (activeStep === 9) {
        this.populateReviewSheet();
      }

      window.scrollTo({ top: 0, behavior: 'smooth' });
    },

    // 7. Populate Form Fields
    populateWizardFields() {
      const app = currentApp;
      if (!app) return;

      const setVal = (id, val) => {
        const el = document.getElementById(id);
        if (el && val !== undefined && val !== null) el.value = val;
      };

      // Step 1
      const posSelect = document.getElementById('e_pos_position');
      const targetPos = app.position_applied || app.position || (activeUser ? activeUser.role : 'Intern');
      if (posSelect && targetPos) {
        let matched = false;
        for (let i = 0; i < posSelect.options.length; i++) {
          if (posSelect.options[i].value.toLowerCase() === String(targetPos).toLowerCase()) {
            posSelect.selectedIndex = i;
            matched = true;
            break;
          }
        }
        if (!matched) {
          const opt = document.createElement('option');
          opt.value = targetPos;
          opt.textContent = targetPos;
          opt.selected = true;
          posSelect.appendChild(opt);
        }
      }
      setVal('e_pos_domain', app.domain_interest || app.domain || 'Technology & Research');
      setVal('e_pos_joining_date', app.preferred_joining_date || app.joining_date || new Date().toISOString().split('T')[0]);
      setVal('e_pos_duration', app.duration || '6 Months');

      // Step 2
      setVal('e_pi_name', app.applicant_name || app.name || (activeUser ? activeUser.name : ''));
      setVal('e_pi_dob', app.dob || '2000-01-01');
      setVal('e_pi_gender', app.gender || 'Male');
      setVal('e_pi_nationality', app.nationality || 'Indian');
      setVal('e_pi_aadhaar', app.id_number_masked || app.aadhaar_masked || app.aadhaar || '');
      setVal('e_pi_blood_group', app.blood_group || '');

      // Step 3
      setVal('e_cnt_mobile', app.applicant_phone || app.phone || '');
      setVal('e_cnt_email', app.applicant_email || app.email || (activeUser ? activeUser.email : ''));
      setVal('e_cnt_permanent_address', app.permanent_address || '');
      setVal('e_cnt_current_address', app.current_address || '');

      // Step 4: Academic
      const acCont = document.getElementById('e_academicContainer');
      if (acCont) {
        acCont.innerHTML = '';
        const list = app.academic_details || [];
        if (list.length > 0) {
          list.forEach(item => this.addAcademicRow(item));
        } else {
          this.addAcademicRow({ qualification_type: 'UG' });
        }
      }

      // Step 5: Skills
      setVal('e_sk_technical', app.skills || app.technical_skills || '');
      setVal('e_sk_tools', app.tools_platforms || '');
      const pjCont = document.getElementById('e_projectsContainer');
      if (pjCont) {
        pjCont.innerHTML = '';
        const pjs = app.projects || app.projects_experience || [];
        if (pjs.length > 0) {
          pjs.forEach(p => this.addProjectRow(p));
        } else {
          this.addProjectRow();
        }
      }

      // Step 6: Emergency
      const emg = (app.emergency_contacts && app.emergency_contacts[0]) || {};
      setVal('e_emg_name', emg.contact_person || emg.name || '');
      setVal('e_emg_relationship', emg.relationship || 'Parent');
      setVal('e_emg_mobile', emg.mobile_number || emg.mobile || '');
      setVal('e_emg_alternate', emg.alternate_number || emg.alternate_phone || '');

      // Step 7: Bank
      const bnk = app.bank_details || {};
      setVal('e_bnk_holder', bnk.account_holder_name || (activeUser ? activeUser.name : ''));
      setVal('e_bnk_name', bnk.bank_name || '');
      setVal('e_bnk_account', bnk.account_number_masked || '');
      setVal('e_bnk_account_confirm', bnk.account_number_masked || '');
      setVal('e_bnk_ifsc', bnk.ifsc_code || '');
    },

    // 8. Academic & Project Repeaters
    addAcademicRow(data = {}) {
      const container = document.getElementById('e_academicContainer');
      if (!container) return;
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
              <option value="UG" ${(data.qualification_type === 'UG' || data.qualification === 'UG') ? 'selected' : ''}>UG (Bachelor's)</option>
              <option value="PG" ${(data.qualification_type === 'PG' || data.qualification === 'PG') ? 'selected' : ''}>PG (Master's)</option>
              <option value="Diploma" ${(data.qualification_type === 'Diploma' || data.qualification === 'Diploma') ? 'selected' : ''}>Diploma</option>
              <option value="Higher Secondary" ${(data.qualification_type === 'Higher Secondary' || data.qualification === 'Higher Secondary') ? 'selected' : ''}>12th / HSC</option>
              <option value="Others" ${(data.qualification_type === 'Others' || data.qualification === 'Others') ? 'selected' : ''}>Others</option>
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
            <input type="text" class="form-control ac-score" placeholder="e.g. 8.65 or 85%" value="${data.score_cgpa || data.cgpa_percentage || ''}" required>
          </div>
        </div>
      `;
      const removeBtn = card.querySelector('.remove-ac');
      if (removeBtn) removeBtn.addEventListener('click', () => card.remove());
      container.appendChild(card);
    },

    addProjectRow(data = {}) {
      const container = document.getElementById('e_projectsContainer');
      if (!container) return;
      const idx = container.children.length + 1;
      const card = document.createElement('div');
      card.className = 'repeater-card';
      card.innerHTML = `
        <div class="repeater-card-header">
          <span class="repeater-title">Project / Deliverable #${idx}</span>
          ${idx > 1 ? '<button type="button" class="btn-remove-row remove-pj">&times; Remove</button>' : ''}
        </div>
        <div class="form-grid">
          <div class="form-group col-6">
            <label class="form-label">Project Title <span class="required">*</span></label>
            <input type="text" class="form-control pj-title" placeholder="e.g. Autonomous Robotic Navigation" value="${data.title || ''}" required>
          </div>
          <div class="form-group col-6">
            <label class="form-label">Organization / Lab</label>
            <input type="text" class="form-control pj-org" placeholder="e.g. PUVIMA Robotics Lab" value="${data.organization || data.technologies || ''}">
          </div>
          <div class="form-group col-12">
            <label class="form-label">Description &amp; Achievements</label>
            <input type="text" class="form-control pj-desc" placeholder="Summary of deliverables and technologies" value="${data.description || ''}">
          </div>
        </div>
      `;
      const removeBtn = card.querySelector('.remove-pj');
      if (removeBtn) removeBtn.addEventListener('click', () => card.remove());
      container.appendChild(card);
    },

    // 9. Document Dropzones
    renderUploadDropzones() {
      const container = document.getElementById('e_uploadDropzonesContainer');
      if (!container) return;

      container.innerHTML = '';
      const uploadedDocs = (currentApp && currentApp.documents) ? currentApp.documents : [];

      DOC_CATEGORIES.forEach(cat => {
        const existingDoc = uploadedDocs.find(d => d.category === cat.key);
        const card = document.createElement('div');
        card.className = 'upload-card';

        let badgeHtml = '<span class="upload-status-badge status-badge-pending">Pending</span>';
        if (existingDoc) {
          if (existingDoc.verification_status === 'Verified') {
            badgeHtml = '<span class="upload-status-badge status-badge-verified">Verified</span>';
          } else if (existingDoc.verification_status === 'Correction Required') {
            badgeHtml = '<span class="upload-status-badge status-badge-correction">Correction Req.</span>';
          } else {
            badgeHtml = '<span class="upload-status-badge status-badge-uploaded">Uploaded</span>';
          }
        }

        card.innerHTML = `
          <div class="upload-header">
            <div>
              <div class="upload-category-title">
                ${cat.title} ${cat.mandatory ? '<span class="required" style="color: #DC2626;">*</span>' : ''}
              </div>
              <div class="upload-category-desc">${cat.desc}</div>
            </div>
            ${badgeHtml}
          </div>

          ${existingDoc ? `
            <div class="file-info-bar">
              <div class="file-name-meta" title="${existingDoc.original_name || existingDoc.original_filename}">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path></svg>
                <span>${existingDoc.original_name || existingDoc.original_filename}</span>
              </div>
              <div class="file-actions">
                <a href="/api/onboarding/${currentApp.id}/document/${existingDoc.id}" target="_blank" class="btn btn-secondary btn-sm">Preview</a>
                <button type="button" class="btn-remove-row btn-e-doc-delete" data-doc-id="${existingDoc.id}">&times; Remove</button>
              </div>
            </div>
          ` : `
            <div class="dropzone" id="e_dropzone_${cat.key}">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="17 8 12 3 7 8"></polyline><line x1="12" y1="3" x2="12" y2="15"></line></svg>
              <p><strong>Click to browse</strong> or drag &amp; drop file here</p>
              <small>PDF, JPG, JPEG, PNG (Max 10MB)</small>
              <input type="file" id="e_file_input_${cat.key}" accept=".pdf,.jpg,.jpeg,.png" style="display: none;">
            </div>
            <div class="upload-progress-container" id="e_prog_cont_${cat.key}">
              <div class="upload-progress-bar" id="e_prog_bar_${cat.key}"></div>
            </div>
          `}
        `;

        if (!existingDoc) {
          const dropzone = card.querySelector(`#e_dropzone_${cat.key}`);
          const fileInput = card.querySelector(`#e_file_input_${cat.key}`);
          dropzone.addEventListener('click', () => fileInput.click());
          fileInput.addEventListener('change', (e) => {
            if (e.target.files && e.target.files[0]) this.uploadFile(cat.key, e.target.files[0]);
          });
        } else {
          const delBtn = card.querySelector('.btn-e-doc-delete');
          if (delBtn) {
            delBtn.addEventListener('click', () => this.deleteDocument(existingDoc.id));
          }
        }

        container.appendChild(card);
      });
    },

    uploadFile(category, file) {
      if (!currentApp) return;

      const progCont = document.getElementById(`e_prog_cont_${category}`);
      const progBar = document.getElementById(`e_prog_bar_${category}`);
      if (progCont) progCont.style.display = 'block';

      const formData = new FormData();
      formData.append('file', file);
      formData.append('category', category);

      const xhr = new XMLHttpRequest();
      xhr.open('POST', `/api/onboarding/${currentApp.id}/document`);
      if (currentToken) xhr.setRequestHeader('x-onboarding-token', currentToken);

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
              if (!currentApp.documents) currentApp.documents = [];
              currentApp.documents = currentApp.documents.filter(d => d.category !== category);
              currentApp.documents.push(res.document);
              this.renderUploadDropzones();
            } else {
              alert('Upload failed: ' + res.message);
            }
          } catch (e) {
            alert('Upload response parse error.');
          }
        }
        if (progCont) progCont.style.display = 'none';
      };

      xhr.onerror = () => {
        alert('Upload network error.');
        if (progCont) progCont.style.display = 'none';
      };

      xhr.send(formData);
    },

    async deleteDocument(docId) {
      if (!confirm('Are you sure you want to remove this document?')) return;
      try {
        const res = await fetch(`/api/onboarding/${currentApp.id}/document/${docId}`, {
          method: 'DELETE',
          headers: { 'x-onboarding-token': currentToken || '' }
        });
        const data = await res.json();
        if (data.success) {
          currentApp.documents = (currentApp.documents || []).filter(d => d.id !== docId);
          this.renderUploadDropzones();
        }
      } catch (e) {
        alert('Delete document error: ' + e.message);
      }
    },

    // 10. Step Save & Advance
    async handleStepSaveAndAdvance(currentStepNum, nextStepNum) {
      if (!currentApp) return;

      const payload = this.gatherStepData(currentStepNum);

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
        if (!data.success) throw new Error(data.message || 'Save failed.');

        if (data.application) {
          currentApp = { ...currentApp, ...data.application };
        }
        this.goToStep(nextStepNum);
      } catch (err) {
        alert('Error saving step: ' + err.message);
      }
    },

    gatherStepData(stepNum) {
      switch (stepNum) {
        case 1:
          return {
            position_applied: document.getElementById('e_pos_position').value,
            domain_interest: document.getElementById('e_pos_domain').value,
            preferred_joining_date: document.getElementById('e_pos_joining_date').value,
            duration: document.getElementById('e_pos_duration').value
          };
        case 2:
          return {
            full_name: document.getElementById('e_pi_name').value,
            dob: document.getElementById('e_pi_dob').value,
            gender: document.getElementById('e_pi_gender').value,
            nationality: document.getElementById('e_pi_nationality').value,
            id_number: document.getElementById('e_pi_aadhaar').value,
            blood_group: document.getElementById('e_pi_blood_group').value
          };
        case 3:
          return {
            mobile_number: document.getElementById('e_cnt_mobile').value,
            personal_email: document.getElementById('e_cnt_email').value,
            permanent_address: document.getElementById('e_cnt_permanent_address').value,
            current_address: document.getElementById('e_cnt_current_address').value
          };
        case 4: {
          const rows = document.querySelectorAll('#e_academicContainer .repeater-card');
          const qualifications = [];
          rows.forEach(r => {
            qualifications.push({
              qualification_type: r.querySelector('.ac-qual').value,
              degree_name: r.querySelector('.ac-degree').value,
              institution: r.querySelector('.ac-inst').value,
              year_of_passing: r.querySelector('.ac-year').value,
              score_cgpa: r.querySelector('.ac-score').value
            });
          });
          return { academic_details: qualifications };
        }
        case 5: {
          const rows = document.querySelectorAll('#e_projectsContainer .repeater-card');
          const projects = [];
          rows.forEach(r => {
            projects.push({
              title: r.querySelector('.pj-title').value,
              organization: r.querySelector('.pj-org').value,
              description: r.querySelector('.pj-desc').value
            });
          });
          return {
            skills: document.getElementById('e_sk_technical').value,
            tools_platforms: document.getElementById('e_sk_tools').value,
            projects
          };
        }
        case 6:
          return {
            contact_person: document.getElementById('e_emg_name').value,
            relationship: document.getElementById('e_emg_relationship').value,
            mobile_number: document.getElementById('e_emg_mobile').value,
            alternate_number: document.getElementById('e_emg_alternate').value
          };
        case 7:
          return {
            account_holder_name: document.getElementById('e_bnk_holder').value,
            bank_name: document.getElementById('e_bnk_name').value,
            account_number: document.getElementById('e_bnk_account').value,
            ifsc_code: document.getElementById('e_bnk_ifsc').value
          };
        default:
          return {};
      }
    },

    // 11. Populate Review Sheet
    populateReviewSheet() {
      if (!currentApp) return;

      const setTxt = (id, val) => {
        const el = document.getElementById(id);
        if (el) el.textContent = val || '-';
      };

      setTxt('e_revAppId', currentApp.application_id || currentApp.id);
      setTxt('e_revPosTitle', document.getElementById('e_pos_position')?.value);
      setTxt('e_revPosDomain', document.getElementById('e_pos_domain')?.value);
      setTxt('e_revPosJoin', document.getElementById('e_pos_joining_date')?.value);
      setTxt('e_revPosDuration', document.getElementById('e_pos_duration')?.value);

      setTxt('e_revPiName', document.getElementById('e_pi_name')?.value);
      setTxt('e_revPiDob', document.getElementById('e_pi_dob')?.value);
      setTxt('e_revPiGender', document.getElementById('e_pi_gender')?.value);
      const rawAadhaar = document.getElementById('e_pi_aadhaar')?.value;
      setTxt('e_revPiAadhaar', rawAadhaar ? (rawAadhaar.length > 4 ? `XXXX-XXXX-${rawAadhaar.slice(-4)}` : rawAadhaar) : '-');

      setTxt('e_revCntMobile', document.getElementById('e_cnt_mobile')?.value);
      setTxt('e_revCntEmail', document.getElementById('e_cnt_email')?.value);
      setTxt('e_revCntPerm', document.getElementById('e_cnt_permanent_address')?.value);

      setTxt('e_revBnkHolder', document.getElementById('e_bnk_holder')?.value);
      setTxt('e_revBnkName', document.getElementById('e_bnk_name')?.value);
      const acc = document.getElementById('e_bnk_account')?.value;
      setTxt('e_revBnkAcc', acc ? `XXXX-XXXX-${acc.slice(-4)}` : '-');
      setTxt('e_revBnkIfsc', document.getElementById('e_bnk_ifsc')?.value);

      // Academic list
      const acBody = document.getElementById('e_revAcademicBody');
      const acRows = document.querySelectorAll('#e_academicContainer .repeater-card');
      if (acBody) {
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

      // Documents
      const docsBody = document.getElementById('e_revDocsBody');
      const docs = currentApp.documents || [];
      if (docsBody) {
        docsBody.innerHTML = '';
        docs.forEach(d => {
          const cat = DOC_CATEGORIES.find(c => c.key === d.category);
          const tr = document.createElement('tr');
          tr.innerHTML = `
            <td><strong>${cat ? cat.title : d.category}</strong></td>
            <td>${d.original_name || d.original_filename}</td>
            <td><span class="upload-status-badge status-badge-uploaded">${d.verification_status || 'Uploaded'}</span></td>
          `;
          docsBody.appendChild(tr);
        });
      }
    },

    // 12. Final Submit
    async handleFinalSubmit() {
      const c1 = document.getElementById('e_chkDecl1')?.checked;
      const c2 = document.getElementById('e_chkDecl2')?.checked;
      const c3 = document.getElementById('e_chkDecl3')?.checked;

      if (!c1 || !c2 || !c3) {
        alert('Please confirm all three declaration statements before submitting.');
        return;
      }

      const btn = document.getElementById('e_btnConfirmSubmit');
      const origText = btn.innerHTML;
      btn.disabled = true;
      btn.innerHTML = 'Submitting & Finalizing Application...';

      try {
        const endpoint = isCorrectionMode ? `/api/onboarding/${currentApp.id}/resubmit` : `/api/onboarding/${currentApp.id}/submit`;
        const res = await fetch(endpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-onboarding-token': currentToken || ''
          },
          body: JSON.stringify({
            signature: document.getElementById('e_pi_name')?.value || activeUser.name,
            notes: isCorrectionMode ? 'Corrections addressed by applicant.' : ''
          })
        });

        const data = await res.json();
        if (!data.success) throw new Error(data.message || 'Submission failed.');

        currentApp = data.application;
        alert('Onboarding Application Submitted Successfully! It is now under HR verification.');
        
        // Refresh banner
        const bannerEl = document.getElementById('memberOnboardingBanner');
        const badgeEl = document.getElementById('memberOnbBadge');
        this.renderBanner(bannerEl, badgeEl, null);

        // Transition to status dashboard view directly on the same page
        if (hostContainer) {
          this.renderStatusDashboardView(hostContainer);
        }
      } catch (err) {
        alert('Submission error: ' + err.message);
      } finally {
        btn.disabled = false;
        btn.innerHTML = origText;
      }
    },

    // 13. Render Status Dashboard View (Inside the same page!)
    renderStatusDashboardView(container) {
      const app = currentApp;
      const status = app ? (app.status || 'Submitted').toUpperCase() : 'SUBMITTED';

      let statusColor = '#0B57D0';
      let statusBg = '#E0F2FE';
      if (status === 'APPROVED') {
        statusColor = '#16A34A';
        statusBg = '#DCFCE7';
      } else if (status === 'CORRECTION REQUIRED') {
        statusColor = '#DC2626';
        statusBg = '#FEE2E2';
      }

      container.innerHTML = `
        <div style="display: flex; flex-direction: column; gap: 24px;">
          
          <!-- Top Record Banner -->
          <div class="card" style="background: linear-gradient(135deg, #001D35 0%, #003E7E 100%); color: #FFFFFF; padding: 28px; border-radius: 12px; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 16px;">
            <div>
              <span style="font-size: 0.8rem; letter-spacing: 0.5px; opacity: 0.85; text-transform: uppercase;">Official Onboarding Profile</span>
              <h2 style="font-size: 1.45rem; font-weight: 800; color: #FFFFFF; margin: 4px 0;">
                ${window.UI.escapeHtml(app.applicant_name || app.name || activeUser.name)}
              </h2>
              <div style="font-family: monospace; font-size: 1rem; background: rgba(255,255,255,0.15); padding: 4px 12px; border-radius: 6px; display: inline-block; margin-top: 4px;">
                Record ID: ${app.application_id || app.id}
              </div>
            </div>
            <div style="text-align: right;">
              <div style="font-size: 0.82rem; opacity: 0.85;">Current Verification Stage</div>
              <div style="font-size: 1.1rem; font-weight: 800; padding: 6px 16px; border-radius: 9999px; display: inline-block; margin-top: 6px; background: ${statusBg}; color: ${statusColor};">
                ${status.replace(/_/g, ' ')}
              </div>
            </div>
          </div>

          <!-- Correction Alert (if needed) -->
          ${app.correction_request ? `
            <div class="onb-alert onb-alert-danger" style="margin: 0;">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>
              <div style="flex: 1;">
                <h4 style="font-size: 1rem; font-weight: 700; margin-bottom: 4px;">Action Required: HR Requested Corrections</h4>
                <p style="margin-bottom: 8px;">${window.UI.escapeHtml(app.correction_request.remarks)}</p>
                <button type="button" class="btn btn-primary btn-sm btn-reopen-wizard-here" style="background: #DC2626; border-color: #DC2626;">
                  Make Corrections in This Form &rarr;
                </button>
              </div>
            </div>
          ` : ''}

          <!-- Two-Column Layout: Progress & Timeline -->
          <div style="display: grid; grid-template-columns: 1.5fr 1fr; gap: 24px;">
            
            <!-- Left: Document Verification Checklist -->
            <div class="form-card" style="margin: 0;">
              <div class="form-card-header">
                <h3 class="form-card-title">Verification Checklist &amp; Documents</h3>
                <a href="/api/onboarding/${encodeURIComponent(app.application_id || app.id)}/pdf" target="_blank" class="btn btn-secondary btn-sm">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
                  Download Form (PDF)
                </a>
              </div>
              <div class="form-card-body">
                
                <table class="review-table" style="margin-bottom: 20px;">
                  <tr><th style="width: 35%;">Applied Role:</th><td>${window.UI.escapeHtml(app.position_applied || app.position || '-')}</td></tr>
                  <tr><th>Domain Focus:</th><td>${window.UI.escapeHtml(app.domain_interest || app.domain || '-')}</td></tr>
                  <tr><th>Submission Date:</th><td>${app.submission_date ? new Date(app.submission_date).toLocaleDateString() : 'Draft'}</td></tr>
                </table>

                <h4 style="font-size: 0.92rem; font-weight: 700; color: #001D35; margin-bottom: 10px;">
                  Submitted Credentials Status
                </h4>
                <table class="review-table">
                  <thead>
                    <tr><th>Credential</th><th>Status</th><th>HR Review Note</th></tr>
                  </thead>
                  <tbody>
                    ${(app.documents || []).length === 0 ? '<tr><td colspan="3" style="text-align: center; color: #94A3B8;">No documents uploaded yet</td></tr>' : (app.documents || []).map(d => `
                      <tr>
                        <td><strong>${window.UI.escapeHtml(d.category.toUpperCase().replace(/_/g, ' '))}</strong></td>
                        <td>
                          <span class="upload-status-badge ${d.verification_status === 'Verified' ? 'status-badge-verified' : (d.verification_status === 'Correction Required' ? 'status-badge-correction' : 'status-badge-uploaded')}">
                            ${d.verification_status || 'Uploaded'}
                          </span>
                        </td>
                        <td style="color: ${d.hr_remarks ? '#DC2626' : '#64748B'}; font-size: 0.8rem;">
                          ${d.hr_remarks || 'Pending inspection'}
                        </td>
                      </tr>
                    `).join('')}
                  </tbody>
                </table>

              </div>
              <div class="form-card-footer" style="justify-content: flex-end;">
                <button type="button" class="btn btn-secondary btn-sm btn-reopen-wizard-here">
                  View / Edit Profile Fields
                </button>
              </div>
            </div>

            <!-- Right: Stepper Timeline -->
            <div class="form-card" style="margin: 0;">
              <div class="form-card-header">
                <h3 class="form-card-title">Verification Timeline</h3>
              </div>
              <div class="form-card-body">
                <div class="timeline">
                  <div class="timeline-item completed">
                    <div class="timeline-dot"></div>
                    <div class="timeline-content">
                      <h4>Application Created</h4>
                      <p>${app.created_at ? new Date(app.created_at).toLocaleDateString() : 'Recorded'}</p>
                    </div>
                  </div>
                  <div class="timeline-item ${app.submission_date ? 'completed' : ''}">
                    <div class="timeline-dot"></div>
                    <div class="timeline-content">
                      <h4>Application Submitted</h4>
                      <p>${app.submission_date ? new Date(app.submission_date).toLocaleDateString() : 'Pending'}</p>
                    </div>
                  </div>
                  <div class="timeline-item ${['under hr review', 'documents under verification', 'correction required', 'resubmitted', 'approved', 'rejected'].includes(status.toLowerCase()) ? 'completed' : ''}">
                    <div class="timeline-dot"></div>
                    <div class="timeline-content">
                      <h4>HR Review</h4>
                      <p>${['under hr review', 'documents under verification', 'correction required', 'resubmitted', 'approved', 'rejected'].includes(status.toLowerCase()) ? 'In Progress / Completed' : 'Pending review'}</p>
                    </div>
                  </div>
                  <div class="timeline-item ${['documents under verification', 'approved', 'rejected'].includes(status.toLowerCase()) ? 'completed' : ''}">
                    <div class="timeline-dot"></div>
                    <div class="timeline-content">
                      <h4>Document Verification</h4>
                      <p>${['documents under verification', 'approved', 'rejected'].includes(status.toLowerCase()) ? 'Inspected by HR' : 'Awaiting inspection'}</p>
                    </div>
                  </div>
                  <div class="timeline-item ${['approved', 'rejected'].includes(status.toLowerCase()) ? 'completed' : ''}">
                    <div class="timeline-dot"></div>
                    <div class="timeline-content">
                      <h4>Final Decision</h4>
                      <p>${status === 'APPROVED' ? 'Cleared & Approved' : (status === 'REJECTED' ? 'Rejected' : 'Pending final signoff')}</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

          </div>

        </div>
      `;

      // Allow reopening wizard from button
      container.querySelectorAll('.btn-reopen-wizard-here').forEach(btn => {
        btn.addEventListener('click', () => {
          this.renderWizardView(container);
        });
      });
    }
  };

})();
