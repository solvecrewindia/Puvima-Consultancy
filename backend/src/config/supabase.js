/**
 * Puvima IT Service and Research Consultancy — Supabase Client Configuration
 * Project: jarrtmqdhfcijarbuntl (https://supabase.com/dashboard/project/jarrtmqdhfcijarbuntl)
 */

const path = require('path');
if (!process.env.SUPABASE_KEY) {
  require('dotenv').config({ path: path.join(__dirname, '../../.env') });
  require('dotenv').config({ path: path.resolve(process.cwd(), '.env') });
  require('dotenv').config({ path: path.resolve(process.cwd(), 'backend/.env') });
}

const { createClient } = require('@supabase/supabase-js');

const dns = require('dns');
const { URL } = require('url');

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.SUPABASE_UR || 'https://jarrtmqdhfcijarbuntl.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || 'sb_publishable_RXvkWbFuePqt-QdXDt1jzA_sxiJo4ZR';

let client = null;
let isConnected = false;
let lastError = null;
let lastCheckTime = 0;
const CHECK_CACHE_MS = 60000; // 1 minute cache for DNS check

async function verifyDns(urlStr) {
  try {
    const parsed = new URL(urlStr);
    return await new Promise((resolve) => {
      const timer = setTimeout(() => resolve(false), 800);
      dns.lookup(parsed.hostname, (err) => {
        clearTimeout(timer);
        resolve(!err);
      });
    });
  } catch (e) {
    return false;
  }
}

function getSupabaseClient() {
  // If connection has been determined dead or unresolvable, avoid blocking calls
  if (!isConnected && lastCheckTime > 0) return null;
  if (client) return client;
  if (!SUPABASE_KEY || !SUPABASE_URL) {
    lastError = 'SUPABASE_KEY is not defined in backend/.env';
    return null;
  }

  try {
    client = createClient(SUPABASE_URL, SUPABASE_KEY, {
      auth: {
        persistSession: false,
        autoRefreshToken: false
      }
    });
    return client;
  } catch (err) {
    lastError = err.message;
    console.error('[Supabase] Client creation error:', err.message);
    return null;
  }
}

async function testConnection(force = false) {
  const now = Date.now();
  if (!force && lastCheckTime > 0 && (now - lastCheckTime < CHECK_CACHE_MS)) {
    return { isConnected, message: isConnected ? 'Supabase connection active.' : lastError };
  }
  lastCheckTime = now;

  if (!SUPABASE_KEY || !SUPABASE_URL) {
    isConnected = false;
    lastError = 'Supabase credentials not configured';
    return { isConnected: false, message: lastError };
  }

  // Fast DNS check to avoid hanging on expired or dead hosts (prevents 7-second timeouts)
  const dnsOk = await verifyDns(SUPABASE_URL);
  if (!dnsOk) {
    isConnected = false;
    client = null;
    lastError = `Supabase host DNS unresolvable (${SUPABASE_URL})`;
    return { isConnected: false, message: lastError };
  }

  const sb = getSupabaseClient();
  if (!sb) {
    isConnected = false;
    return { isConnected: false, message: lastError || 'Supabase client unavailable' };
  }

  try {
    // 2-second timeout for query check
    const queryPromise = sb.from('site_settings').select('id').limit(1);
    const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error('Supabase ping timeout')), 2000));
    const { error } = await Promise.race([queryPromise, timeoutPromise]);

    if (error && error.code !== 'PGRST116') {
      if (error.message && (error.message.includes('relation "public.site_settings" does not exist') || error.message.includes('Could not find the table') || error.message.includes('schema cache'))) {
        isConnected = true;
        lastError = null;
        return { isConnected: true, tablesCreated: false, message: 'Connected to Supabase project, schema pending.' };
      }
      isConnected = false;
      client = null;
      lastError = error.message;
      return { isConnected: false, message: `Supabase query error: ${error.message}` };
    }

    isConnected = true;
    lastError = null;
    return { isConnected: true, message: 'Supabase connection established successfully.' };
  } catch (err) {
    isConnected = false;
    client = null;
    lastError = err.message;
    return { isConnected: false, message: `Supabase connection error: ${err.message}` };
  }
}

module.exports = {
  getSupabaseClient,
  testConnection,
  get isConnected() {
    return isConnected;
  },
  get lastError() {
    return lastError;
  },
  SUPABASE_URL
};
