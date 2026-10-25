/**
 * PUVIMA Consultancy — Frontend API & Runtime Configuration
 * 
 * If frontend and backend are deployed as two separate Vercel projects:
 * Set your backend Vercel URL here or via localStorage.setItem('puvima_api_base_url', 'https://...').
 * If left empty (''), API calls use relative same-origin paths.
 */
(function () {
  'use strict';

  var storedUrl = '';
  try {
    storedUrl = localStorage.getItem('puvima_api_base_url') || '';
    if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
      if (storedUrl && storedUrl.includes('vercel.app')) {
        storedUrl = '';
        localStorage.removeItem('puvima_api_base_url');
      }
    }
  } catch (e) {}

  var currentConfig = window.PUVIMA_CONFIG || {};
  var configuredUrl = currentConfig.API_BASE_URL || '';

  window.PUVIMA_CONFIG = {
    API_BASE_URL: (storedUrl || configuredUrl || '').replace(/\/+$/, '')
  };
})();
