/**
 * PUVIMA Consultancy — Supabase Client Configuration
 * Project: jarrtmqdhfcijarbuntl (https://supabase.com/dashboard/project/jarrtmqdhfcijarbuntl)
 */

const path = require('path');
if (!process.env.SUPABASE_KEY) {
  require('dotenv').config({ path: path.join(__dirname, '../../.env') });
}

const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://jarrtmqdhfcijarbuntl.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || '';

let client = null;
let isConnected = false;
let lastError = null;

function getSupabaseClient() {
  if (client) return client;
  if (!SUPABASE_KEY) {
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

async function testConnection() {
  const sb = getSupabaseClient();
  if (!sb) {
    return {
      isConnected: false,
      message: lastError || 'Supabase credentials not configured'
    };
  }

  try {
    // Attempt lightweight ping to contact_enquiries or site_settings
    const { data, error } = await sb.from('site_settings').select('id').limit(1);
    if (error && error.code !== 'PGRST116') {
      // If table doesn't exist yet, but connection authenticated
      if (error.message && (error.message.includes('relation "public.site_settings" does not exist') || error.message.includes('Could not find the table') || error.message.includes('schema cache'))) {
        isConnected = true;
        return {
          isConnected: true,
          tablesCreated: false,
          message: 'Connected to Supabase project, but schema tables are not yet created. Please run database/supabase_schema.sql in the Supabase SQL Editor.'
        };
      }
      isConnected = false;
      lastError = error.message;
      return { isConnected: false, message: `Supabase query error: ${error.message}` };
    }

    isConnected = true;
    lastError = null;
    return { isConnected: true, message: 'Supabase connection established successfully.' };
  } catch (err) {
    isConnected = false;
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
