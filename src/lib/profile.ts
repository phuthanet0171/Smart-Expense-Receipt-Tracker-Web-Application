import { isDemoMode, supabase } from './supabase';

export type Profile = { id: string; display_name: string; email: string; monthly_budget: number | null };

export async function getProfile(): Promise<Profile> {
  if (isDemoMode()) return { id: 'demo', display_name: localStorage.getItem('pocket-demo-name') || 'ผู้ใช้ทดลอง', email: 'โหมดทดลอง', monthly_budget: Number(localStorage.getItem('pocket-demo-budget')) || null };
  const { data: { user }, error: userError } = await supabase!.auth.getUser();
  if (userError || !user) throw new Error('กรุณาเข้าสู่ระบบอีกครั้ง');
  const { data, error } = await supabase!.from('profiles').select('id,display_name,monthly_budget').eq('id', user.id).maybeSingle();
  if (error && !['42P01', 'PGRST205'].includes(error.code || '')) throw error;
  return { id: user.id, display_name: data?.display_name || user.user_metadata.display_name || 'ผู้ใช้งาน', email: user.email || '', monthly_budget: data?.monthly_budget ? Number(data.monthly_budget) : null };
}

export async function updateProfile(displayName: string, monthlyBudget: number | null) {
  const cleaned = displayName.trim();
  if (cleaned.length < 2 || cleaned.length > 60) throw new Error('ชื่อที่แสดงต้องมี 2–60 ตัวอักษร');
  if (monthlyBudget !== null && (!Number.isFinite(monthlyBudget) || monthlyBudget <= 0)) throw new Error('งบประมาณต้องมากกว่า 0 บาท');
  if (isDemoMode()) { localStorage.setItem('pocket-demo-name', cleaned); if (monthlyBudget) localStorage.setItem('pocket-demo-budget', String(monthlyBudget)); else localStorage.removeItem('pocket-demo-budget'); window.dispatchEvent(new Event('pocket-profile-updated')); return; }
  const { data: { user }, error: userError } = await supabase!.auth.getUser();
  if (userError || !user) throw new Error('กรุณาเข้าสู่ระบบอีกครั้ง');
  const { error } = await supabase!.from('profiles').upsert({ id: user.id, display_name: cleaned, monthly_budget: monthlyBudget, updated_at: new Date().toISOString() });
  if (error) throw error;
  const { error: metadataError } = await supabase!.auth.updateUser({ data: { display_name: cleaned } });
  if (metadataError) throw metadataError;
  window.dispatchEvent(new Event('pocket-profile-updated'));
}

export async function updateEmail(email: string) {
  if (!supabase || isDemoMode()) throw new Error('ฟังก์ชันนี้ใช้ได้หลังเข้าสู่ระบบ');
  const { error } = await supabase.auth.updateUser({ email: email.trim() });
  if (error) throw error;
}

export async function updatePassword(password: string) {
  if (!supabase || isDemoMode()) throw new Error('ฟังก์ชันนี้ใช้ได้หลังเข้าสู่ระบบ');
  if (password.length < 8) throw new Error('รหัสผ่านต้องมีอย่างน้อย 8 ตัวอักษร');
  const { error } = await supabase.auth.updateUser({ password });
  if (error) throw error;
}
