import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { mergeQuery } from '@/lib/listQuery';
import { motion } from 'motion/react';
import { Truck, CheckCircle2, FileText, Search, Calendar, RotateCcw, Receipt, Check, Edit } from 'lucide-react';
import { StatusBadge } from '@/components/StatusBadge';
import { Pagination, usePagination } from '@/components/Pagination';
import { Modal } from '@/components/Modal';
import { useDelivery } from '@/hooks/useDelivery';
import { supabase } from '@/lib/supabase';
import { fmt, fmtW, monthEnd, today, formatYmdSlash } from '@/types';

const inp = 'w-full px-3 py-2 border border-slate-300 rounded-lg text-sm outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500';
import type { OrderWithPartner, OrderItem } from '@/types';

type TabKey = 'all' | 'pending' | 'completed' | 'no_tax';
const tabs: { key: TabKey; label: string }[] = [
  { key: 'all', label: '전체' },
  { key: 'pending', label: '납품대기' },
  { key: 'completed', label: '납품완료' },
];

const DELIVERY_TAB_KEYS = new Set<TabKey>(['all', 'pending', 'completed', 'no_tax']);

function matchesSpecSearch(spec: string | null | undefined, t1: string, t2: string): boolean {
  const s = (spec || '').toLowerCase();
  if (!t1) return true;
  if (!t2) return s.includes(t1);
  return s.includes(t1) && s.includes(t2);
}

interface DeliveryCard extends OrderWithPartner {
  items: OrderItem[];
  allPOsReceived: boolean;
  hasPOs: boolean;
}

export function DeliveryView() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { completeDelivery, revertDelivery, issueTaxInvoice } = useDelivery();
  const [cards, setCards] = useState<DeliveryCard[]>([]);
  const [taxInvoiceModal, setTaxInvoiceModal] = useState<DeliveryCard | null>(null);
  const [taxInvoiceDate, setTaxInvoiceDate] = useState(today);
  const [taxInvoiceSubmitting, setTaxInvoiceSubmitting] = useState(false);
  const [selectedNoTaxIds, setSelectedNoTaxIds] = useState<number[]>([]);
  const [bulkIssueSubmitting, setBulkIssueSubmitting] = useState(false);
  const taxInvoiceDateInputRef = useRef<HTMLInputElement>(null);

  const listQ = useMemo(() => {
    const pageRaw = Number.parseInt(searchParams.get('page') || '1', 10);
    const tabRaw = (searchParams.get('tab') || 'all') as TabKey;
    let resolved = DELIVERY_TAB_KEYS.has(tabRaw) ? tabRaw : 'all';
    if (searchParams.get('no_tax') === '1') resolved = 'no_tax';
    return {
      tab: resolved,
      q: searchParams.get('q') ?? '',
      q2: searchParams.get('q2') ?? '',
      col: searchParams.get('col') ?? 'all',
      from: searchParams.get('from') ?? '',
      to: searchParams.get('to') ?? monthEnd(),
      page: Number.isFinite(pageRaw) && pageRaw >= 1 ? pageRaw : 1,
    };
  }, [searchParams]);

  const [searchInput, setSearchInput] = useState(listQ.q);
  const [searchInput2, setSearchInput2] = useState(listQ.q2);
  useEffect(() => {
    setSearchInput(listQ.q);
  }, [listQ.q]);
  useEffect(() => {
    setSearchInput2(listQ.q2);
  }, [listQ.q2]);

  const { tab, q: search, q2: search2, col: searchCol, from: dateFrom, to: dateTo, page } = listQ;
  const isSpecSearch = searchCol === 'spec';
  const isNoTaxTab = tab === 'no_tax';

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
    if (tab === 'no_tax') {
      list = list.filter(
        c =>
          c.delivery_status === 'completed' &&
          !(c.tax_invoice_issued_status === 'issued' && !!c.tax_invoice_issued_date),
      );
    } else {
      if (tab === 'pending') list = list.filter(c => c.delivery_status === 'pending');
      if (tab === 'completed') list = list.filter(c => c.delivery_status === 'completed');
    }
    if (dateFrom) list = list.filter(c => c.order_date >= dateFrom);
    if (dateTo) list = list.filter(c => c.order_date <= dateTo);

    if (searchCol === 'spec' && search) {
      const t1 = search.trim().toLowerCase();
      const t2 = search2.trim().toLowerCase();
      list = list
        .map(c => ({
          ...c,
          items: c.items.filter(item => matchesSpecSearch(item.spec, t1, t2)),
        }))
        .filter(c => c.items.length > 0);
    } else if (search) {
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
        return false;
      });
    }
    return list;
  }, [cards, tab, dateFrom, dateTo, search, search2, searchCol]);

  const { totalItems, totalPages, pageSize, getPage } = usePagination(filtered, 10);
  const paged = getPage(page);
  const noTaxTotalAmount = useMemo(
    () => paged.reduce((sum, card) => sum + card.total_amount, 0),
    [paged],
  );

  const applySearch = useCallback(() => {
    const v1 = searchInput.trim();
    const v2 = searchInput2.trim();
    if (isSpecSearch) {
      setListParams({
        ...(v1 ? { q: v1 } : { q: null }),
        ...(v1 && v2 ? { q2: v2 } : { q2: null }),
        page: '1',
      });
    } else {
      setListParams({
        ...(v1 ? { q: v1 } : { q: null }),
        q2: null,
        page: '1',
      });
    }
  }, [isSpecSearch, searchInput, searchInput2, setListParams]);

  const clearSearch = useCallback(() => {
    setSearchInput('');
    setSearchInput2('');
    setListParams({ q: null, q2: null, page: '1' });
  }, [setListParams]);

  const handleSearchColChange = (col: string) => {
    if (col === 'spec') {
      setListParams({ col, page: '1' });
    } else {
      setSearchInput2('');
      setListParams({ col, q2: null, page: '1' });
    }
  };

  const handleComplete = async (orderId: number) => {
    if (!confirm('납품완료 처리하시겠습니까?')) return;
    const { error } = await completeDelivery(orderId);
    if (error) {
      alert('처리 실패: ' + error.message);
    } else {
      await loadAll();
    }
  };

  const isTaxInvoiceIssued = (card: DeliveryCard) =>
    card.tax_invoice_issued_status === 'issued' && !!card.tax_invoice_issued_date;

  const openTaxInvoiceModal = (card: DeliveryCard) => {
    if (isTaxInvoiceIssued(card)) return;
    setTaxInvoiceDate(today());
    setTaxInvoiceModal(card);
  };

  const closeTaxInvoiceModal = () => {
    if (taxInvoiceSubmitting) return;
    setTaxInvoiceModal(null);
  };

  const confirmTaxInvoiceIssue = async () => {
    if (!taxInvoiceModal || !taxInvoiceDate) return;
    setTaxInvoiceSubmitting(true);
    const { error } = await issueTaxInvoice(taxInvoiceModal.id, taxInvoiceDate);
    setTaxInvoiceSubmitting(false);
    if (error) {
      alert('발행 처리 실패: ' + (error.message || ''));
    } else {
      setTaxInvoiceModal(null);
      await loadAll();
    }
  };

  const toggleNoTaxSelection = (orderId: number, checked: boolean) => {
    setSelectedNoTaxIds(prev =>
      checked ? [...prev, orderId] : prev.filter(id => id !== orderId)
    );
  };

  const issueTaxInvoicesBulk = async () => {
    if (!isNoTaxTab || selectedNoTaxIds.length === 0 || bulkIssueSubmitting) return;
    if (!confirm(`선택한 ${selectedNoTaxIds.length}건을 세금계산서 일괄발행하시겠습니까?`)) return;

    setBulkIssueSubmitting(true);
    const issueDate = today();
    const targetIds = [...selectedNoTaxIds];
    const results = await Promise.all(targetIds.map(id => issueTaxInvoice(id, issueDate)));
    const failedIds = targetIds.filter((_, i) => !!results[i].error);

    setBulkIssueSubmitting(false);
    setSelectedNoTaxIds(failedIds);
    await loadAll();

    if (failedIds.length > 0) {
      alert(`${failedIds.length}건은 발행 처리에 실패했습니다. 다시 확인해 주세요.`);
    }
  };

  useEffect(() => {
    if (!isNoTaxTab) setSelectedNoTaxIds([]);
  }, [isNoTaxTab]);

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
      <h2 className="text-2xl font-bold text-slate-900">납품 관리</h2>

      <div className="flex flex-wrap items-center gap-2">
        {tabs.map(t => (
            <button
              key={t.key}
              onClick={() => setListParams({ tab: t.key, page: '1', no_tax: null })}
              className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors ${
                tab === t.key ? 'bg-indigo-600 text-white shadow-sm' : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
              }`}
            >
              {t.label}
            </button>
        ))}
        <button
          type="button"
          onClick={() => setListParams({ tab: 'no_tax', page: '1', no_tax: null })}
          className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors ${
            tab === 'no_tax' ? 'bg-indigo-600 text-white shadow-sm' : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
          }`}
        >
          세금계산서 미발행
        </button>
        {isNoTaxTab && (
          <button
            type="button"
            onClick={issueTaxInvoicesBulk}
            disabled={selectedNoTaxIds.length === 0 || bulkIssueSubmitting}
            className="ml-auto px-4 py-2 rounded-xl text-sm font-medium transition-colors bg-violet-600 text-white hover:bg-violet-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {bulkIssueSubmitting ? '일괄발행 중…' : '세금계산서 일괄발행'}
          </button>
        )}
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
          onChange={e => handleSearchColChange(e.target.value)}
        >
          {searchCols.map(c => <option key={c.k} value={c.k}>{c.l}</option>)}
        </select>
        {isSpecSearch ? (
          <div className="flex-1 flex items-center gap-2 min-w-0">
            <div className="flex-1 bg-white px-4 py-2.5 rounded-2xl shadow-sm border border-slate-200 flex items-center gap-3 min-w-0">
              <Search className="w-5 h-5 text-slate-400 shrink-0" />
              <input
                type="text"
                placeholder="사양 검색 1 (Enter)"
                className="flex-1 outline-none text-sm min-w-0"
                value={searchInput}
                onChange={e => {
                  const v = e.target.value;
                  setSearchInput(v);
                  if (!v.trim()) setSearchInput2('');
                }}
                onKeyDown={e => { if (e.key === 'Enter') applySearch(); }}
              />
            </div>
            <span className="text-slate-400 text-sm shrink-0">+</span>
            <div className={`flex-1 px-4 py-2.5 rounded-2xl shadow-sm border flex items-center gap-3 min-w-0 ${
              searchInput.trim()
                ? 'bg-white border-slate-200'
                : 'bg-slate-50 border-slate-200 opacity-60'
            }`}>
              <Search className="w-5 h-5 text-slate-400 shrink-0" />
              <input
                type="text"
                placeholder="사양 검색 2 (Enter)"
                className="flex-1 outline-none text-sm min-w-0 disabled:cursor-not-allowed disabled:bg-transparent"
                value={searchInput2}
                disabled={!searchInput.trim()}
                onChange={e => setSearchInput2(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') applySearch(); }}
              />
            </div>
            {(searchInput || searchInput2) && (
              <button
                onClick={clearSearch}
                className="text-slate-400 hover:text-slate-600 text-xs shrink-0 px-1"
              >
                ✕
              </button>
            )}
          </div>
        ) : (
          <div className="flex-1 bg-white px-4 py-2.5 rounded-2xl shadow-sm border border-slate-200 flex items-center gap-3">
            <Search className="w-5 h-5 text-slate-400 shrink-0" />
            <input
              type="text"
              placeholder="견적번호·거래처·품명·사양 검색 (Enter)"
              className="flex-1 outline-none text-sm"
              value={searchInput}
              onChange={e => setSearchInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') applySearch(); }}
            />
            {searchInput && (
              <button
                onClick={clearSearch}
                className="text-slate-400 hover:text-slate-600 text-xs"
              >
                ✕
              </button>
            )}
          </div>
        )}
      </div>

      <div className="space-y-4">
        {paged.map(card => {
          const isPending = card.delivery_status === 'pending';
          const isCompleted = card.delivery_status === 'completed';
          return (
            <div key={card.id} className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
              <div className="flex items-center justify-between p-4 border-b border-slate-100">
                <div className="flex items-center gap-3">
                  {isNoTaxTab && (
                    <button
                      type="button"
                      role="checkbox"
                      aria-checked={selectedNoTaxIds.includes(card.id)}
                      onClick={() => toggleNoTaxSelection(card.id, !selectedNoTaxIds.includes(card.id))}
                      className={`w-6 h-6 rounded-md border-2 flex items-center justify-center transition-colors ${
                        selectedNoTaxIds.includes(card.id)
                          ? 'bg-violet-600 border-violet-600 text-white'
                          : 'bg-white border-violet-300 text-transparent hover:border-violet-500'
                      }`}
                    >
                      <Check className="w-4 h-4" />
                    </button>
                  )}
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
                <div className="flex items-center gap-3 text-sm text-slate-500 flex-wrap">
                  {isCompleted && isTaxInvoiceIssued(card) && (
                    <span>세금계산서 발행: {card.tax_invoice_issued_date}</span>
                  )}
                  {card.delivery_status === 'completed' && card.delivery_date && (
                    <span>납품 처리: {card.delivery_date}</span>
                  )}
                  <span>수주일: {card.order_date}</span>
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
                  합계: <strong className="text-slate-900">
                    {fmtW(
                      isSpecSearch && search
                        ? card.items.reduce((sum, item) => sum + item.qty * item.price, 0)
                        : card.total_amount,
                    )}
                  </strong>
                </span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => navigate(`/orders/${card.id}/edit?from=delivery`)}
                    className="flex items-center gap-1.5 px-4 py-2 bg-indigo-50 text-indigo-700 rounded-xl text-sm font-medium hover:bg-indigo-100"
                  >
                    <Edit className="w-4 h-4" /> 수정
                  </button>
                  {isCompleted && (
                    <>
                      <button
                        type="button"
                        disabled={isTaxInvoiceIssued(card)}
                        onClick={() => openTaxInvoiceModal(card)}
                        className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium ${
                          isTaxInvoiceIssued(card)
                            ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
                            : 'bg-violet-50 text-violet-700 hover:bg-violet-100'
                        }`}
                      >
                        <Receipt className="w-4 h-4" /> 세금계산서 발행
                      </button>
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
        <div className="flex items-center justify-between gap-3">
          {tab === 'no_tax' ? (
            <div className="text-base font-semibold text-slate-700">
              총 금액 : {fmt(noTaxTotalAmount)}원
            </div>
          ) : <div />}
          <Pagination
            page={page}
            totalPages={totalPages}
            onPageChange={pg => setListParams({ page: String(pg) })}
            totalItems={totalItems}
            pageSize={pageSize}
          />
        </div>
      </div>

      {taxInvoiceModal && (
        <Modal title="세금계산서 발행일자 선택" onClose={closeTaxInvoiceModal}>
          <div className="space-y-4">
            <p className="text-sm text-slate-600">
              <span className="font-medium text-slate-900">{taxInvoiceModal.doc_no}</span>
              <span className="mx-1">·</span>
              {taxInvoiceModal.partner_name}
            </p>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">발행일자</label>
              <button
                type="button"
                disabled={taxInvoiceSubmitting}
                onClick={() => taxInvoiceDateInputRef.current?.showPicker()}
                className={`${inp} w-full text-left tabular-nums text-slate-900 disabled:opacity-50 disabled:cursor-not-allowed`}
              >
                {taxInvoiceDate ? formatYmdSlash(taxInvoiceDate) : '—'}
              </button>
              <input
                ref={taxInvoiceDateInputRef}
                type="date"
                className="sr-only"
                value={taxInvoiceDate}
                onChange={e => setTaxInvoiceDate(e.target.value)}
                disabled={taxInvoiceSubmitting}
                tabIndex={-1}
                aria-hidden
              />
            </div>
            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={closeTaxInvoiceModal}
                disabled={taxInvoiceSubmitting}
                className="px-4 py-2 text-sm text-slate-600 hover:text-slate-800 disabled:opacity-50"
              >
                취소
              </button>
              <button
                type="button"
                onClick={confirmTaxInvoiceIssue}
                disabled={taxInvoiceSubmitting || !taxInvoiceDate}
                className="px-4 py-2 bg-violet-600 text-white rounded-xl text-sm font-medium hover:bg-violet-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {taxInvoiceSubmitting ? '처리 중…' : '발행'}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </motion.div>
  );
}
