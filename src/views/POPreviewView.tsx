import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { motion } from 'motion/react';
import { ArrowLeft, Printer, Copy, Check, Edit } from 'lucide-react';
import { doPrint } from '@/components/PrintStyles';
import { usePOs } from '@/hooks/usePOs';
import { supabase } from '@/lib/supabase';
import { fmt, fmtW, PAYMENT_TERMS_LABELS } from '@/types';
import type { POWithDetail, POItem, Company, Partner, PaymentTerms } from '@/types';

export function POPreviewView() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const printRef = useRef<HTMLDivElement>(null);
  const { fetchPOItems } = usePOs();

  const [po, setPo] = useState<POWithDetail | null>(null);
  const [items, setItems] = useState<POItem[]>([]);
  const [company, setCompany] = useState<Company | null>(null);
  const [partner, setPartner] = useState<Partner | null>(null);
  const [copied, setCopied] = useState(false);

  const handleCopyAccount = () => {
    if (!partner?.bank || !partner?.account) return;
    const text = `${partner.bank} ${partner.account}`;
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const load = useCallback(async () => {
    if (!id) return;

    const { data: poData } = await supabase
      .from('v_pos_with_detail')
      .select('*')
      .eq('id', Number(id))
      .single();
    if (poData) setPo(poData);

    const { data: itemData } = await fetchPOItems(Number(id));
    if (itemData) setItems(itemData);

    const { data: comp } = await supabase.from('company').select('*').single();
    if (comp) setCompany(comp);

    if (poData) {
      const { data: pt } = await supabase
        .from('partners')
        .select('*')
        .eq('id', poData.partner_id)
        .single();
      if (pt) setPartner(pt);
    }
  }, [id, fetchPOItems]);

  useEffect(() => { load(); }, [load]);

  if (!po || !company) {
    return (
      <div className="flex items-center justify-center py-20 text-slate-400">
        불러오는 중...
      </div>
    );
  }

  const supply = items.reduce((s, it) => s + it.qty * it.price, 0);
  const tax = Math.round(supply * 0.1);
  const total = supply + tax;

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate(-1)} className="p-2 hover:bg-slate-100 rounded-lg">
            <ArrowLeft className="w-5 h-5 text-slate-600" />
          </button>
          <h2 className="text-2xl font-bold text-slate-900">발주서 미리보기</h2>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => navigate(`/pos/${po.id}/edit`)}
            className="flex items-center gap-2 px-4 py-2 bg-amber-500 text-white rounded-xl text-sm font-medium hover:bg-amber-600"
          >
            <Edit className="w-4 h-4" /> 수정
          </button>
          <button
            onClick={() => doPrint(printRef, `발주서_${po.doc_no}`)}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-xl text-sm font-medium hover:bg-indigo-700"
          >
            <Printer className="w-4 h-4" /> 인쇄
          </button>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-8 max-w-4xl mx-auto">
        <div ref={printRef}>
          <div className="doc-title" style={{ fontSize: 22, fontWeight: 700, textAlign: 'center', marginBottom: 20, letterSpacing: 6 }}>
            발 주 서
          </div>

          <div className="doc-info-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 20 }}>
            <table style={{ border: '1px solid #e2e8f0', borderCollapse: 'collapse', fontSize: 11, width: '100%' }}>
              <tbody>
                <tr><td colSpan={2} style={{ padding: '6px 10px', fontWeight: 600, color: '#334155', borderBottom: '1px solid #e2e8f0', background: '#f8fafc', textAlign: 'center', letterSpacing: 4 }}>발주처 (공급받는자)</td></tr>
                <tr><td style={{ padding: '5px 10px', color: '#64748b', width: 80 }}>상호</td><td style={{ padding: '5px 10px', textAlign: 'right', fontWeight: 500 }}>{company.name}</td></tr>
                <tr><td style={{ padding: '5px 10px', color: '#64748b' }}>사업자번호</td><td style={{ padding: '5px 10px', textAlign: 'right' }}>{company.biz_no}</td></tr>
                <tr><td style={{ padding: '5px 10px', color: '#64748b' }}>대표자</td><td style={{ padding: '5px 10px', textAlign: 'right' }}>{company.rep}</td></tr>
                <tr><td style={{ padding: '5px 10px', color: '#64748b' }}>주소</td><td style={{ padding: '5px 10px', textAlign: 'right' }}>{company.addr || '-'}</td></tr>
                <tr><td style={{ padding: '5px 10px', color: '#64748b' }}>전화번호 / 팩스번호</td><td style={{ padding: '5px 10px', textAlign: 'right' }}>{[company.tel, company.fax].filter(Boolean).join(' / ') || '-'}</td></tr>
              </tbody>
            </table>

            <table style={{ border: '1px solid #e2e8f0', borderCollapse: 'collapse', fontSize: 11, width: '100%' }}>
              <tbody>
                <tr><td colSpan={2} style={{ padding: '6px 10px', fontWeight: 600, color: '#334155', borderBottom: '1px solid #e2e8f0', background: '#f8fafc', textAlign: 'center', letterSpacing: 4 }}>공급자</td></tr>
                {partner && (
                  <>
                    <tr><td style={{ padding: '5px 10px', color: '#64748b', width: 80 }}>상호</td><td style={{ padding: '5px 10px', textAlign: 'right', fontWeight: 500 }}>{partner.name}</td></tr>
                    <tr><td style={{ padding: '5px 10px', color: '#64748b' }}>사업자번호</td><td style={{ padding: '5px 10px', textAlign: 'right' }}>{partner.biz_no}</td></tr>
                    <tr><td style={{ padding: '5px 10px', color: '#64748b' }}>대표자</td><td style={{ padding: '5px 10px', textAlign: 'right' }}>{partner.rep}</td></tr>
                    <tr><td style={{ padding: '5px 10px', color: '#64748b' }}>주소</td><td style={{ padding: '5px 10px', textAlign: 'right' }}>{partner.addr || '-'}</td></tr>
                    <tr><td style={{ padding: '5px 10px', color: '#64748b' }}>전화번호</td><td style={{ padding: '5px 10px', textAlign: 'right' }}>{partner.tel || '-'}</td></tr>
                    {partner.bank && partner.account && (
                      <tr>
                        <td style={{ padding: '5px 10px', color: '#64748b' }}>입금계좌</td>
                        <td style={{ padding: '5px 10px', textAlign: 'right' }}>
                          <span
                            onClick={handleCopyAccount}
                            title="클릭하면 은행 + 계좌번호가 복사됩니다"
                            style={{ cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 4, color: '#4f46e5', fontWeight: 500 }}
                          >
                            {partner.bank} {partner.account}
                            {copied
                              ? <Check style={{ width: 12, height: 12, color: '#16a34a' }} />
                              : <Copy style={{ width: 12, height: 12 }} />
                            }
                          </span>
                        </td>
                      </tr>
                    )}
                  </>
                )}
              </tbody>
            </table>
          </div>

          <div style={{ fontSize: 11, marginBottom: 10, display: 'flex', gap: 24 }}>
            <span><strong>발주번호:</strong> {po.doc_no}</span>
            <span><strong>발주일:</strong> {po.po_date}</span>
            {po.required_date && <span><strong>납기요청:</strong> {po.required_date}</span>}
            <span><strong>결제조건:</strong> {PAYMENT_TERMS_LABELS[po.payment_terms as PaymentTerms] ?? po.payment_terms}</span>
          </div>

          <table style={{ borderCollapse: 'collapse', width: '100%', marginBottom: 10 }}>
            <thead>
              <tr>
                <th style={{ border: '1px solid #cbd5e1', padding: '6px 10px', fontSize: 11, background: '#334155', color: '#fff', fontWeight: 600, textAlign: 'center' }}>No</th>
                <th style={{ border: '1px solid #cbd5e1', padding: '6px 10px', fontSize: 11, background: '#334155', color: '#fff', fontWeight: 600 }}>품명</th>
                <th style={{ border: '1px solid #cbd5e1', padding: '6px 10px', fontSize: 11, background: '#334155', color: '#fff', fontWeight: 600 }}>사양</th>
                <th style={{ border: '1px solid #cbd5e1', padding: '6px 10px', fontSize: 11, background: '#334155', color: '#fff', fontWeight: 600, textAlign: 'center' }}>수량</th>
                <th style={{ border: '1px solid #cbd5e1', padding: '6px 10px', fontSize: 11, background: '#334155', color: '#fff', fontWeight: 600, textAlign: 'center' }}>단위</th>
                <th style={{ border: '1px solid #cbd5e1', padding: '6px 10px', fontSize: 11, background: '#334155', color: '#fff', fontWeight: 600, textAlign: 'right' }}>단가</th>
                <th style={{ border: '1px solid #cbd5e1', padding: '6px 10px', fontSize: 11, background: '#334155', color: '#fff', fontWeight: 600, textAlign: 'right' }}>금액</th>
                <th style={{ border: '1px solid #cbd5e1', padding: '6px 10px', fontSize: 11, background: '#334155', color: '#fff', fontWeight: 600 }}>비고</th>
              </tr>
            </thead>
            <tbody>
              {items.map((it, i) => (
                <tr key={it.id}>
                  <td style={{ border: '1px solid #cbd5e1', padding: '6px 10px', fontSize: 11, textAlign: 'center' }}>{i + 1}</td>
                  <td style={{ border: '1px solid #cbd5e1', padding: '6px 10px', fontSize: 11 }}>{it.name}</td>
                  <td style={{ border: '1px solid #cbd5e1', padding: '6px 10px', fontSize: 11 }}>{it.spec}</td>
                  <td style={{ border: '1px solid #cbd5e1', padding: '6px 10px', fontSize: 11, textAlign: 'center' }}>{fmt(it.qty)}</td>
                  <td style={{ border: '1px solid #cbd5e1', padding: '6px 10px', fontSize: 11, textAlign: 'center' }}>{it.unit}</td>
                  <td style={{ border: '1px solid #cbd5e1', padding: '6px 10px', fontSize: 11, textAlign: 'right' }}>{fmt(it.price)}</td>
                  <td style={{ border: '1px solid #cbd5e1', padding: '6px 10px', fontSize: 11, textAlign: 'right' }}>{fmt(it.qty * it.price)}</td>
                  <td style={{ border: '1px solid #cbd5e1', padding: '6px 10px', fontSize: 11 }}>{it.remark}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <div style={{ marginTop: 14, textAlign: 'right' }}>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 20, padding: '3px 0', fontSize: 12 }}>
              <span style={{ color: '#94a3b8' }}>공급가액</span><span>{fmt(supply)}원</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 20, padding: '3px 0', fontSize: 12 }}>
              <span style={{ color: '#94a3b8' }}>부가세</span><span>{fmt(tax)}원</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 20, padding: '3px 0', fontSize: 16, fontWeight: 700, borderTop: '2px solid #1e293b', paddingTop: 6, marginTop: 3 }}>
              <span>합계</span><span>{fmtW(total)}</span>
            </div>
          </div>

          {po.remark && (
            <div style={{ marginTop: 14, fontSize: 11, border: '1px solid #e2e8f0', padding: 8, borderRadius: 4 }}>
              <div style={{ fontWeight: 600, color: '#64748b', marginBottom: 4 }}>비고</div>
              <div style={{ whiteSpace: 'pre-wrap' }}>{po.remark}</div>
            </div>
          )}

          <div className="doc-stamp-area" style={{ marginTop: 36, display: 'flex', justifyContent: 'flex-end', gap: 36 }}>
            {['담당', '확인', '승인'].map(label => (
              <div key={label} style={{ textAlign: 'center', width: 70 }}>
                <div style={{ borderBottom: '1px solid #1e293b', height: 50 }} />
                <div style={{ fontSize: 9, color: '#64748b', marginTop: 3 }}>{label}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </motion.div>
  );
}
