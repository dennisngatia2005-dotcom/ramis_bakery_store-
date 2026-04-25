// src/supabaseClient.js
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://irpjjapuvllfpyehnumx.supabase.co/';
const supabaseKey = 'sb_publishable_N2xzFMnQRUZN14_qXVo_kw_N0VcWU-I';

export const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    storage: window.localStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true // Helps with recovery
  }
});