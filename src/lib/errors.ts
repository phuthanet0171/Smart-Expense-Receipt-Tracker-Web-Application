export function thaiError(error: unknown, fallback = 'เกิดข้อผิดพลาด กรุณาลองใหม่') {
  const record = error && typeof error === 'object' ? error as Record<string, unknown> : null;
  const message = error instanceof Error
    ? error.message
    : record
      ? [record.message, record.details, record.hint, record.error_description, record.code].filter(value => typeof value === 'string' && value.trim()).join(' — ')
      : typeof error === 'string' ? error : '';
  const rules: Array<[RegExp, string]> = [
    [/Invalid login credentials/i, 'อีเมลหรือรหัสผ่านไม่ถูกต้อง'],
    [/Email not confirmed/i, 'กรุณายืนยันอีเมลก่อนเข้าสู่ระบบ'],
    [/User already registered/i, 'อีเมลนี้ถูกสมัครไว้แล้ว'],
    [/Password should be at least|Password must be/i, 'รหัสผ่านต้องมีอย่างน้อย 8 ตัวอักษร'],
    [/New password should be different/i, 'รหัสผ่านใหม่ต้องไม่ซ้ำกับรหัสผ่านเดิม'],
    [/Auth session missing|JWT expired/i, 'เซสชันหมดอายุ กรุณาเข้าสู่ระบบอีกครั้ง'],
    [/Failed to fetch|NetworkError|fetch failed/i, 'เชื่อมต่อบริการไม่สำเร็จ กรุณาตรวจอินเทอร์เน็ตแล้วลองใหม่'],
    [/profiles.*does not exist|Could not find the table.*profiles/i, 'ยังไม่ได้อัปเกรดฐานข้อมูล กรุณารันไฟล์ migration ใน Supabase ก่อน'],
    [/receipts.*does not exist|receipt_items.*does not exist|Could not find the table.*receipts|Could not find the table.*receipt_items|save_receipt_analysis|PGRST202|schema cache/i, 'ยังไม่ได้ติดตั้งหรือรีเฟรชฐานข้อมูลใบเสร็จ กรุณารันไฟล์ 20260925_receipt_intelligence.sql ใน Supabase SQL Editor แล้วรอสักครู่ก่อนลองใหม่'],
    [/row-level security|violates row-level security|42501/i, 'ไม่มีสิทธิ์บันทึกข้อมูลนี้ กรุณาออกจากระบบแล้วเข้าสู่ระบบใหม่'],
    [/check constraint|23514|invalid input syntax/i, 'ข้อมูลบางช่องมีรูปแบบไม่ถูกต้อง กรุณาตรวจยอด วันที่ และรายละเอียดใบเสร็จอีกครั้ง'],
    [/duplicate key/i, 'ข้อมูลนี้มีอยู่แล้ว'],
  ];
  return rules.find(([pattern]) => pattern.test(message))?.[1] || message || fallback;
}
