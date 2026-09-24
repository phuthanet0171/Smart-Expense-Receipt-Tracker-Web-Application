import { createClient } from '@supabase/supabase-js';
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
export const supabase = url && key ? createClient(url, key) : null;
export const configIncomplete = Boolean(url) !== Boolean(key);
const demoModeKey = 'pocket-demo-mode';
export function isDemoMode() { return !supabase || (typeof window !== 'undefined' && localStorage.getItem(demoModeKey) === 'true'); }
export function startDemoMode() { localStorage.setItem(demoModeKey, 'true'); }
export function stopDemoMode() { localStorage.removeItem(demoModeKey); }
