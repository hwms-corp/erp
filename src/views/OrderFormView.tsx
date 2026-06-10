import { useState, useEffect, useCallback } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { motion } from 'motion/react';
import { ArrowLeft, Search, Save } from 'lucide-react';
import { useOrders } from '@/hooks/useOrders';
import { usePartners } from '@/hooks/usePartners';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/lib/supabase';
import { PartnerSearchModal } from '@/components/PartnerSearchModal';
import { MaterialEditor } from '@/components/MaterialEditor';
import { today, emptyMaterialLine, fmtW } from '@/types';
import type { Partner, MaterialLine, OrderStatus } from '@/types';

const inp = 'w-full px-3 py-2 border border-slate-300 rounded-lg text-sm outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500';

export function OrderFormView() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const fromConfirmed = searchParams.get('from') === 'confirmed';
  const fromDelivery = searchParams.get('from') === 'delivery';
  const isEdit = Boolean(id);
  const { user } = useAuth();
  const { createOrder, updateOrder, fetchOrderItems, getConfirmedOrderEditBlockReason } = useOrders();
  const { partners, fetchPartners } = usePartners();
  const [docNo, setDocNo] = useState('');
  const [orderDate, setOrderDate] = useState(today);
  const [contactPerson, setContactPerson] = useState('');
  const [vessel, setVessel] = useState('');
  const [selectedPartner, setSelectedPartner] = useState<Partner | null>(null);
  const [lines, setLines] = useState<MaterialLine[]>([emptyMaterialLine()]);
  const [showPartnerModal, setShowPartnerModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [loadingEdit, setLoadingEdit] = useState(false);
  const [orderStatus, setOrderStatus] = useState<OrderStatus | null>(null);
  const [editBlocked, setEditBlocked] = useState(false);

  const isConfirmedEdit = isEdit && orderStatus === 'confirmed';

  useEffect(() => { fetchPartners(); }, [fetchPartners]);

  const loadOrder = useCallback(async (orderId: string) => {
    setLoadingEdit(true);
    const { data: order } = await supabase
      .from('v_orders_with_partner')
      .select('*')
      .eq('id', Number(orderId))
      .single();

    if (order) {
      setOrderStatus(order.status);
      setDocNo(order.doc_no);
      setOrderDate(order.order_date);
      setContactPerson(order.contact_person || '');
      setVessel(order.vessel || '');

      const { data: partnerData } = await supabase
        .from('partners')
        .select('*')
        .eq('id', order.partner_id)
        .single();
      if (partnerData) setSelectedPartner(partnerData);

      const { data: itemData } = await fetchOrderItems(order.id);
      if (itemData && itemData.length > 0) {
        setLines(itemData.map(it => ({
          name: it.name,
          spec: it.spec ?? '',
          qty: it.qty,
          unit: it.unit,
          price: it.price,
          remark: it.remark ?? '',
        })));
      }

      if (order.status === 'confirmed' && !fromDelivery) {
        const blockReason = await getConfirmedOrderEditBlockReason(order.id);
        if (blockReason) {
          setError(blockReason);
          setEditBlocked(true);
        } else {
          setEditBlocked(false);
        }
      } else {
        setEditBlocked(false);
      }
    }
    setLoadingEdit(false);
  }, [fetchOrderItems, getConfirmedOrderEditBlockReason, fromDelivery]);

  useEffect(() => {
    if (id) loadOrder(id);
  }, [id, loadOrder]);

  const salesPartners = partners.filter(p => p.type === 'sales' || p.type === 'both');

  const supplyAmount = lines.reduce((s, l) => s + l.qty * l.price, 0);
  const taxAmount = Math.floor(supplyAmount * 0.1);
  const totalAmount = supplyAmount + taxAmount;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!docNo.trim()) { setError('견적번호를 입력해주세요.'); return; }
    if (!selectedPartner) { setError('거래처를 선택해주세요.'); return; }
    if (!user) { setError('로그인이 필요합니다.'); return; }

    const validLines = lines.filter(l => l.name.trim());
    if (validLines.length === 0) { setError('최소 1개 이상의 품목을 입력해주세요.'); return; }

    if (isEdit && id && orderStatus === 'confirmed' && !fromDelivery) {
      const blockReason = await getConfirmedOrderEditBlockReason(Number(id));
      if (blockReason) {
        setError(blockReason);
        return;
      }
    }

    setSaving(true);

    if (isEdit && id) {
      const { error: updateErr } = await updateOrder(
        Number(id),
        { doc_no: docNo.trim(), order_date: orderDate, partner_id: selectedPartner.id, contact_person: contactPerson.trim() || null, vessel: vessel.trim() || null },
        validLines,
      );
      setSaving(false);
      if (updateErr) {
        const msg = typeof updateErr === 'object' && updateErr !== null && 'message' in updateErr
          ? (updateErr as { message: string }).message : '';
        setError(msg || (isConfirmedEdit ? '수주 수정에 실패했습니다.' : '견적서 수정에 실패했습니다.'));
        return;
      }
      if (fromDelivery) {
        navigate('/delivery');
      } else if (isConfirmedEdit || fromConfirmed) {
        navigate('/confirmed');
      } else {
        navigate(`/orders/${id}/preview`);
      }
    } else {
      const { error: createErr } = await createOrder(
        { doc_no: docNo.trim(), order_date: orderDate, partner_id: selectedPartner.id, contact_person: contactPerson.trim() || null, vessel: vessel.trim() || null, created_by: user.id },
        validLines,
      );
      setSaving(false);
      if (createErr) {
        const msg = typeof createErr === 'object' && createErr !== null && 'message' in createErr
          ? (createErr as { message: string }).message : '';
        if (msg.includes('orders_doc_no_key') || msg.includes('duplicate key')) {
          setError(`이미 동일한 견적번호(${docNo.trim()})가 존재합니다. 다른 번호를 입력해주세요.`);
        } else {
          setError(msg || '견적서 생성에 실패했습니다.');
        }
        return;
      }
      navigate('/orders');
    }
  };

  if (loadingEdit) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
      <div className="flex items-center gap-3">
        <button
          onClick={() => {
            if (fromDelivery) navigate('/delivery');
            else if (isConfirmedEdit || fromConfirmed) navigate('/confirmed');
            else navigate(-1);
          }}
          className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
        >
          <ArrowLeft className="w-5 h-5 text-slate-600" />
        </button>
        <h2 className="text-2xl font-bold text-slate-900">
          {isConfirmedEdit ? '수주 수정' : isEdit ? '견적서 수정' : '견적서 작성'}
        </h2>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 space-y-4">
          <h3 className="font-semibold text-slate-900">기본 정보</h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">견적번호 *</label>
              <input
                type="text"
                className={inp}
                value={docNo}
                onChange={e => setDocNo(e.target.value)}
                placeholder="견적번호 입력"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">견적일자 *</label>
              <input
                type="date"
                className={inp}
                value={orderDate}
                onChange={e => setOrderDate(e.target.value)}
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">거래처 *</label>
              <button
                type="button"
                onClick={() => setShowPartnerModal(true)}
                className={`${inp} text-left flex items-center justify-between`}
              >
                <span className={selectedPartner ? 'text-slate-900 font-medium' : 'text-slate-400'}>
                  {selectedPartner ? selectedPartner.name : '거래처 검색...'}
                </span>
                <Search className="w-4 h-4 text-slate-400 shrink-0" />
              </button>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">담당자</label>
              <input
                type="text"
                className={inp}
                value={contactPerson}
                onChange={e => setContactPerson(e.target.value)}
                placeholder="거래처 담당자명"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Vessel</label>
              <input
                type="text"
                className={inp}
                value={vessel}
                onChange={e => setVessel(e.target.value)}
                placeholder="선명 (Vessel)"
              />
            </div>
          </div>
          {selectedPartner && (
            <div className="bg-slate-50 rounded-xl p-3 text-sm text-slate-600 space-y-1">
              <p><span className="text-slate-400">사업자번호:</span> {selectedPartner.biz_no}</p>
              <p><span className="text-slate-400">대표자:</span> {selectedPartner.rep}</p>
              {selectedPartner.addr && <p><span className="text-slate-400">주소:</span> {selectedPartner.addr}</p>}
            </div>
          )}
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 space-y-4">
          <h3 className="font-semibold text-slate-900">품목 정보</h3>
          <MaterialEditor lines={lines} onChange={setLines} />
          <div className="flex justify-end">
            <div className="bg-slate-50 rounded-xl p-4 space-y-2 text-sm min-w-[240px]">
              <div className="flex justify-between">
                <span className="text-slate-500">공급가액</span>
                <span className="text-slate-900">{fmtW(supplyAmount)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">세액 (10%)</span>
                <span className="text-slate-900">{fmtW(taxAmount)}</span>
              </div>
              <div className="flex justify-between border-t border-slate-200 pt-2 font-semibold">
                <span className="text-slate-700">합계</span>
                <span className="text-indigo-600">{fmtW(totalAmount)}</span>
              </div>
            </div>
          </div>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-red-700 text-sm">{error}</div>
        )}

        <div className="flex gap-3 justify-end">
          <button
            type="button"
            onClick={() => {
              if (fromDelivery) navigate('/delivery');
              else if (isConfirmedEdit || fromConfirmed) navigate('/confirmed');
              else navigate('/orders');
            }}
            className="px-6 py-2.5 border border-slate-300 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors"
          >
            취소
          </button>
          <button
            type="submit"
            disabled={saving || editBlocked}
            className="flex items-center gap-2 px-6 py-2.5 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors disabled:opacity-50 shadow-sm"
          >
            <Save className="w-4 h-4" />
            {saving ? '저장 중...' : isConfirmedEdit ? '수주 수정' : isEdit ? '견적서 수정' : '견적서 저장'}
          </button>
        </div>
      </form>

      {showPartnerModal && (
        <PartnerSearchModal
          partners={salesPartners}
          title="영업 거래처 검색"
          onSelect={p => setSelectedPartner(p)}
          onClose={() => setShowPartnerModal(false)}
        />
      )}
    </motion.div>
  );
}
