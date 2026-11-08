/**
 * PUVIMA Consultancy — Member LOR (Letter of Recommendation) View Controller
 * Powers Intern LOR Application, Automated Professor Email Dispatch,
 * Professor Endorsement Tracking, and Official LOR PDF Download.
 */

(function () {
  'use strict';

  let currentLor = null;
  let activeUser = null;
  let hostContainer = null;

  window.MemberLorView = {
    // 1. Check status and render sidebar badge
    async checkAndRenderBadge(currentUser, badgeEl) {
      if (!currentUser || !currentUser.email) return;
      activeUser = currentUser;

      try {
        const res = await fetch(`/api/lor/my?email=${encodeURIComponent(currentUser.email)}`);
        if (res.ok) {
          const data = await res.json();
          if (data.success && data.lor) {
            currentLor = data.lor;
            if (badgeEl) {
              const st = currentLor.status;
              badgeEl.style.display = 'inline-block';
              if (st === 'HR Approved' || st === 'LOR Issued') {
                badgeEl.textContent = 'Issued';
                badgeEl.style.background = '#DCFCE7';
                badgeEl.style.color = '#16A34A';
              } else if (st === 'Confirmed by Professor') {
                badgeEl.textContent = 'Endorsed';
                badgeEl.style.background = '#E0F2FE';
                badgeEl.style.color = '#0284C7';
              } else {
                badgeEl.textContent = 'Active';
                badgeEl.style.background = '#FEF3C7';
                badgeEl.style.color = '#B45309';
              }
            }
          }
        }
      } catch (e) {
        console.warn('[MemberLorView] Badge check note:', e.message);
      }
    },

    // 2. Render Workspace Tab Content
    async renderWorkspaceTab(container, currentUser) {
      hostContainer = container;
      activeUser = currentUser;
      if (!container) return;

      container.innerHTML = `
        <div style="padding: 40px; text-align: center; color: #64748B;">
          <div class="spinner-sm" style="margin: 0 auto 12px;"></div>
          Loading your Letter of Recommendation (LOR) record...
        </div>
      `;

      try {
        const res = await fetch(`/api/lor/my?email=${encodeURIComponent(currentUser.email)}`);
        if (res.ok) {
          const data = await res.json();
          if (data.success && data.lor) {
            currentLor = data.lor;
          } else {
            currentLor = null;
          }
        }
      } catch (e) {
        console.warn('[MemberLorView] Error loading LOR data:', e.message);
      }

      if (!currentLor || currentLor.status === 'Draft') {
        this.renderApplicationForm(container);
      } else {
        this.renderStatusDashboard(container);
      }
    },

    // 3. Render LOR Application Form
    renderApplicationForm(container) {
      const u = activeUser || {};
      const lor = currentLor || {};

      container.innerHTML = `
        <div class="embedded-onboarding-wizard">
          
          <!-- Header Banner -->
          <div class="card" style="background: linear-gradient(135deg, #001D35 0%, #003E7E 100%); color: #FFFFFF; padding: 24px 28px; border-radius: 12px; margin-bottom: 24px;">
            <div style="font-size: 0.75rem; letter-spacing: 0.5px; opacity: 0.85; text-transform: uppercase;">Fellowship Credentials</div>
            <h2 style="font-size: 1.35rem; font-weight: 800; color: #FFFFFF; margin: 4px 0 6px;">
              Request Official Letter of Recommendation (LOR)
            </h2>
            <p style="font-size: 0.88rem; color: #94A3B8; margin: 0; line-height: 1.5;">
              Provide your designated university Professor / Academic Mentor details. Once confirmed, an official verification email will be dispatched from <strong>contact@puvima.com</strong> for their academic endorsement.
            </p>
          </div>

          <!-- Application Form Card -->
          <div class="form-card">
            <div class="form-card-header">
              <div>
                <h3 class="form-card-title">1. Student &amp; Academic Credentials</h3>
                <p class="form-card-subtitle">Confirm your internship profile and deliverables</p>
              </div>
            </div>
            <div class="form-card-body">
              <form id="formLorSubmit">
                
                <div class="form-grid" style="margin-bottom: 24px;">
                  <div class="form-group col-6">
                    <label class="form-label">Full Name <span class="required">*</span></label>
                    <input type="text" id="lor_intern_name" class="form-control" value="${window.UI.escapeHtml(lor.intern_name || u.name || '')}" required>
                  </div>
                  <div class="form-group col-6">
                    <label class="form-label">Registered Email <span class="required">*</span></label>
                    <input type="email" id="lor_intern_email" class="form-control" value="${window.UI.escapeHtml(u.email || '')}" readonly required>
                  </div>
                  <div class="form-group col-6">
                    <label class="form-label">Domain Specialization <span class="required">*</span></label>
                    <input type="text" id="lor_domain" class="form-control" placeholder="e.g. Artificial Intelligence, Robotics, Full-Stack" value="${window.UI.escapeHtml(lor.domain_specialization || 'Software & Research Engineering')}" required>
                  </div>
                  <div class="form-group col-6">
                    <label class="form-label">College / University Name <span class="required">*</span></label>
                    <input type="text" id="lor_college" class="form-control" placeholder="e.g. National Institute of Technology, Anna University" value="${window.UI.escapeHtml(lor.college_university || '')}" required>
                  </div>
                  <div class="form-group col-6">
                    <label class="form-label">Department / Branch</label>
                    <input type="text" id="lor_dept" class="form-control" placeholder="e.g. Computer Science & Engineering" value="${window.UI.escapeHtml(lor.department_branch || '')}">
                  </div>
                  <div class="form-group col-6">
                    <label class="form-label">Purpose of Letter of Recommendation <span class="required">*</span></label>
                    <select id="lor_purpose" class="form-control" required>
                      <option value="Higher Studies (MS / Ph.D. Applications)" ${lor.purpose_of_lor === 'Higher Studies (MS / Ph.D. Applications)' ? 'selected' : ''}>Higher Studies (MS / Ph.D. Applications)</option>
                      <option value="Campus Placement &amp; Job Applications" ${lor.purpose_of_lor === 'Campus Placement & Job Applications' ? 'selected' : ''}>Campus Placement &amp; Job Applications</option>
                      <option value="Academic Research Fellowship" ${lor.purpose_of_lor === 'Academic Research Fellowship' ? 'selected' : ''}>Academic Research Fellowship</option>
                      <option value="General Professional Recommendation" ${lor.purpose_of_lor === 'General Professional Recommendation' ? 'selected' : ''}>General Professional Recommendation</option>
                    </select>
                  </div>
                  <div class="form-group col-6">
                    <label class="form-label">Internship Start Date</label>
                    <input type="date" id="lor_start_date" class="form-control" value="${lor.internship_start_date || '2026-01-01'}">
                  </div>
                  <div class="form-group col-6">
                    <label class="form-label">Internship End Date</label>
                    <input type="text" id="lor_end_date" class="form-control" placeholder="e.g. Present or 2026-06-30" value="${lor.internship_end_date || 'Present'}">
                  </div>
                  <div class="form-group col-12">
                    <label class="form-label">Primary Project Title <span class="required">*</span></label>
                    <input type="text" id="lor_project_title" class="form-control" placeholder="e.g. Autonomous Ground Vehicle Navigation with ROS2" value="${window.UI.escapeHtml(lor.project_title || '')}" required>
                  </div>
                  <div class="form-group col-12">
                    <label class="form-label">Core Deliverables &amp; Research Contributions <span class="required">*</span></label>
                    <textarea id="lor_deliverables" class="form-control" rows="3" placeholder="Summarize your engineering deliverables, software modules developed, algorithms implemented, and contributions during the internship..." required>${window.UI.escapeHtml(lor.project_deliverables || '')}</textarea>
                  </div>
                </div>

                <!-- Professor Details Section -->
                <div style="border-top: 1px solid #E2E8F0; padding-top: 20px; margin-top: 20px;">
                  <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 6px;">
                    <h3 class="form-card-title" style="font-size: 1.05rem;">2. Designated Professor / Faculty Mentor Details</h3>
                  </div>
                  <p class="form-card-subtitle" style="margin-bottom: 20px;">
                    An official verification link will be emailed to your Professor from <strong>contact@puvima.com</strong> for academic endorsement.
                  </p>

                  <div class="form-grid">
                    <div class="form-group col-6">
                      <label class="form-label">Professor Full Name <span class="required">*</span></label>
                      <input type="text" id="lor_prof_name" class="form-control" placeholder="e.g. Dr. K. Rajesh Kumar" value="${window.UI.escapeHtml(lor.professor_name || '')}" required>
                    </div>
                    <div class="form-group col-6">
                      <label class="form-label">Professor Designation <span class="required">*</span></label>
                      <input type="text" id="lor_prof_designation" class="form-control" placeholder="e.g. Professor &amp; Head, Dept of CSE" value="${window.UI.escapeHtml(lor.professor_designation || '')}" required>
                    </div>
                    <div class="form-group col-6">
                      <label class="form-label">College / University / Institution <span class="required">*</span></label>
                      <input type="text" id="lor_prof_institution" class="form-control" placeholder="e.g. National Institute of Technology" value="${window.UI.escapeHtml(lor.professor_institution || '')}" required>
                    </div>
                    <div class="form-group col-6">
                      <label class="form-label">Professor Department</label>
                      <input type="text" id="lor_prof_department" class="form-control" placeholder="e.g. Department of Computer Science &amp; Engineering" value="${window.UI.escapeHtml(lor.professor_department || '')}">
                    </div>
                    <div class="form-group col-6">
                      <label class="form-label">Professor Official Email Address <span class="required">*</span></label>
                      <input type="email" id="lor_prof_email" class="form-control" placeholder="professor@university.edu" value="${window.UI.escapeHtml(lor.professor_email || '')}" required>
                      <span class="form-hint">Verification link will be emailed directly to this address.</span>
                    </div>
                    <div class="form-group col-6">
                      <label class="form-label">Professor Contact Mobile Number <span class="required">*</span></label>
                      <input type="tel" id="lor_prof_phone" class="form-control" placeholder="e.g. +91 9876543210" value="${window.UI.escapeHtml(lor.professor_phone || '')}" required>
                    </div>
                    <div class="form-group col-12">
                      <label class="form-label">Academic Relationship <span class="required">*</span></label>
                      <select id="lor_prof_rel" class="form-control" required>
                        <option value="Project Guide &amp; Supervisor">Project Guide &amp; Supervisor</option>
                        <option value="Faculty Advisor / Academic Mentor">Faculty Advisor / Academic Mentor</option>
                        <option value="Head of Department (HOD)">Head of Department (HOD)</option>
                        <option value="Dean of Academic Affairs">Dean of Academic Affairs</option>
                      </select>
                    </div>
                  </div>
                </div>

                <!-- Confirmation Alert Box -->
                <div class="onb-alert onb-alert-info" style="margin-top: 24px;">
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>
                  <div>
                    <strong>Verification Process:</strong> Upon confirmation, PUVIMA will automatically email your mentor with an endorsement link. Once confirmed by your professor, HR will verify and approve the issuance of your official Letter of Recommendation.
                  </div>
                </div>

                <!-- Submit Button -->
                <div class="form-card-footer" style="margin: 20px -24px -24px -24px; justify-content: flex-end;">
                  <button type="submit" id="btnSubmitLor" class="btn btn-primary btn-lg" style="background: #001D35; border-color: #001D35;">
                    Confirm &amp; Send LOR Request to Professor &rarr;
                  </button>
                </div>

              </form>
            </div>
          </div>

        </div>
      `;

      // Bind Submit Event
      const form = document.getElementById('formLorSubmit');
      if (form) {
        form.addEventListener('submit', async (e) => {
          e.preventDefault();
          const btn = document.getElementById('btnSubmitLor');
          btn.disabled = true;
          btn.innerHTML = 'Sending Email to Professor...';

          const payload = {
            intern_name: document.getElementById('lor_intern_name').value,
            intern_email: document.getElementById('lor_intern_email').value,
            domain_specialization: document.getElementById('lor_domain').value,
            college_university: document.getElementById('lor_college').value,
            department_branch: document.getElementById('lor_dept').value,
            purpose_of_lor: document.getElementById('lor_purpose').value,
            internship_start_date: document.getElementById('lor_start_date').value,
            internship_end_date: document.getElementById('lor_end_date').value,
            project_title: document.getElementById('lor_project_title').value,
            project_deliverables: document.getElementById('lor_deliverables').value,

            professor_name: document.getElementById('lor_prof_name').value,
            professor_designation: document.getElementById('lor_prof_designation').value,
            professor_institution: document.getElementById('lor_prof_institution').value,
            professor_department: document.getElementById('lor_prof_department').value,
            professor_email: document.getElementById('lor_prof_email').value,
            professor_phone: document.getElementById('lor_prof_phone').value,
            academic_relationship: document.getElementById('lor_prof_rel').value
          };

          try {
            const res = await fetch('/api/lor/request', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(payload)
            });

            const data = await res.json();
            if (!data.success) throw new Error(data.message || 'Submission failed.');

            currentLor = data.lor;
            alert('Success! LOR request submitted and verification email has been sent to Professor ' + payload.professor_name);
            this.renderStatusDashboard(container);
          } catch (err) {
            alert('Error: ' + err.message);
            btn.disabled = false;
            btn.innerHTML = 'Confirm &amp; Send LOR Request to Professor &rarr;';
          }
        });
      }
    },

    // 4. Render Active LOR Tracking Dashboard
    renderStatusDashboard(container) {
      const lor = currentLor;
      const st = (lor.status || 'Email Sent to Professor').trim();

      let bannerBg = 'linear-gradient(135deg, #001D35 0%, #003E7E 100%)';
      let statusColor = '#0284C7';
      let statusBadgeBg = '#E0F2FE';

      if (st === 'Confirmed by Professor') {
        statusColor = '#0B57D0';
        statusBadgeBg = '#E8F0FE';
      } else if (st === 'HR Approved' || st === 'LOR Issued') {
        statusColor = '#16A34A';
        statusBadgeBg = '#DCFCE7';
      }

      container.innerHTML = `
        <div style="display: flex; flex-direction: column; gap: 24px;">
          
          <!-- Top Record Ribbon -->
          <div class="card" style="background: ${bannerBg}; color: #FFFFFF; padding: 26px; border-radius: 12px; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 16px;">
            <div>
              <div style="font-size: 0.78rem; text-transform: uppercase; color: #94A3B8; letter-spacing: 0.5px;">Letter of Recommendation (LOR) Record</div>
              <h2 style="font-size: 1.45rem; font-weight: 800; color: #FFFFFF; margin: 4px 0;">
                ${window.UI.escapeHtml(lor.intern_name)}
              </h2>
              <div style="font-family: monospace; font-size: 0.95rem; background: rgba(255,255,255,0.15); padding: 4px 12px; border-radius: 4px; display: inline-block;">
                ID: ${lor.lor_request_id || 'PV-LOR-2026'}
              </div>
            </div>
            <div style="text-align: right;">
              <div style="font-size: 0.8rem; opacity: 0.85;">Current Stage</div>
              <div style="font-size: 1.05rem; font-weight: 800; padding: 6px 16px; border-radius: 9999px; display: inline-block; margin-top: 4px; background: ${statusBadgeBg}; color: ${statusColor};">
                ${st}
              </div>
            </div>
          </div>

          <!-- Stage-Specific Notification -->
          ${st === 'Email Sent to Professor' ? `
            <div class="onb-alert onb-alert-warning" style="margin: 0;">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 14 14"></polyline></svg>
              <div style="flex: 1;">
                <h4 style="font-size: 0.95rem; font-weight: 700; margin-bottom: 2px;">Verification Email Sent to Faculty Guide</h4>
                <p style="margin: 0; font-size: 0.85rem;">
                  An endorsement email was sent to <strong>${window.UI.escapeHtml(lor.professor_name)}</strong> at <code>${window.UI.escapeHtml(lor.professor_email)}</code>. Once confirmed, HR will verify and issue your final LOR.
                </p>
                <div style="display: flex; gap: 10px; margin-top: 12px;">
                  <button type="button" id="btnResendMail" class="btn btn-secondary btn-sm" style="font-size: 12px;">Resend Email</button>
                  <button type="button" id="btnCopyLink" class="btn btn-outline-primary btn-sm" style="font-size: 12px;">Copy Confirmation Link</button>
                </div>
              </div>
            </div>
          ` : ''}

          ${st === 'Confirmed by Professor' ? `
            <div class="onb-alert onb-alert-info" style="margin: 0;">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"></polyline></svg>
              <div style="flex: 1;">
                <h4 style="font-size: 0.95rem; font-weight: 700; margin-bottom: 2px;">Mentor Endorsement Confirmed!</h4>
                <p style="margin: 0; font-size: 0.85rem;">
                  <strong>Prof. ${window.UI.escapeHtml(lor.professor_name)}</strong> has officially endorsed your application (${lor.professor_rating || 'Strongly Recommended'}). Awaiting final sign-off from PUVIMA HR Operations.
                </p>
              </div>
            </div>
          ` : ''}

          ${(st === 'HR Approved' || st === 'LOR Issued') ? `
            <div class="onb-alert onb-alert-success" style="margin: 0; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 16px;">
              <div style="display: flex; align-items: center; gap: 12px;">
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#16A34A" stroke-width="2.5"><polyline points="20 6 9 17 4 12"></polyline></svg>
                <div>
                  <h4 style="font-size: 1.05rem; font-weight: 800; color: #166534; margin-bottom: 2px;">Official Letter of Recommendation Issued!</h4>
                  <p style="margin: 0; font-size: 0.85rem; color: #15803D;">Your document is officially signed by the Principal Consultant &amp; Director of Research.</p>
                </div>
              </div>
              <a href="/api/lor/${encodeURIComponent(lor.id)}/pdf" target="_blank" class="btn btn-success btn-lg" style="font-size: 13px; font-weight: 700;">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
                Download Official LOR (PDF)
              </a>
            </div>
          ` : ''}

          <!-- Two-Column Layout: Details + 4-Stage Timeline -->
          <div style="display: grid; grid-template-columns: 1.4fr 1fr; gap: 24px;">
            
            <!-- Left: Application Details -->
            <div class="form-card" style="margin: 0;">
              <div class="form-card-header">
                <h3 class="form-card-title">LOR Credentials &amp; Faculty Guide</h3>
                ${(st === 'HR Approved' || st === 'LOR Issued') ? `
                  <a href="/api/lor/${encodeURIComponent(lor.id)}/pdf" target="_blank" class="btn btn-secondary btn-sm">
                    View PDF
                  </a>
                ` : ''}
              </div>
              <div class="form-card-body">
                
                <table class="review-table" style="margin-bottom: 20px;">
                  <tr><th style="width: 35%;">Intern Name:</th><td>${window.UI.escapeHtml(lor.intern_name)}</td></tr>
                  <tr><th>Domain:</th><td>${window.UI.escapeHtml(lor.domain_specialization)}</td></tr>
                  <tr><th>College:</th><td>${window.UI.escapeHtml(lor.college_university)}</td></tr>
                  <tr><th>Project:</th><td>${window.UI.escapeHtml(lor.project_title)}</td></tr>
                  <tr><th>Purpose:</th><td>${window.UI.escapeHtml(lor.purpose_of_lor)}</td></tr>
                </table>

                <h4 style="font-size: 0.92rem; font-weight: 700; color: #001D35; margin-bottom: 10px;">
                  Nominated Faculty Mentor
                </h4>
                <table class="review-table">
                  <tr><th style="width: 35%;">Faculty Mentor:</th><td><strong>${window.UI.escapeHtml(lor.professor_name)}</strong></td></tr>
                  <tr><th>Designation:</th><td>${window.UI.escapeHtml(lor.professor_designation)}</td></tr>
                  <tr><th>Institution:</th><td>${window.UI.escapeHtml(lor.professor_institution)}</td></tr>
                  <tr><th>Email:</th><td><code>${window.UI.escapeHtml(lor.professor_email)}</code></td></tr>
                  <tr><th>Contact:</th><td>${window.UI.escapeHtml(lor.professor_phone)}</td></tr>
                  <tr>
                    <th>Endorsement Status:</th>
                    <td>
                      <span class="upload-status-badge ${lor.professor_confirmed_at ? 'status-badge-verified' : 'status-badge-pending'}">
                        ${lor.professor_confirmed_at ? 'Endorsed Online' : 'Awaiting Response'}
                      </span>
                    </td>
                  </tr>
                </table>

              </div>
              <div class="form-card-footer" style="justify-content: flex-end;">
                <button type="button" id="btnEditLor" class="btn btn-secondary btn-sm">
                  Update Mentor Information
                </button>
              </div>
            </div>

            <!-- Right: 4-Stage Visual Timeline -->
            <div class="form-card" style="margin: 0;">
              <div class="form-card-header">
                <h3 class="form-card-title">LOR Verification Timeline</h3>
              </div>
              <div class="form-card-body">
                <div class="timeline">
                  
                  <div class="timeline-item completed">
                    <div class="timeline-dot"></div>
                    <div class="timeline-content">
                      <h4>LOR Request Submitted</h4>
                      <p>${lor.created_at ? new Date(lor.created_at).toLocaleDateString() : 'Recorded'}</p>
                    </div>
                  </div>

                  <div class="timeline-item ${lor.email_sent_at ? 'completed' : ''}">
                    <div class="timeline-dot"></div>
                    <div class="timeline-content">
                      <h4>Email Dispatched to Professor</h4>
                      <p>${lor.email_sent_at ? new Date(lor.email_sent_at).toLocaleDateString() : 'Pending'}</p>
                    </div>
                  </div>

                  <div class="timeline-item ${lor.professor_confirmed_at ? 'completed' : ''}">
                    <div class="timeline-dot"></div>
                    <div class="timeline-content">
                      <h4>Faculty Mentor Endorsement</h4>
                      <p>${lor.professor_confirmed_at ? `Endorsed on ${new Date(lor.professor_confirmed_at).toLocaleDateString()}` : 'Awaiting Professor Confirmation'}</p>
                    </div>
                  </div>

                  <div class="timeline-item ${(st === 'HR Approved' || st === 'LOR Issued') ? 'completed' : ''}">
                    <div class="timeline-dot"></div>
                    <div class="timeline-content">
                      <h4>HR Approval &amp; LOR Issuance</h4>
                      <p>${lor.hr_verified_at ? `Approved on ${new Date(lor.hr_verified_at).toLocaleDateString()}` : 'Pending Final HR Clearance'}</p>
                    </div>
                  </div>

                </div>
              </div>
            </div>

          </div>

        </div>
      `;

      // Event: Edit LOR
      const editBtn = document.getElementById('btnEditLor');
      if (editBtn) {
        editBtn.addEventListener('click', () => {
          this.renderApplicationForm(container);
        });
      }

      // Event: Resend Email
      const resendBtn = document.getElementById('btnResendMail');
      if (resendBtn) {
        resendBtn.addEventListener('click', async () => {
          resendBtn.disabled = true;
          resendBtn.innerHTML = 'Sending...';
          try {
            const res = await fetch(`/api/lor/${lor.id}/resend-email`, { method: 'POST' });
            const data = await res.json();
            if (data.success) {
              alert('Verification email has been resent to ' + lor.professor_email);
            } else {
              alert('Error: ' + data.message);
            }
          } catch (e) {
            alert('Network error: ' + e.message);
          } finally {
            resendBtn.disabled = false;
            resendBtn.innerHTML = 'Resend Email';
          }
        });
      }

      // Event: Copy Confirmation Link
      const copyBtn = document.getElementById('btnCopyLink');
      if (copyBtn) {
        copyBtn.addEventListener('click', () => {
          const directLink = `${window.location.origin}/company/lorconfirm?token=${lor.verification_token}`;
          navigator.clipboard.writeText(directLink).then(() => {
            alert('Copied verification link to clipboard:\n' + directLink);
          }).catch(() => {
            prompt('Copy verification link:', directLink);
          });
        });
      }
    }
  };

})();

