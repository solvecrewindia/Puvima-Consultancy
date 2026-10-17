

const crypto = require('crypto');


function generateReferenceId(prefix = 'REQ') {
  const year = new Date().getFullYear();
  
  const charset = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
  const randomBytes = crypto.randomBytes(6);
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += charset[randomBytes[i] % charset.length];
  }
  return `PV-${prefix.toUpperCase()}-${year}-${code}`;
}


function hashIp(ip) {
  if (!ip) return null;
  return crypto.createHash('sha256').update(String(ip) + (process.env.IP_SALT || 'puvima-salt')).digest('hex').slice(0, 32);
}

module.exports = {
  generateReferenceId,
  hashIp
};
