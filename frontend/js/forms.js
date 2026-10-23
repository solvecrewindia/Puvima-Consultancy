


const API_BASE = (window.PUVIMA_CONFIG && window.PUVIMA_CONFIG.API_BASE_URL) || '';

export function initForms() {
  initContactForm();
  initBookingForm();
  initUnifiedContactTabs();
}


function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email).trim());
}


function initContactForm() {
  const form = document.getElementById('puvimaContactForm');
  const alertBox = document.getElementById('formAlertBox');
  const submitBtn = form ? form.querySelector('button[type="submit"]') : null;

  if (!form || !alertBox) return;

  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    const nameInput = document.getElementById('contactName');
    const emailInput = document.getElementById('contactEmail');
    const orgInput = document.getElementById('contactOrg');
    const subjectSelect = document.getElementById('contactSubject') || document.getElementById('contactNeeds');
    const messageInput = document.getElementById('contactMessage');

    let isValid = true;

    
    [nameInput, emailInput, messageInput].forEach(field => {
      if (field) {
        field.classList.remove('is-invalid');
        const err = field.parentElement.querySelector('.field-error');
        if (err) err.classList.remove('visible');
      }
    });
    alertBox.className = 'form-status-alert';
    alertBox.style.display = 'none';

    
    const nameVal = nameInput ? nameInput.value.trim() : '';
    if (!nameVal || nameVal.length < 2) {
      isValid = false;
      nameInput.classList.add('is-invalid');
      const err = nameInput.parentElement.querySelector('.field-error');
      if (err) err.classList.add('visible');
    }

    const emailVal = emailInput ? emailInput.value.trim() : '';
    if (!emailVal || !isValidEmail(emailVal)) {
      isValid = false;
      emailInput.classList.add('is-invalid');
      const err = emailInput.parentElement.querySelector('.field-error');
      if (err) err.classList.add('visible');
    }

    const messageVal = messageInput ? messageInput.value.trim() : '';
    if (!messageVal || messageVal.length < 5) {
      isValid = false;
      messageInput.classList.add('is-invalid');
      const err = messageInput.parentElement.querySelector('.field-error');
      if (err) err.classList.add('visible');
    }

    if (!isValid) {
      alertBox.className = 'form-status-alert error visible';
      alertBox.style.display = 'block';
      alertBox.textContent = 'Please fill out all required fields marked with an asterisk.';
      return;
    }

    
    const originalBtnText = submitBtn ? submitBtn.innerHTML : 'Submit Inquiry';
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.innerHTML = `
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="spin-loader" style="animation: spin-slow 1s linear infinite;">
          <circle cx="12" cy="12" r="10" stroke-opacity="0.25"></circle>
          <path d="M12 2a10 10 0 0 1 10 10" stroke-linecap="round"></path>
        </svg>
        <span>Transmitting to Advisory Desk...</span>
      `;
    }

    const payload = {
      name: nameVal,
      email: emailVal,
      company: orgInput ? orgInput.value.trim() : '',
      subject: subjectSelect ? subjectSelect.value : '',
      message: messageVal
    };

    try {
      const response = await fetch(`${API_BASE}/api/contact`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      const data = await response.json();

      if (response.ok && data.success) {
        
        alertBox.className = 'form-status-alert success visible';
        alertBox.style.display = 'block';
        alertBox.innerHTML = `
          <strong>Inquiry Successfully Received &amp; Logged.</strong><br>
          Reference ID: <code style="font-family: var(--font-mono); font-weight: 700; color: #FFFFFF;">${data.referenceId}</code><br>
          <span style="font-size: 0.85rem; margin-top: 4px; display: inline-block;">${data.message}</span>
        `;
        form.reset();
      } else {
        
        alertBox.className = 'form-status-alert error visible';
        alertBox.style.display = 'block';
        const msg = data.message || (data.errors ? data.errors.join(', ') : 'Unable to submit inquiry at this time.');
        alertBox.innerHTML = `<strong>Submission Notice:</strong> ${msg}`;
      }
    } catch (networkError) {
      
      alertBox.className = 'form-status-alert error visible';
      alertBox.style.display = 'block';
      alertBox.innerHTML = `
        <strong>Network Error:</strong> Could not establish connection to the PUVIMA API server.<br>
        Please verify the backend server is running on port 5000, or reach our advisory desk directly at 
        <a href="mailto:advisory@puvima.com" style="color: #FFFFFF; text-decoration: underline;">advisory@puvima.com</a>.
      `;
    } finally {
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.innerHTML = originalBtnText;
      }
    }
  });
}


function initBookingForm() {
  const bookingForm = document.getElementById('consultationBookingForm');
  if (!bookingForm) return;

  const modal = document.getElementById('bookingReceiptModal');
  const modalCloseBtn = document.getElementById('closeReceiptBtn');
  const submitBtn = bookingForm.querySelector('button[type="submit"]');
  const alertBox = document.getElementById('bookingAlertBox');
  const topicCards = document.querySelectorAll('.topic-choice-card');
  const formatPills = document.querySelectorAll('.format-option-pill');

  
  topicCards.forEach(card => {
    card.addEventListener('click', (e) => {
      const radio = card.querySelector('input[type="radio"]');
      if (radio) {
        radio.checked = true;
        topicCards.forEach(c => c.classList.remove('selected'));
        card.classList.add('selected');
      }
    });
  });

  
  formatPills.forEach(pill => {
    pill.addEventListener('click', () => {
      formatPills.forEach(p => p.classList.remove('active'));
      pill.classList.add('active');
      const radio = pill.querySelector('input[type="radio"]');
      if (radio) radio.checked = true;
    });
  });

  if (!bookingForm) return;

  bookingForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    const nameField = document.getElementById('bookName');
    const emailField = document.getElementById('bookEmail');
    const companyField = document.getElementById('bookCompany');
    const dateField = document.getElementById('bookDate');
    const timeField = document.getElementById('bookTime');
    const topicRadio = bookingForm.querySelector('input[name="consultationTopic"]:checked');
    const formatRadio = bookingForm.querySelector('input[name="meetingFormat"]:checked');
    const notesField = document.getElementById('bookNotes');

    let hasError = false;

    
    [nameField, emailField, companyField, dateField, timeField].forEach(field => {
      if (field) {
        field.classList.remove('is-invalid');
        const err = field.parentElement.querySelector('.field-error');
        if (err) err.classList.remove('visible');
      }
    });
    if (alertBox) {
      alertBox.className = 'form-status-alert';
      alertBox.style.display = 'none';
    }

    
    if (!nameField || !nameField.value.trim() || nameField.value.trim().length < 2) {
      hasError = true;
      if (nameField) {
        nameField.classList.add('is-invalid');
        const err = nameField.parentElement.querySelector('.field-error');
        if (err) err.classList.add('visible');
      }
    }

    
    if (!emailField || !emailField.value.trim() || !isValidEmail(emailField.value.trim())) {
      hasError = true;
      if (emailField) {
        emailField.classList.add('is-invalid');
        const err = emailField.parentElement.querySelector('.field-error');
        if (err) err.classList.add('visible');
      }
    }

    
    if (!dateField || !dateField.value) {
      hasError = true;
      if (dateField) {
        dateField.classList.add('is-invalid');
        const err = dateField.parentElement.querySelector('.field-error');
        if (err) err.classList.add('visible');
      }
    } else {
      const selectedDate = new Date(dateField.value);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      if (selectedDate < today) {
        hasError = true;
        dateField.classList.add('is-invalid');
        const err = dateField.parentElement.querySelector('.field-error');
        if (err) {
          err.textContent = 'Preferred consultation date cannot be in the past.';
          err.classList.add('visible');
        }
      }
    }

    
    if (!timeField || !timeField.value) {
      hasError = true;
      if (timeField) {
        timeField.classList.add('is-invalid');
        const err = timeField.parentElement.querySelector('.field-error');
        if (err) err.classList.add('visible');
      }
    }

    
    const selectedTopic = topicRadio ? topicRadio.value : 'Robotics & Autonomous Systems';

    if (hasError) {
      if (alertBox) {
        alertBox.className = 'form-status-alert error visible';
        alertBox.style.display = 'block';
        alertBox.textContent = 'Please correct the validation errors highlighted above.';
      }
      return;
    }

    
    const originalBtnText = submitBtn ? submitBtn.innerHTML : 'Submit Appointment Request';
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.innerHTML = `
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="animation: spin-slow 1s linear infinite;">
          <circle cx="12" cy="12" r="10" stroke-opacity="0.25"></circle>
          <path d="M12 2a10 10 0 0 1 10 10" stroke-linecap="round"></path>
        </svg>
        <span>Recording Request in Secure Ledger...</span>
      `;
    }

    const payload = {
      name: nameField.value.trim(),
      email: emailField.value.trim(),
      company: companyField ? companyField.value.trim() : '',
      topic: selectedTopic,
      preferredDate: dateField.value,
      preferredTime: timeField.value,
      meetingFormat: formatRadio ? formatRadio.value : 'Virtual Video Session (Zoom / Meet)',
      message: notesField ? notesField.value.trim() : ''
    };

    try {
      const response = await fetch(`${API_BASE}/api/bookings`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      const data = await response.json();

      if (response.ok && data.success) {
        
        const receiptIdEl = document.getElementById('receiptReqId');
        const receiptNameEl = document.getElementById('receiptName');
        const receiptEmailEl = document.getElementById('receiptEmail');
        const receiptCompanyEl = document.getElementById('receiptCompany');
        const receiptTopicEl = document.getElementById('receiptTopic');
        const receiptDateEl = document.getElementById('receiptDate');
        const receiptFormatEl = document.getElementById('receiptFormat');
        const receiptStatusEl = document.getElementById('receiptStatus');

        if (receiptIdEl) receiptIdEl.textContent = data.referenceId;
        if (receiptNameEl) receiptNameEl.textContent = payload.name;
        if (receiptEmailEl) receiptEmailEl.textContent = payload.email;
        if (receiptCompanyEl) receiptCompanyEl.textContent = payload.company || 'Direct Engagement';
        if (receiptTopicEl) receiptTopicEl.textContent = payload.topic;
        if (receiptDateEl) receiptDateEl.textContent = `${payload.preferredDate} (${payload.preferredTime})`;
        if (receiptFormatEl) receiptFormatEl.textContent = payload.meetingFormat;
        if (receiptStatusEl) receiptStatusEl.textContent = 'PENDING REVIEW';

        
        if (modal) {
          modal.classList.add('active');
          document.body.style.overflow = 'hidden';
        }
        bookingForm.reset();
        topicCards.forEach(c => c.classList.remove('selected'));
      } else {
        if (alertBox) {
          alertBox.className = 'form-status-alert error visible';
          alertBox.style.display = 'block';
          const msg = data.message || (data.errors ? data.errors.join(', ') : 'Unable to record request at this time.');
          alertBox.innerHTML = `<strong>Booking Request Notice:</strong> ${msg}`;
        }
      }
    } catch (networkErr) {
      if (alertBox) {
        alertBox.className = 'form-status-alert error visible';
        alertBox.style.display = 'block';
        alertBox.innerHTML = `
          <strong>Network Connectivity Notice:</strong> Could not reach the PUVIMA API endpoint.<br>
          Please ensure backend server is running on port 5000 or email your requested window to 
          <a href="mailto:advisory@puvima.com" style="color: #FFFFFF; text-decoration: underline;">advisory@puvima.com</a>.
        `;
      }
    } finally {
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.innerHTML = originalBtnText;
      }
    }
  });

  
  const closeModal = () => {
    if (modal) {
      modal.classList.remove('active');
      document.body.style.overflow = '';
    }
  };

  if (modalCloseBtn) {
    modalCloseBtn.addEventListener('click', closeModal);
  }

  if (modal) {
    modal.addEventListener('click', (e) => {
      if (e.target === modal) closeModal();
    });
  }

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && modal && modal.classList.contains('active')) {
      closeModal();
    }
  });
}

function initUnifiedContactTabs() {
  const tabsNav = document.querySelector('.unified-tabs-nav');
  if (!tabsNav) return;

  const tabButtons = tabsNav.querySelectorAll('.unified-tab-btn');
  const tabPanels = document.querySelectorAll('.unified-tab-panel');

  function switchTab(tabId) {
    tabButtons.forEach(btn => {
      const isActive = btn.dataset.tab === tabId;
      btn.classList.toggle('active', isActive);
      btn.setAttribute('aria-selected', isActive ? 'true' : 'false');
    });

    tabPanels.forEach(panel => {
      const isActive = panel.id === `tab-${tabId}`;
      panel.classList.toggle('active', isActive);
      panel.setAttribute('aria-hidden', isActive ? 'false' : 'true');
    });
  }

  tabButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      const tabId = btn.dataset.tab;
      switchTab(tabId);
      if (tabId === 'booking') {
        history.replaceState(null, '', '#booking');
      } else {
        history.replaceState(null, '', '#inquiry');
      }
    });
  });

  const checkHash = () => {
    const hash = window.location.hash.toLowerCase();
    const urlParams = new URLSearchParams(window.location.search);
    if (hash === '#booking' || hash === '#book' || hash === '#consultation' || urlParams.get('mode') === 'booking') {
      switchTab('booking');
    } else {
      switchTab('inquiry');
    }
  };

  checkHash();
  window.addEventListener('hashchange', checkHash);

  document.querySelectorAll('[data-switch-tab]').forEach(link => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      const targetTab = link.dataset.switchTab;
      switchTab(targetTab);
      window.location.hash = targetTab;
      const targetPanel = document.getElementById(`tab-${targetTab}`);
      if (targetPanel) {
        targetPanel.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    });
  });
}

if (typeof window !== 'undefined') {
  window.PUVIMA_FORMS = { initForms };
}
