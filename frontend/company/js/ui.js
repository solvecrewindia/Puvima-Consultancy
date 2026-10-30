/**
 * PUVIMA Consultancy — UI Toolkit & Component Helpers
 * Toasts, Modals, Spinners, Badges, and Formatters
 */

const UI = (function () {
  function escapeHtml(str) {
    if (str === null || str === undefined) return '';
    const div = document.createElement('div');
    div.textContent = String(str);
    return div.innerHTML;
  }

  function getInitials(name = '') {
    return (
      String(name)
        .trim()
        .split(/\s+/)
        .slice(0, 2)
        .map((p) => p[0]?.toUpperCase() || '')
        .join('') || '?'
    );
  }

  function formatDate(value) {
    if (!value) return '—';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '—';
    return new Intl.DateTimeFormat('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    }).format(date);
  }

  function formatDateTime(value) {
    if (!value) return '—';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '—';
    return new Intl.DateTimeFormat('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(date);
  }

  function formatFileSize(bytes) {
    if (!bytes || bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  }

  function getRoleBadge(role) {
    const r = String(role || '').toLowerCase();
    switch (r) {
      case 'superadmin':
        return '<span class="badge badge-violet">SuperAdmin</span>';
      case 'admin':
        return '<span class="badge badge-blue">Admin</span>';
      case 'hr':
        return '<span class="badge badge-amber">HR</span>';
      case 'employee':
        return '<span class="badge badge-emerald">Employee</span>';
      case 'intern':
        return '<span class="badge badge-slate">Intern</span>';
      default:
        return `<span class="badge badge-slate">${escapeHtml(role)}</span>`;
    }
  }

  function getStatusBadge(status) {
    const s = String(status || '').toLowerCase().replace(/_/g, ' ');
    switch (s) {
      case 'active':
      case 'in progress':
        return `<span class="badge badge-emerald">${escapeHtml(status)}</span>`;
      case 'published':
        return `<span class="badge badge-blue">${escapeHtml(status)}</span>`;
      case 'completed':
        return `<span class="badge badge-violet">${escapeHtml(status)}</span>`;
      case 'draft':
        return `<span class="badge badge-amber">${escapeHtml(status)}</span>`;
      case 'archived':
      case 'inactive':
        return `<span class="badge badge-rose">${escapeHtml(status)}</span>`;
      default:
        return `<span class="badge badge-slate">${escapeHtml(status)}</span>`;
    }
  }

  function showToast(title, message, type = 'info') {
    let container = document.getElementById('toastContainer');
    if (!container) {
      container = document.createElement('div');
      container.id = 'toastContainer';
      container.className = 'toast-container';
      document.body.appendChild(container);
    }

    const toast = document.createElement('div');
    toast.className = `toast ${type}`;

    const iconSvg =
      type === 'success'
        ? `<svg class="toast-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg>`
        : type === 'error'
        ? `<svg class="toast-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>`
        : `<svg class="toast-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>`;

    toast.innerHTML = `
      ${iconSvg}
      <div class="toast-content">
        <div class="toast-title">${escapeHtml(title)}</div>
        <div class="toast-message">${escapeHtml(message)}</div>
      </div>
    `;

    container.appendChild(toast);

    requestAnimationFrame(() => {
      toast.classList.add('show');
    });

    setTimeout(() => {
      toast.classList.remove('show');
      setTimeout(() => {
        if (toast.parentNode) {
          toast.parentNode.removeChild(toast);
        }
      }, 300);
    }, 4000);
  }

  function openModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
      modal.classList.add('show');
      document.body.style.overflow = 'hidden';
    }
  }

  function closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
      modal.classList.remove('show');
      document.body.style.overflow = '';
    }
  }

  function showLoading(text = 'Loading...') {
    let overlay = document.getElementById('loadingOverlay');
    if (!overlay) {
      overlay = document.createElement('div');
      overlay.id = 'loadingOverlay';
      overlay.className = 'loading-overlay';
      overlay.innerHTML = `
        <div class="spinner"></div>
        <div class="loading-text" id="loadingText">${escapeHtml(text)}</div>
      `;
      document.body.appendChild(overlay);
    } else {
      document.getElementById('loadingText').textContent = text;
    }
    overlay.classList.add('show');
  }

  function hideLoading() {
    const overlay = document.getElementById('loadingOverlay');
    if (overlay) {
      overlay.classList.remove('show');
    }
  }

  // Setup click-to-close for modals
  document.addEventListener('DOMContentLoaded', () => {
    document.querySelectorAll('.modal-backdrop').forEach((backdrop) => {
      backdrop.addEventListener('click', (e) => {
        if (e.target === backdrop) {
          closeModal(backdrop.id);
        }
      });
    });

    document.querySelectorAll('[data-close-modal]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const modalId = btn.getAttribute('data-close-modal');
        closeModal(modalId);
      });
    });
  });

  return {
    escapeHtml,
    getInitials,
    formatDate,
    formatDateTime,
    formatFileSize,
    getRoleBadge,
    getStatusBadge,
    showToast,
    openModal,
    closeModal,
    showLoading,
    hideLoading,
  };
})();

if (typeof window !== 'undefined') {
  window.UI = UI;
}
