import { useState, useMemo, useEffect, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { mergeQuery } from '@/lib/listQuery';
import { motion } from 'motion/react';
import { Search, Calendar, Trash2, RotateCcw, PackageCheck } from 'lucide-react';
import { useOrders } from '@/hooks/useOrders';
import { useDelivery } from '@/hooks/useDelivery';
import { supabase } from '@/lib/supabase';
import { Pagination, usePagination } from '@/components/Pagination';
import { fmtW, monthStart, monthEnd } from '@/types';
import type { OrderWithPartner } from '@/types';

const inp = 'w-full px-3 py-2 border border-slate-300 rounded-lg text-sm outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500';

export function ConfirmedView() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { revertToDraft, deleteOrder } = useOrders();
  const { completeDelivery } = useDelivery();
  const [orders, setOrders] = useState<OrderWithPartner[]>([]);
  const [poOrderIds, setPoOrderIds] = useState<Set<number>>(new Set());
  const [orderItemNames, setOrderItemNames] = useState<Map<number, string>>(new Map());

  const listQ = useMemo(() => {
    const pageRaw = Number.parseInt(searchParams.get('page') || '1', 10);
    return {
      q: searchParams.get('q') ?? '',
      col: searchParams.get('col') ?? 'all',
      from: searchParams.get('from') ?? monthStart(),
      to: searchParams.get('to') ?? monthEnd(),
      page: Number.isFinite(pageRaw) && pageRaw >= 1 ? pageRaw : 1,
    };
  }, [searchParams]);

  const [searchInput, setSearchInput] = useState(listQ.q);
  useEffect(() => {
    setSearchInput(listQ.q);
  }, [listQ.q]);

  const { q: search, col: searchCol, from: dateFrom, to: dateTo, page } = listQ;

  const setListParams = useCallback((patch: Record<string, string | null | undefined>, replace = true) => {
    setSearchParams(prev => mergeQuery(prev, patch), { replace });
  }, [setSearchParams]);
  const searchCols = [{ k: 'all', l: '전체' }, { k: 'doc_no', l: '견적번호' }, { k: 'partner', l: '거래처' }, { k: 'name', l: '품명' }, { k: 'vessel', l: 'Vessel' }];

  const fetchData = useCallback(async () => {
    const { data: orderData } = await supabase
      .from('v_orders_with_partner')
      .select('*')
      .eq('status', 'confirmed')
      .order('order_date', { ascending: false });
    if (orderData) {
      setOrders(orderData);
      const ids = orderData.map(o => o.id);
      if (ids.length > 0) {
        const { data: items } = await supabase
          .from('order_items')
          .select('order_id, name')
          .in('order_id', ids)
          .is('deleted_at', null);
        if (items) {
          const map = new Map<number, string>();
          items.forEach(it => {
            const prev = map.get(it.order_id) || '';
            map.set(it.order_id, prev ? `${prev} ${it.name}` : it.name);
          });
          setOrderItemNames(map);
        }
      }
    }

    const { data: poData } = await supabase.from('pos').select('order_id').is('deleted_at', null);
    if (poData) setPoOrderIds(new Set(poData.map(p => p.order_id).filter(Boolean)));
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const confirmed = useMemo(() => {
    let list = orders.filter(o => !poOrderIds.has(o.id) && o.delivery_status !== 'completed');
    if (dateFrom) list = list.filter(o => o.order_date >= dateFrom);
    if (dateTo) list = list.filter(o => o.order_date <= dateTo);
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(o => {
        const names = (orderItemNames.get(o.id) || '').toLowerCase();
        const vessel = (o.vessel || '').toLowerCase();
        if (searchCol === 'all') return o.doc_no.toLowerCase().includes(q) || o.partner_name.toLowerCase().includes(q) || names.includes(q) || vessel.includes(q);
        if (searchCol === 'doc_no') return o.doc_no.toLowerCase().includes(q);
        if (searchCol === 'partner') return o.partner_name.toLowerCase().includes(q);
        if (searchCol === 'name') return names.includes(q);
        if (searchCol === 'vessel') return vessel.includes(q);
        return false;
      });
    }
    return list;
  }, [orders, poOrderIds, orderItemNames, search, searchCol, dateFrom, dateTo]);

  const { totalItems, totalPages, pageSize, getPage } = usePagination(confirmed);
  const pagedConfirmed = getPage(page);

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
      <h2 className="text-2xl font-bold text-slate-900">수주 관리</h2>
      <p className="text-sm text-slate-500 -mt-4">수주확정 후 발주 대기 중인 건</p>
      <div className="flex gap-3 items-center flex-wrap">
        <div className="flex items-center gap-2 text-sm">
          <Calendar className="w-4 h-4 text-slate-400" />
          <input
            type="date"
            className={`${inp} !w-36`}
            value={dateFrom}
            onChange={e => setListParams({ from: e.target.value, page: '1' })}
          />
          <span className="text-slate-400">~</span>
          <input
            type="date"
            className={`${inp} !w-36`}
            value={dateTo}
            onChange={e => setListParams({ to: e.target.value, page: '1' })}
          />
        </div>
        <select
          className="px-3 py-2 border border-slate-300 rounded-lg text-sm outline-none bg-white shrink-0"
          value={searchCol}
          onChange={e => setListParams({ col: e.target.value, page: '1' })}
        >
          {searchCols.map(c => <option key={c.k} value={c.k}>{c.l}</option>)}
        </select>
        <div className="flex-1 bg-white px-4 py-2.5 rounded-2xl shadow-sm border border-slate-200 flex items-center gap-3">
          <Search className="w-5 h-5 text-slate-400 shrink-0" />
          <input
            type="text"
            placeholder="검색 (Enter)"
            className="flex-1 outline-none text-sm"
            value={searchInput}
            onChange={e => setSearchInput(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter') {
                const v = searchInput.trim();
                setListParams({
                  ...(v ? { q: v } : { q: null }),
                  page: '1',
                });
              }
            }}
          />
          {searchInput && (
            <button
              onClick={() => {
                setSearchInput('');
                setListParams({ q: null, page: '1' });
              }}
              className="text-slate-400 hover:text-slate-600 text-xs"
            >
              ✕
            </button>
          )}
        </div>
      </div>
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-x-auto">
        <table className="w-full text-sm text-left min-w-[700px] whitespace-nowrap">
          <thead className="bg-slate-50 text-slate-500 border-b border-slate-200">
            <tr>
              <th className="px-4 py-3">일자</th>
              <th className="px-4 py-3">견적번호</th>
              <th className="px-4 py-3">거래처</th>
              <th className="px-4 py-3 text-right">총금액</th>
              <th className="px-4 py-3 text-center">처리</th>
              <th className="px-4 py-3 text-center">관리</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {pagedConfirmed.map(o => (
              <tr key={o.id} className="hover:bg-slate-50">
                <td className="px-4 py-3 text-slate-600">{o.order_date}</td>
                <td className="px-4 py-3">
                  <span className="font-medium text-indigo-600 cursor-pointer hover:underline" onClick={() => navigate(`/orders/${o.id}/preview`)}>{o.doc_no}</span>
                  {o.origin_order_id && <span className="ml-1 text-xs text-slate-400">(부분확정)</span>}
                </td>
                <td className="px-4 py-3 font-medium text-slate-900">{o.partner_name}</td>
                <td className="px-4 py-3 text-right font-medium">{fmtW(o.supply_amount)}</td>
                <td className="px-4 py-3 text-center">
                  <div className="flex items-center justify-center gap-1">
                    <button onClick={() => navigate(`/pos/new?orderId=${o.id}`)} className="px-3 py-1.5 bg-orange-50 text-orange-600 rounded-lg text-xs font-medium hover:bg-orange-100">발주하기</button>
                    <button
                      onClick={async () => {
                        if (!confirm(`${o.doc_no}을(를) 납품완료 처리하시겠습니까?\n발주 없이 재고에서 바로 납품 처리됩니다.`)) return;
                        const { error } = await completeDelivery(o.id);
                        if (error) alert('납품처리 실패: ' + (error.message || ''));
                        else { setOrders(prev => prev.filter(x => x.id !== o.id)); }
                      }}
                      className="inline-flex items-center gap-1 px-3 py-1.5 bg-emerald-50 text-emerald-700 rounded-lg text-xs font-medium hover:bg-emerald-100 transition-colors"
                    >
                      <PackageCheck className="w-3.5 h-3.5" />
                      납품처리
                    </button>
                  </div>
                </td>
                <td className="px-4 py-3 text-center">
                  <div className="flex items-center justify-center gap-1">
                    <button
                      onClick={async () => {
                        if (!confirm(`${o.doc_no}을(를) 견적 단계로 되돌리시겠습니까?`)) return;
                        const { error } = await revertToDraft(o.id);
                        if (error) alert('되돌리기 실패: ' + (error.message || ''));
                        else { setOrders(prev => prev.filter(x => x.id !== o.id)); }
                      }}
                      className="p-1.5 text-slate-400 hover:text-amber-600 transition-colors"
                      title="견적으로 되돌리기"
                    >
                      <RotateCcw className="w-4 h-4" />
                    </button>
                    <button
                      onClick={async () => {
                        if (!confirm(`${o.doc_no}을(를) 삭제하시겠습니까?\n삭제 후 복구할 수 없습니다.`)) return;
                        const { error } = await deleteOrder(o.id);
                        if (error) alert('삭제 실패: 연결된 발주서가 있으면 먼저 삭제해주세요.');
                        else { setOrders(prev => prev.filter(x => x.id !== o.id)); }
                      }}
                      className="p-1.5 text-slate-400 hover:text-red-600 transition-colors"
                      title="삭제"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {pagedConfirmed.length === 0 && (
              <tr><td colSpan={6} className="px-4 py-12 text-center text-slate-400">발주 대기 중인 수주 건이 없습니다</td></tr>
            )}
          </tbody>
        </table>
        <Pagination
          page={page}
          totalPages={totalPages}
          onPageChange={pg => setListParams({ page: String(pg) })}
          totalItems={totalItems}
          pageSize={pageSize}
        />
      </div>
    </motion.div>
  );
}
