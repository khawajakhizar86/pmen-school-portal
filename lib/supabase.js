import { createClient } from '@supabase/supabase-js';

// Only the public (anon) key is used in the browser. Row Level Security protects the data.
// NEVER put the service-role key in a VITE_* variable: Vite embeds those in the public bundle.
const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const isSupabaseConfigured = Boolean(url && anonKey);

export const supabase = createClient(url || 'http://localhost:54321', anonKey || 'missing-anon-key', {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false },
});

// Staff log in with Employee ID, students with Roll Number. Supabase Auth needs an email,
// so each ID maps to a deterministic internal address (never shown to users, no mail is sent).
export const STAFF_DOMAIN = import.meta.env.VITE_AUTH_EMAIL_DOMAIN_STAFF || 'staff.pmen-portal.app';
export const STUDENT_DOMAIN = import.meta.env.VITE_AUTH_EMAIL_DOMAIN_STUDENT || 'students.pmen-portal.app';

export function loginEmail(category, id) {
  const clean = String(id).trim().toLowerCase();
  return category === 'faculty' ? `${clean}@${STAFF_DOMAIN}` : `roll-${clean}@${STUDENT_DOMAIN}`;
}
