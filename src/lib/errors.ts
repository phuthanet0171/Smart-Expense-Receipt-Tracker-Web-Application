export function thaiError(error: unknown, fallback = 'เกิดข้อผิดพลาด กรุณาลองใหม่') {
  const message = error instanceof Error ? error.message : String(error || '');
  const rules: Array<[RegExp, string]> = [
    [/Invalid login credentials/i, 'อีเมลหรือรหัสผ่านไม่ถูกต้อง'],
    [/Email not confirmed/i, 'กรุณายืนยันอีเมลก่อนเข้าสู่ระบบ'],
    [/User already registered/i, 'อีเมลนี้ถูกสมัครไว้แล้ว'],
    [/Password should be at least|Password must be/i, 'รหัสผ่านต้องมีอย่างน้อย 8 ตัวอักษร'],
    [/New password should be different/i, 'รหัสผ่านใหม่ต้องไม่ซ้ำกับรหัสผ่านเดิม'],
    [/Auth session missing|JWT expired/i, 'เซสชันหมดอายุ กรุณาเข้าสู่ระบบอีกครั้ง'],
    [/Failed to fetch|NetworkError|fetch failed/i, 'เชื่อมต่อบริการไม่สำเร็จ กรุณาตรวจอินเทอร์เน็ตแล้วลองใหม่'],
    [/profiles.*does not exist|Could not find the table.*profiles/i, 'ยังไม่ได้อัปเกรดฐานข้อมูล กรุณารันไฟล์ migration ใน Supabase ก่อน'],
    [/duplicate key/i, 'ข้อมูลนี้มีอยู่แล้ว'],
  ];
  return rules.find(([pattern]) => pattern.test(message))?.[1] || message || fallback;
}
