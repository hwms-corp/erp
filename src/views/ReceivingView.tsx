import { useState, useEffect, useMemo, useCallback } from 'react';
import { motion } from 'motion/react';
import { Package, CheckCircle2, RotateCcw, Search, Calendar } from 'lucide-react';
import { StatusBadge } from '@/components/StatusBadge';
import { Pagination, usePagination } from '@/components/Pagination';
import { Modal } from '@/components/Modal';
import { usePOs } from '@/hooks/usePOs';
import { useDelivery } from '@/hooks/useDelivery';
import { supabase } from '@/lib/supabase';
import { fmt, fmtW, PO_STATUS_LABELS, monthStart, monthEnd } from '@/types';
import type { POWithDetail, POItem, POStatus } from '@/types';

const inp = 'w-full px-3 py-2 border border-slate-300 rounded-lg text-sm outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500';

type TabKey = 'all' | 'ordered' | 'partial_received' | 'received';
const tabs: { key: TabKey; label: string }[] = [
  { key: 'all', label: '전체' },
  { key: 'ordered', label: '발주' },
  { key: 'partial_received', label: '부분입고' },
  { key: 'received', label: '입고완료' },
];

interface POCardData extends POWithDetail {
  items: POItem[];
}

export function ReceivingView() {
  const { fetchPOs, fetchPOItems, updateReceivedQty } = usePOs();
  const { revertDelivery } = useDelivery();
  const [cards, setCards] = useState<POCardData[]>([]);
  const [tab, setTab] = useState<TabKey>('all');
  const [dateFrom, setDateFrom] = useState(monthStart);
  const [dateTo, setDateTo] = useState(monthEnd);
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [searchCol, setSearchCol] = useState('all');
  const [partialModal, setPartialModal] = useState<{ poId: number; item: POItem } | null>(null);
  const [partialQty, setPartialQty] = useState(0);
  const searchCols = [{ k: 'all', l: '전체' }, { k: 'doc_no', l: '발주번호' }, { k: 'partner', l: '거래처' }, { k: 'name', l: '품명' }];

  const loadAll = useCallback(async () => {
    const { data: poList } = await fetchPOs();
    if (!poList) return;

    const withItems: POCardData[] = await Promise.all(
      poList.map(async (po: POWithDetail) => {
        const { data: items } = await fetchPOItems(po.id);
        return { ...po, items: items ?? [] };
      }),
    );
    setCards(withItems);
  }, [fetchPOs, fetchPOItems]);

  useEffect(() => { loadAll(); }, [loadAll]);

  const filtered = useMemo(() => {
    let list = tab === 'all' ? cards : cards.filter(c => c.status === tab);
    if (dateFrom) list = list.filter(c => c.po_date >= dateFrom);
    if (dateTo) list = list.filter(c => c.po_date <= dateTo);
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(c => {
        const itemNames = c.items.map(i => i.name).join(' ').toLowerCase();
        if (searchCol === 'all') return c.doc_no.toLowerCase().includes(q) || c.partner_name.toLowerCase().includes(q) || itemNames.includes(q);
        if (searchCol === 'doc_no') return c.doc_no.toLowerCase().includes(q);
        if (searchCol === 'partner') return c.partner_name.toLowerCase().includes(q);
        if (searchCol === 'name') return itemNames.includes(q);
        return false;
      });
    }
    return list;
  }, [cards, tab, dateFrom, dateTo, search, searchCol]);

  const [page, setPage] = useState(1);
  const { totalItems, totalPages, pageSize, getPage } = usePagination(filtered, 10);
  const pagedFiltered = getPage(page);

  useEffect(() => { setPage(1); }, [tab, dateFrom, dateTo, search, searchCol]);

  const handleFullReceive = async (po: POCardData) => {
    for (const item of po.items) {
      if (item.received_qty < item.qty) {
        await updateReceivedQty(item.id, item.qty);
      }
    }
    await loadAll();
  };

  const handlePartialReceive = async () => {
    if (!partialModal) return;
    const { item } = partialModal;
    const maxQty = item.qty - item.received_qty;
    if (partialQty <= 0 || partialQty > maxQty) {
      alert(`1 ~ ${maxQty} 사이의 수량을 입력해주세요.`);
      return;
    }
    await updateReceivedQty(item.id, item.received_qty + partialQty);
    setPartialModal(null);
    setPartialQty(0);
    await loadAll();
  };

  const revertDeliveryIfCompleted = async (po: POCardData) => {
    if (!po.order_id) return;
    const { data: order } = await supabase
      .from('orders')
      .select('delivery_status')
      .eq('id', po.order_id)
      .single();
    if (order?.delivery_status === 'completed') {
      await revertDelivery(po.order_id);
    }
  };

  const handleResetItem = async (item: POItem) => {
    if (!confirm(`"${item.name}" 입고수량을 0으로 초기화하시겠습니까?`)) return;
    await updateReceivedQty(item.id, 0);
    const po = cards.find(c => c.items.some(i => i.id === item.id));
    if (po) await revertDeliveryIfCompleted(po);
    await loadAll();
  };

  const handleResetAll = async (po: POCardData) => {
    if (!confirm(`${po.doc_no}의 모든 입고를 초기화하시겠습니까?\n전체 입고수량이 0으로 돌아갑니다.`)) return;
    for (const item of po.items) {
      if (item.received_qty > 0) {
        await updateReceivedQty(item.id, 0);
      }
    }
    await revertDeliveryIfCompleted(po);
    await loadAll();
  };

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
      <h2 className="text-2xl font-bold text-slate-900">입고 관리</h2>

      <div className="flex gap-2">
        {tabs.map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
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
          <input type="date" className={`${inp} !w-36`} value={dateFrom} onChange={e => setDateFrom(e.target.value)} />
          <span className="text-slate-400">~</span>
          <input type="date" className={`${inp} !w-36`} value={dateTo} onChange={e => setDateTo(e.target.value)} />
        </div>
        <select className="px-3 py-2 border border-slate-300 rounded-lg text-sm outline-none bg-white shrink-0" value={searchCol} onChange={e => setSearchCol(e.target.value)}>
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
            onKeyDown={e => { if (e.key === 'Enter') setSearch(searchInput); }}
          />
          {searchInput && (
            <button onClick={() => { setSearchInput(''); setSearch(''); }} className="text-slate-400 hover:text-slate-600 text-xs">✕</button>
          )}
        </div>
      </div>

      <div className="space-y-4">
        {pagedFiltered.map(po => {
          const isFullyReceived = po.status === 'received';
          return (
            <div key={po.id} className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
              <div className="flex items-center justify-between p-4 border-b border-slate-100">
                <div className="flex items-center gap-3">
                  <Package className="w-5 h-5 text-indigo-500" />
                  <div>
                    <span className="font-semibold text-slate-900">{po.doc_no}</span>
                    <span className="ml-2 text-sm text-slate-500">{po.partner_name}</span>
                  </div>
                  <StatusBadge status={po.status} />
                </div>
                <div className="flex items-center gap-3 text-sm text-slate-500">
                  <span>발주일: {po.po_date}</span>
                  {po.required_date && <span>납기: {po.required_date}</span>}
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-sm text-left min-w-[700px]">
                  <thead className="bg-slate-50 text-slate-500">
                    <tr>
                      <th className="px-4 py-2">품명</th>
                      <th className="px-4 py-2">사양</th>
                      <th className="px-4 py-2 text-right">발주수량</th>
                      <th className="px-4 py-2 text-right">입고수량</th>
                      <th className="px-4 py-2 text-right">잔량</th>
                      <th className="px-4 py-2 text-right">처리</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {po.items.map(item => {
                      const remaining = item.qty - item.received_qty;
                      return (
                        <tr key={item.id}>
                          <td className="px-4 py-2.5 font-medium text-slate-900">{item.name}</td>
                          <td className="px-4 py-2.5 text-slate-600">{item.spec}</td>
                          <td className="px-4 py-2.5 text-right">{fmt(item.qty)}</td>
                          <td className="px-4 py-2.5 text-right text-indigo-600 font-medium">{fmt(item.received_qty)}</td>
                          <td className={`px-4 py-2.5 text-right font-medium ${remaining > 0 ? 'text-orange-600' : 'text-emerald-600'}`}>
                            {fmt(remaining)}
                          </td>
                          <td className="px-4 py-2.5 text-right">
                            <div className="flex items-center justify-end gap-1">
                              {remaining > 0 && (
                                <button
                                  onClick={() => { setPartialModal({ poId: po.id, item }); setPartialQty(remaining); }}
                                  className="px-2.5 py-1 bg-blue-50 text-blue-600 rounded-lg text-xs font-medium hover:bg-blue-100"
                                >
                                  부분입고
                                </button>
                              )}
                              {item.received_qty > 0 && (
                                <button
                                  onClick={() => handleResetItem(item)}
                                  className="px-2.5 py-1 bg-red-50 text-red-600 rounded-lg text-xs font-medium hover:bg-red-100"
                                >
                                  입고취소
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              <div className="p-4 border-t border-slate-100 flex justify-between items-center">
                <span className="text-sm text-slate-500">
                  발주금액: <strong>{fmtW(po.po_amount)}</strong> / 입고금액: <strong>{fmtW(po.received_amount)}</strong>
                </span>
                <div className="flex items-center gap-2">
                  {po.items.some(it => it.received_qty > 0) && (
                    <button
                      onClick={() => handleResetAll(po)}
                      className="flex items-center gap-1.5 px-4 py-2 bg-red-50 text-red-600 rounded-xl text-sm font-medium hover:bg-red-100"
                    >
                      <RotateCcw className="w-4 h-4" /> 입고 초기화
                    </button>
                  )}
                  {!isFullyReceived && (
                    <button
                      onClick={() => handleFullReceive(po)}
                      className="flex items-center gap-1.5 px-4 py-2 bg-emerald-600 text-white rounded-xl text-sm font-medium hover:bg-emerald-700"
                    >
                      <CheckCircle2 className="w-4 h-4" /> 전량입고
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })}

        {pagedFiltered.length === 0 && (
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-12 text-center text-slate-400">
            해당 조건의 발주 건이 없습니다
          </div>
        )}
        <Pagination page={page} totalPages={totalPages} onPageChange={setPage} totalItems={totalItems} pageSize={pageSize} />
      </div>

      {partialModal && (
        <Modal title="부분입고 수량 입력" onClose={() => { setPartialModal(null); setPartialQty(0); }}>
          <div className="space-y-4">
            <div className="text-sm text-slate-600">
              <strong>{partialModal.item.name}</strong> — 잔량: {fmt(partialModal.item.qty - partialModal.item.received_qty)}
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">입고 수량</label>
              <input
                type="number"
                className={inp}
                value={partialQty}
                onChange={e => setPartialQty(Number(e.target.value))}
                min={1}
                max={partialModal.item.qty - partialModal.item.received_qty}
                autoFocus
              />
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <button onClick={() => { setPartialModal(null); setPartialQty(0); }} className="px-4 py-2 text-sm text-slate-600 hover:text-slate-800">취소</button>
              <button
                onClick={handlePartialReceive}
                className="px-4 py-2 bg-indigo-600 text-white rounded-xl text-sm font-medium hover:bg-indigo-700"
              >
                입고 처리
              </button>
            </div>
          </div>
        </Modal>
      )}
    </motion.div>
  );
}
