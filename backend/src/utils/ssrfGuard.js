/**
 * PUVIMA Consultancy — Server-Side Request Forgery (SSRF) Guard
 * Validates outgoing hostnames and IPs against private networks,
 * loopback, link-local, and cloud metadata endpoints (AWS, GCP, Azure, DigitalOcean).
 */

const dns = require('dns').promises;
const net = require('net');

// Cloud metadata and forbidden hostnames
const FORBIDDEN_HOSTNAMES = new Set([
  'localhost',
  '127.0.0.1',
  '0.0.0.0',
  '::1',
  'metadata.google.internal',
  'metadata.goog',
  'instance-data',
  '169.254.169.254'
]);

/**
 * Checks whether an IP address belongs to private, loopback, or link-local ranges
 * @param {string} ip 
 * @returns {boolean}
 */
function isPrivateOrBlockedIP(ip) {
  if (!ip || typeof ip !== 'string') return true;

  // IPv4 check
  if (net.isIPv4(ip)) {
    const parts = ip.split('.').map(p => parseInt(p, 10));
    if (parts.length !== 4 || parts.some(isNaN)) return true;

    // Loopback: 127.0.0.0/8
    if (parts[0] === 127) return true;

    // 0.0.0.0/8
    if (parts[0] === 0) return true;

    // Private Class A: 10.0.0.0/8
    if (parts[0] === 10) return true;

    // Link-local & Cloud Metadata: 169.254.0.0/16
    if (parts[0] === 169 && parts[1] === 254) return true;

    // Private Class B: 172.16.0.0/12 (172.16.0.0 - 172.31.255.255)
    if (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) return true;

    // Private Class C: 192.168.0.0/16
    if (parts[0] === 192 && parts[1] === 168) return true;

    // Broadcast: 255.255.255.255
    if (parts[0] === 255 && parts[1] === 255 && parts[2] === 255 && parts[3] === 255) return true;

    return false;
  }

  // IPv6 check
  if (net.isIPv6(ip)) {
    const norm = ip.toLowerCase();
    // Loopback
    if (norm === '::1' || norm === '0:0:0:0:0:0:0:1') return true;
    // Unspecified
    if (norm === '::' || norm === '0:0:0:0:0:0:0:0') return true;
    // Unique local: fc00::/7 or fd00::/8
    if (norm.startsWith('fc') || norm.startsWith('fd')) return true;
    // Link-local: fe80::/10
    if (norm.startsWith('fe8') || norm.startsWith('fe9') || norm.startsWith('fea') || norm.startsWith('feb')) return true;
    // IPv4-mapped IPv6
    if (norm.startsWith('::ffff:')) {
      const v4 = norm.replace('::ffff:', '');
      return isPrivateOrBlockedIP(v4);
    }
  }

  return false;
}

/**
 * Validates an outbound destination hostname or IP against SSRF vulnerabilities
 * @param {string} host 
 * @returns {Promise<{ allowed: boolean, valid: boolean, reason?: string, resolvedIp?: string }>}
 */
async function validateOutboundHost(host) {
  if (!host || typeof host !== 'string') {
    return { allowed: false, valid: false, reason: 'Empty host descriptor' };
  }

  const cleanHost = host.trim().toLowerCase().split(':')[0]; // Strip port

  // 1. Direct blocklist check
  if (FORBIDDEN_HOSTNAMES.has(cleanHost)) {
    return { allowed: false, valid: false, reason: 'Direct loopback/metadata host is forbidden' };
  }

  // 2. Direct IP check
  if (net.isIP(cleanHost)) {
    if (isPrivateOrBlockedIP(cleanHost)) {
      return { allowed: false, valid: false, reason: 'Private or local IP ranges are blocked' };
    }
    return { allowed: true, valid: true, resolvedIp: cleanHost };
  }

  // 3. DNS Resolution check (prevent DNS rebinding to internal network)
  try {
    const addresses = await dns.lookup(cleanHost, { all: true });
    for (const addr of addresses) {
      if (isPrivateOrBlockedIP(addr.address)) {
        return {
          allowed: false,
          valid: false,
          reason: `Host ${cleanHost} resolves to internal IP ${addr.address}`
        };
      }
    }
    return { allowed: true, valid: true, resolvedIp: addresses[0]?.address };
  } catch (err) {
    // If hostname cannot be resolved, reject
    return { allowed: false, valid: false, reason: `DNS lookup failed: ${err.message}` };
  }
}

module.exports = {
  isPrivateOrBlockedIP,
  isPrivateOrReservedIp: isPrivateOrBlockedIP,
  validateOutboundHost,
  FORBIDDEN_HOSTNAMES
};
