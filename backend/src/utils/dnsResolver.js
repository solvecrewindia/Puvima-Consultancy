/**
 * Puvima IT Service and Research Consultancy — Resilient DNS Resolver Utility
 * Prevents intermittent Windows getaddrinfo EAI_AGAIN lookup failures
 * by attempting multi-tier resolution with known reliable fallback IPs.
 */

const dns = require('dns');

const KNOWN_HOSTS = {
  'imap.secureserver.net': '148.72.44.1',
  'smtpout.secureserver.net': '92.204.80.21',
  'imap.gmail.com': '142.251.2.108',
  'smtp.gmail.com': '142.251.2.108'
};

function withTimeout(promise, ms = 1500) {
  return Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error('DNS Timeout')), ms))
  ]);
}

async function resolveHostSafely(hostname) {
  if (!hostname) return hostname;
  let cleanHost = String(hostname).trim().toLowerCase();
  
  // Fix common user typo: securecerver -> secureserver
  cleanHost = cleanHost.replace(/securecerver\.net/gi, 'secureserver.net');

  // If already an IPv4 address, return as is
  if (/^(\d{1,3}\.){3}\d{1,3}$/.test(cleanHost)) {
    return cleanHost;
  }

  try {
    const results = await withTimeout(dns.promises.resolve4(cleanHost), 1500);
    if (results && results.length > 0) return results[0];
  } catch (err1) {
    try {
      const lookup = await withTimeout(dns.promises.lookup(cleanHost, { family: 4 }), 1500);
      if (lookup && lookup.address) return lookup.address;
    } catch (err2) {
      if (KNOWN_HOSTS[cleanHost]) {
        console.warn(`[DNS Resolver] Using resilient fallback for ${cleanHost} -> ${KNOWN_HOSTS[cleanHost]}`);
        return KNOWN_HOSTS[cleanHost];
      }
    }
  }

  return KNOWN_HOSTS[cleanHost] || cleanHost;
}

module.exports = {
  resolveHostSafely,
  KNOWN_HOSTS
};
