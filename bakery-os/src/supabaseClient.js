import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://irpjjapuvllfpyehnumx.supabase.co/';
const supabaseKey = 'sb_publishable_N2xzFMnQRUZN14_qXVo_kw_N0VcWU-I';

// 🔹 Add this helper to prevent the locking deadlock
const noOpLock = async (name, acquireTimeout, fn) => {
  return await fn();
};

export const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    storage : window.localStorage,
    lock: noOpLock, // 🚀 This bypasses the stuck lock issue
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true
  }
});
