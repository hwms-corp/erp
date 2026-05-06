import { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { mergeQuery } from '@/lib/listQuery';
import { motion } from 'motion/react';
import { Truck, CheckCircle2, FileText, Search, Calendar, RotateCcw } from 'lucide-react';
import { StatusBadge } from '@/components/StatusBadge';
import { Pagination, usePagination } from '@/components/Pagination';
import { useDelivery } from '@/hooks/useDelivery';
import { supabase } from '@/lib/supabase';
import { fmtW, monthStart, monthEnd } from '@/types';

const inp = 'w-full px-3 py-2 border border-slate-300 rounded-lg text-sm outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500';
import type { OrderWithPartner, OrderItem } from '@/types';

type TabKey = 'all' | 'pending' | 'completed';
const tabs: { key: TabKey; label: string }[] = [
  { key: 'all', label: '전체' },
  { key: 'pending', label: '납품대기' },
  { key: 'completed', label: '납품완료' },
];

const DELIVERY_TAB_KEYS = new Set<TabKey>(['all', 'pending', 'completed']);

interface DeliveryCard extends OrderWithPartner {
  items: OrderItem[];
  allPOsReceived: boolean;
  hasPOs: boolean;
}

export function DeliveryView() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { completeDelivery, revertDelivery } = useDelivery();
  const [cards, setCards] = useState<DeliveryCard[]>([]);

  const listQ = useMemo(() => {
    const pageRaw = Number.parseInt(searchParams.get('page') || '1', 10);
    const tabRaw = (searchParams.get('tab') || 'all') as TabKey;
    return {
      tab: DELIVERY_TAB_KEYS.has(tabRaw) ? tabRaw : 'all',
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

  const { tab, q: search, col: searchCol, from: dateFrom, to: dateTo, page } = listQ;

  const setListParams = useCallback((patch: Record<string, string | null | undefined>, replace = true) => {
    setSearchParams(prev => mergeQuery(prev, patch), { replace });
  }, [setSearchParams]);
  const searchCols = [
    { k: 'all', l: '전체' },
    { k: 'doc_no', l: '견적번호' },
    { k: 'partner', l: '거래처' },
    { k: 'name', l: '품명' },
    { k: 'spec', l: '사양' },
  ];

  const loadAll = useCallback(async () => {
    const { data: orders } = await supabase
      .from('v_orders_with_partner')
      .select('*')
      .eq('status', 'confirmed')
      .order('order_date', { ascending: false });

    if (!orders) return;

    const result: DeliveryCard[] = await Promise.all(
      orders.map(async (order: OrderWithPartner) => {
        const { data: items } = await supabase
          .from('order_items')
          .select('*')
          .eq('order_id', order.id)
          .order('seq', { ascending: true });

        const { data: posData } = await supabase
          .from('pos')
          .select('id, status')
          .eq('order_id', order.id);

        const hasPOs = posData && posData.length > 0;
        const allReceived = hasPOs ? posData.every((p: { status: string }) => p.status === 'received') : false;

        return {
          ...order,
          items: items ?? [],
          allPOsReceived: allReceived,
          hasPOs: !!hasPOs,
        };
      }),
    );

    setCards(result);
  }, []);

  useEffect(() => { loadAll(); }, [loadAll]);

  const filtered = useMemo(() => {
    let list = cards.filter(c => c.allPOsReceived || !c.hasPOs);
    if (tab === 'pending') list = list.filter(c => c.delivery_status === 'pending');
    if (tab === 'completed') list = list.filter(c => c.delivery_status === 'completed');
    if (dateFrom) list = list.filter(c => c.order_date >= dateFrom);
    if (dateTo) list = list.filter(c => c.order_date <= dateTo);
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(c => {
        const itemNames = c.items.map(i => i.name).join(' ').toLowerCase();
        const itemSpecs = c.items.map(i => (i.spec || '').trim()).join(' ').toLowerCase();
        if (searchCol === 'all') {
          return (
            c.doc_no.toLowerCase().includes(q) ||
            c.partner_name.toLowerCase().includes(q) ||
            itemNames.includes(q) ||
            itemSpecs.includes(q)
          );
        }
        if (searchCol === 'doc_no') return c.doc_no.toLowerCase().includes(q);
        if (searchCol === 'partner') return c.partner_name.toLowerCase().includes(q);
        if (searchCol === 'name') return itemNames.includes(q);
        if (searchCol === 'spec') return itemSpecs.includes(q);
        return false;
      });
    }
    return list;
  }, [cards, tab, dateFrom, dateTo, search, searchCol]);

  const { totalItems, totalPages, pageSize, getPage } = usePagination(filtered, 10);
  const paged = getPage(page);

  const handleComplete = async (orderId: number) => {
    if (!confirm('납품완료 처리하시겠습니까?')) return;
    const { error } = await completeDelivery(orderId);
    if (error) {
      alert('처리 실패: ' + error.message);
    } else {
      await loadAll();
    }
  };

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
      <h2 className="text-2xl font-bold text-slate-900">납품 관리</h2>

      <div className="flex gap-2">
        {tabs.map(t => (
          <button
            key={t.key}
            onClick={() => setListParams({ tab: t.key, page: '1' })}
            className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors ${
              tab === t.key ? 'bg-indigo-600 text-white shadow-sm' : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

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
            placeholder="견적번호·거래처·품명·사양 검색 (Enter)"
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

      <div className="space-y-4">
        {paged.map(card => {
          const isPending = card.delivery_status === 'pending';
          const isCompleted = card.delivery_status === 'completed';
          return (
            <div key={card.id} className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
              <div className="flex items-center justify-between p-4 border-b border-slate-100">
                <div className="flex items-center gap-3">
                  <Truck className="w-5 h-5 text-indigo-500" />
                  <div>
                    <span
                      className="font-semibold text-indigo-600 cursor-pointer hover:underline"
                      onClick={() => navigate(`/orders/${card.id}/preview`)}
                    >
                      {card.doc_no}
                    </span>
                    <span className="ml-2 text-sm text-slate-500">{card.partner_name}</span>
                  </div>
                  <StatusBadge status={card.delivery_status ?? 'pending'} />
                  {!card.hasPOs && card.delivery_status === 'completed' && (
                    <span className="px-2 py-0.5 bg-blue-50 text-blue-600 rounded-full text-xs font-medium">재고납품</span>
                  )}
                </div>
                <div className="text-sm text-slate-500">
                  수주일: {card.order_date}
                  {card.delivery_date && <span className="ml-3">납품일: {card.delivery_date}</span>}
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-sm text-left min-w-[600px]">
                  <thead className="bg-slate-50 text-slate-500">
                    <tr>
                      <th className="px-4 py-2">품명</th>
                      <th className="px-4 py-2">사양</th>
                      <th className="px-4 py-2 text-right">수량</th>
                      <th className="px-4 py-2 text-right">단가</th>
                      <th className="px-4 py-2 text-right">금액</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {card.items.map(item => (
                      <tr key={item.id}>
                        <td className="px-4 py-2.5 font-medium text-slate-900">{item.name}</td>
                        <td className="px-4 py-2.5 text-slate-600">{item.spec}</td>
                        <td className="px-4 py-2.5 text-right">{item.qty} {item.unit}</td>
                        <td className="px-4 py-2.5 text-right">{fmtW(item.price)}</td>
                        <td className="px-4 py-2.5 text-right font-medium">{fmtW(item.qty * item.price)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="p-4 border-t border-slate-100 flex justify-between items-center">
                <span className="text-sm text-slate-500">
                  합계: <strong className="text-slate-900">{fmtW(card.total_amount)}</strong>
                </span>
                <div className="flex items-center gap-2">
                  {isCompleted && (
                    <>
                      <button
                        onClick={async () => {
                          if (!confirm(`${card.doc_no}을(를) 납품대기로 되돌리시겠습니까?`)) return;
                          const { error } = await revertDelivery(card.id);
                          if (error) alert('되돌리기 실패: ' + (error.message || ''));
                          else await loadAll();
                        }}
                        className="flex items-center gap-1.5 px-4 py-2 bg-amber-50 text-amber-700 rounded-xl text-sm font-medium hover:bg-amber-100"
                      >
                        <RotateCcw className="w-4 h-4" /> 되돌리기
                      </button>
                      <button
                        onClick={() => navigate(`/confirmed/${card.id}/statement`)}
                        className="flex items-center gap-1.5 px-4 py-2 bg-slate-100 text-slate-700 rounded-xl text-sm font-medium hover:bg-slate-200"
                      >
                        <FileText className="w-4 h-4" /> 거래명세서
                      </button>
                    </>
                  )}
                  {isPending && (
                    <button
                      onClick={() => handleComplete(card.id)}
                      className="flex items-center gap-1.5 px-4 py-2 bg-emerald-600 text-white rounded-xl text-sm font-medium hover:bg-emerald-700"
                    >
                      <CheckCircle2 className="w-4 h-4" /> 납품완료 처리
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })}

        {paged.length === 0 && (
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-12 text-center text-slate-400">
            해당 조건의 납품 건이 없습니다
          </div>
        )}
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
