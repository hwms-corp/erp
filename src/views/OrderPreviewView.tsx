import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'motion/react';
import { ArrowLeft, Printer, CheckCircle2, Edit } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useOrders } from '@/hooks/useOrders';
import { useAuth } from '@/hooks/useAuth';
import { doPrint } from '@/components/PrintStyles';
import { fmt, fmtW } from '@/types';
import type { OrderWithPartner, OrderItem, Company } from '@/types';

export function OrderPreviewView() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const printRef = useRef<HTMLDivElement>(null);
  const { fetchOrderItems, confirmOrder, confirmOrderWithItems } = useOrders();
  const { user } = useAuth();

  const [order, setOrder] = useState<OrderWithPartner | null>(null);
  const [items, setItems] = useState<OrderItem[]>([]);
  const [company, setCompany] = useState<Company | null>(null);
  const [creatorName, setCreatorName] = useState('');
  const [loading, setLoading] = useState(true);
  const [confirming, setConfirming] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [selectedItemIds, setSelectedItemIds] = useState<Set<number>>(new Set());
  const [confirmDocNo, setConfirmDocNo] = useState('');

  useEffect(() => {
    if (!id) return;
    const load = async () => {
      setLoading(true);

      const [orderRes, companyRes] = await Promise.all([
        supabase.from('v_orders_with_partner').select('*').eq('id', Number(id)).single(),
        supabase.from('company').select('*').single(),
      ]);

      if (orderRes.data) {
        setOrder(orderRes.data);
        const { data: itemData } = await fetchOrderItems(orderRes.data.id);
        if (itemData) setItems(itemData);

        const { data: userData } = await supabase
          .from('users')
          .select('name')
          .eq('id', orderRes.data.created_by)
          .single();
        if (userData) setCreatorName(userData.name);
      }
      if (companyRes.data) setCompany(companyRes.data);

      setLoading(false);
    };
    load();
  }, [id, fetchOrderItems]);

  const openConfirmModal = () => {
    setSelectedItemIds(new Set(items.map(i => i.id)));
    setConfirmDocNo(order?.doc_no ?? '');
    setShowConfirmModal(true);
  };

  const toggleItem = (itemId: number) => {
    setSelectedItemIds(prev => {
      const next = new Set(prev);
      if (next.has(itemId)) next.delete(itemId);
      else next.add(itemId);
      return next;
    });
  };

  const handleConfirm = async () => {
    if (!order || !user) return;
    if (selectedItemIds.size === 0) {
      alert('최소 1개 이상의 품목을 선택해주세요.');
      return;
    }
    if (!confirmDocNo.trim()) {
      alert('수주확인서 번호를 입력해주세요.');
      return;
    }

    const allSelected = selectedItemIds.size === items.length;
    setConfirming(true);

    if (allSelected) {
      const { error } = await confirmOrder(order.id);
      if (!error) {
        setOrder(prev => prev ? { ...prev, status: 'confirmed', delivery_status: 'pending' } : null);
        setShowConfirmModal(false);
      } else {
        alert('수주확정 실패: ' + (error.message || ''));
      }
    } else {
      const selectedItems = items.filter(i => selectedItemIds.has(i.id));
      const { error } = await confirmOrderWithItems(order.id, selectedItems, {
        doc_no: confirmDocNo.trim(),
        order_date: order.order_date,
        partner_id: order.partner_id,
        contact_person: order.contact_person,
        vessel: order.vessel,
        created_by: user.id,
      });
      if (!error) {
        alert('선택한 품목으로 수주확인서가 생성되었습니다.');
        navigate('/confirmed');
      } else {
        const msg = error.message || '';
        if (msg.includes('orders_doc_no_key') || msg.includes('duplicate key')) {
          alert(`이미 동일한 번호(${confirmDocNo.trim()})가 존재합니다. 다른 번호를 입력해주세요.`);
        } else {
          alert('수주확정 실패: ' + msg);
        }
      }
    }
    setConfirming(false);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin" />
      </div>
    );
  }

  if (!order) {
    return (
      <div className="text-center py-20">
        <p className="text-slate-400 text-lg">주문을 찾을 수 없습니다</p>
        <button onClick={() => navigate('/orders')} className="mt-4 text-indigo-600 hover:underline text-sm">목록으로 돌아가기</button>
      </div>
    );
  }

  const supplyAmount = order.supply_amount;
  const taxAmount = order.tax_amount;
  const totalAmount = order.total_amount;
  const docTitle = order.status === 'draft' ? '견 적 서' : '수 주 확 인 서';

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate(-1)} className="p-2 hover:bg-slate-100 rounded-lg transition-colors">
            <ArrowLeft className="w-5 h-5 text-slate-600" />
          </button>
          <h2 className="text-2xl font-bold text-slate-900">{docTitle.replace(/ /g, '')} 미리보기</h2>
        </div>
        <div className="flex gap-2">
          {order.status === 'draft' && (
            <>
              <button
                onClick={() => navigate(`/orders/${order.id}/edit`)}
                className="flex items-center gap-2 px-4 py-2 bg-amber-500 text-white rounded-lg hover:bg-amber-600 text-sm font-medium shadow-sm"
              >
                <Edit className="w-4 h-4" /> 수정
              </button>
              <button
                onClick={openConfirmModal}
                className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 text-sm font-medium shadow-sm"
              >
                <CheckCircle2 className="w-4 h-4" /> 수주확정
              </button>
            </>
          )}
          <button
            onClick={() => doPrint(printRef, `${order.doc_no}_${docTitle.replace(/ /g, '')}`)}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 text-sm font-medium shadow-sm"
          >
            <Printer className="w-4 h-4" /> 인쇄
          </button>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-8 max-w-4xl mx-auto">
        <div ref={printRef}>
          <div className="doc-title" style={{ fontSize: 22, fontWeight: 700, textAlign: 'center', marginBottom: 20, letterSpacing: 6 }}>
            {docTitle}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 20 }}>
            <table style={{ border: '1px solid #e2e8f0', borderCollapse: 'collapse', fontSize: 11, width: '100%' }}>
              <tbody>
                <tr><td colSpan={2} style={{ padding: '6px 10px', fontWeight: 600, color: '#334155', borderBottom: '1px solid #e2e8f0', background: '#f8fafc', textAlign: 'center', letterSpacing: 4 }}>수 신</td></tr>
                <tr><td style={{ padding: '5px 10px', color: '#64748b', width: 80 }}>거래처명</td><td style={{ padding: '5px 10px', textAlign: 'right', fontWeight: 500 }}>{order.partner_name}</td></tr>
                <tr><td style={{ padding: '5px 10px', color: '#64748b' }}>담당자</td><td style={{ padding: '5px 10px', textAlign: 'right' }}>{order.contact_person || '-'}</td></tr>
                <tr><td style={{ padding: '5px 10px', color: '#64748b' }}>Vessel.</td><td style={{ padding: '5px 10px', textAlign: 'right' }}>{order.vessel || '-'}</td></tr>
                <tr><td style={{ padding: '5px 10px', color: '#64748b' }}>견적번호</td><td style={{ padding: '5px 10px', textAlign: 'right' }}>{order.doc_no}</td></tr>
              </tbody>
            </table>

            <table style={{ border: '1px solid #e2e8f0', borderCollapse: 'collapse', fontSize: 11, width: '100%' }}>
              <tbody>
                <tr><td colSpan={2} style={{ padding: '6px 10px', fontWeight: 600, color: '#334155', borderBottom: '1px solid #e2e8f0', background: '#f8fafc', textAlign: 'center', letterSpacing: 4 }}>공 급</td></tr>
                {company && (
                  <>
                    <tr><td style={{ padding: '5px 10px', color: '#64748b', width: 80 }}>공급처명</td><td style={{ padding: '5px 10px', textAlign: 'right', fontWeight: 500 }}>{company.name}</td></tr>
                    <tr><td style={{ padding: '5px 10px', color: '#64748b' }}>담당자</td><td style={{ padding: '5px 10px', textAlign: 'right' }}>{creatorName || company.rep}</td></tr>
                    <tr><td style={{ padding: '5px 10px', color: '#64748b' }}>주소</td><td style={{ padding: '5px 10px', textAlign: 'right' }}>{company.addr || '-'}</td></tr>
                    <tr>
                      <td style={{ padding: '5px 10px', color: '#64748b', verticalAlign: 'top' }}>
                        전화번호
                        <br />
                        팩스번호
                      </td>
                      <td style={{ padding: '5px 10px', textAlign: 'right', verticalAlign: 'top' }}>
                        {(() => {
                          const lines = [company.tel, company.fax].filter(Boolean);
                          if (lines.length === 0) return '-';
                          return lines.map((v, i) => (
                            <span key={i} style={{ display: 'block' }}>{v}</span>
                          ));
                        })()}
                      </td>
                    </tr>
                  </>
                )}
              </tbody>
            </table>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', fontSize: 11, marginBottom: 10 }}>
            <span style={{ color: '#94a3b8' }}>일자: {order.order_date}</span>
          </div>

          <table style={{ borderCollapse: 'collapse', width: '100%', marginBottom: 14 }}>
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
              {items.map((item, i) => (
                <tr key={item.id}>
                  <td style={{ border: '1px solid #cbd5e1', padding: '6px 10px', fontSize: 11, textAlign: 'center' }}>{i + 1}</td>
                  <td style={{ border: '1px solid #cbd5e1', padding: '6px 10px', fontSize: 11 }}>{item.name}</td>
                  <td style={{ border: '1px solid #cbd5e1', padding: '6px 10px', fontSize: 11 }}>{item.spec}</td>
                  <td style={{ border: '1px solid #cbd5e1', padding: '6px 10px', fontSize: 11, textAlign: 'center' }}>{fmt(item.qty)}</td>
                  <td style={{ border: '1px solid #cbd5e1', padding: '6px 10px', fontSize: 11, textAlign: 'center' }}>{item.unit}</td>
                  <td style={{ border: '1px solid #cbd5e1', padding: '6px 10px', fontSize: 11, textAlign: 'right' }}>{fmt(item.price)}</td>
                  <td style={{ border: '1px solid #cbd5e1', padding: '6px 10px', fontSize: 11, textAlign: 'right' }}>{fmt(item.qty * item.price)}</td>
                  <td style={{ border: '1px solid #cbd5e1', padding: '6px 10px', fontSize: 11 }}>{item.remark}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <div style={{ textAlign: 'right', marginTop: 14 }}>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 20, padding: '3px 0', fontSize: 12 }}>
              <span style={{ color: '#94a3b8' }}>공급가액</span><span>{fmtW(supplyAmount)}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 20, padding: '3px 0', fontSize: 12 }}>
              <span style={{ color: '#94a3b8' }}>세액</span><span>{fmtW(taxAmount)}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 20, padding: '6px 0 3px', fontSize: 16, fontWeight: 700, borderTop: '2px solid #1e293b', marginTop: 3 }}>
              <span>합계</span><span>{fmtW(totalAmount)}</span>
            </div>
          </div>

          <div style={{ marginTop: 36, display: 'flex', justifyContent: 'flex-end', gap: 36 }}>
            <div style={{ textAlign: 'center', width: 70 }}>
              <div style={{ borderBottom: '1px solid #1e293b', height: 50 }} />
              <div style={{ fontSize: 9, color: '#64748b', marginTop: 3 }}>담당</div>
            </div>
            <div style={{ textAlign: 'center', width: 70 }}>
              <div style={{ borderBottom: '1px solid #1e293b', height: 50 }} />
              <div style={{ fontSize: 9, color: '#64748b', marginTop: 3 }}>승인</div>
            </div>
          </div>
        </div>
      </div>
      {showConfirmModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setShowConfirmModal(false)}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg mx-4 p-6 space-y-4" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-bold text-slate-900">수주확정 - 품목 선택</h3>
            <p className="text-sm text-slate-500">확정할 품목을 선택해주세요. 일부만 선택하면 별도의 수주확인서가 생성됩니다.</p>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">수주확인서 번호</label>
              <input
                type="text"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                value={confirmDocNo}
                onChange={e => setConfirmDocNo(e.target.value)}
                placeholder="수주확인서 번호"
              />
            </div>

            <div className="border border-slate-200 rounded-lg overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200">
                    <th className="w-10 p-2">
                      <input
                        type="checkbox"
                        checked={selectedItemIds.size === items.length}
                        onChange={() => {
                          if (selectedItemIds.size === items.length) setSelectedItemIds(new Set());
                          else setSelectedItemIds(new Set(items.map(i => i.id)));
                        }}
                        className="rounded border-slate-300"
                      />
                    </th>
                    <th className="text-left p-2 font-medium text-slate-600">품명</th>
                    <th className="text-left p-2 font-medium text-slate-600">사양</th>
                    <th className="text-center p-2 font-medium text-slate-600">수량</th>
                    <th className="text-right p-2 font-medium text-slate-600">금액</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map(item => (
                    <tr key={item.id} className="border-b border-slate-100 hover:bg-slate-50 cursor-pointer" onClick={() => toggleItem(item.id)}>
                      <td className="p-2 text-center">
                        <input
                          type="checkbox"
                          checked={selectedItemIds.has(item.id)}
                          onChange={() => toggleItem(item.id)}
                          onClick={e => e.stopPropagation()}
                          className="rounded border-slate-300"
                        />
                      </td>
                      <td className="p-2">{item.name}</td>
                      <td className="p-2 text-slate-500">{item.spec || '-'}</td>
                      <td className="p-2 text-center">{fmt(item.qty)} {item.unit}</td>
                      <td className="p-2 text-right">{fmt(item.qty * item.price)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="text-sm text-right text-slate-600">
              선택: {selectedItemIds.size} / {items.length}개
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <button onClick={() => setShowConfirmModal(false)} className="px-4 py-2 text-sm text-slate-600 hover:text-slate-800 border border-slate-300 rounded-lg">
                취소
              </button>
              <button
                onClick={handleConfirm}
                disabled={confirming || selectedItemIds.size === 0}
                className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 text-sm font-medium disabled:opacity-50"
              >
                <CheckCircle2 className="w-4 h-4" />
                {confirming ? '처리중...' : '수주확정'}
              </button>
            </div>
          </div>
        </div>
      )}
    </motion.div>
  );
}
