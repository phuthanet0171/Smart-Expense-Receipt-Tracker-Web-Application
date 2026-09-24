import { AlertTriangle, CheckCircle2, X } from 'lucide-react';

export function Toast({ message, onClose }: { message: string; onClose: () => void }) {
  return <div className="toast" role="status"><CheckCircle2 size={20}/><span>{message}</span><button className="icon-button" onClick={onClose} aria-label="ปิดข้อความ"><X size={18}/></button></div>;
}

export function ConfirmDialog({ title, description, busy, onCancel, onConfirm }: { title: string; description: string; busy?: boolean; onCancel: () => void; onConfirm: () => void }) {
  return <div className="modal-backdrop" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget) onCancel(); }}><section className="dialog" role="alertdialog" aria-modal="true" aria-labelledby="dialog-title"><div className="dialog-icon"><AlertTriangle size={24}/></div><h2 id="dialog-title">{title}</h2><p>{description}</p><div className="dialog-actions"><button className="btn btn-secondary" onClick={onCancel} disabled={busy}>ยกเลิก</button><button className="btn btn-danger" onClick={onConfirm} disabled={busy}>{busy ? 'กำลังลบ…' : 'ลบรายการ'}</button></div></section></div>;
}
