import { useState, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'motion/react';
import { Search, Calendar, Plus, Trash2, Edit } from 'lucide-react';
import { StatusBadge } from '@/components/StatusBadge';
import { usePOs } from '@/hooks/usePOs';
import { supabase } from '@/lib/supabase';
import { Pagination, usePagination } from '@/components/Pagination';
import { fmtW, monthStart, monthEnd, PAYMENT_TERMS_LABELS } from '@/types';
import type { PaymentTerms } from '@/types';

const inp = 'w-full px-3 py-2 border border-slate-300 rounded-lg text-sm outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500';

export function POSearchView() {
  const navigate = useNavigate();
  const { pos, fetchPOs, deletePO } = usePOs();
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [searchCol, setSearchCol] = useState('all');
  const [dateFrom, setDateFrom] = useState(monthStart);
  const [dateTo, setDateTo] = useState(monthEnd);
  const [page, setPage] = useState(1);
  const [poItemData, setPoItemData] = useState<Map<number, string>>(new Map());
  const [poItemSpecs, setPoItemSpecs] = useState<Map<number, string>>(new Map());
  const searchCols = [
    { k: 'all', l: '전체' },
    { k: 'doc_no', l: '발주번호' },
    { k: 'partner', l: '거래처' },
    { k: 'name', l: '품명' },
    { k: 'spec', l: '사양' },
  ];

  useEffect(() => { fetchPOs(); }, [fetchPOs]);

  useEffect(() => {
    if (pos.length === 0) return;
    const ids = pos.map(p => p.id);
    supabase.from('po_items').select('po_id, name, spec').in('po_id', ids).is('deleted_at', null).then(({ data }) => {
      if (!data) return;
      const nameMap = new Map<number, string>();
      const specMap = new Map<number, string>();
      data.forEach(it => {
        const prevName = nameMap.get(it.po_id) || '';
        nameMap.set(it.po_id, prevName ? `${prevName} ${it.name}` : it.name);
        if (it.spec) {
          const prevSpec = specMap.get(it.po_id) || '';
          specMap.set(it.po_id, prevSpec ? `${prevSpec} ${it.spec}` : it.spec);
        }
      });
      setPoItemData(nameMap);
      setPoItemSpecs(specMap);
    });
  }, [pos]);

  const filtered = useMemo(() => {
    let list = [...pos];
    if (dateFrom) list = list.filter(p => p.po_date >= dateFrom);
    if (dateTo) list = list.filter(p => p.po_date <= dateTo);
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(p => {
        const names = (poItemData.get(p.id) || '').toLowerCase();
        const specs = (poItemSpecs.get(p.id) || '').toLowerCase();
        if (searchCol === 'all') return p.doc_no.toLowerCase().includes(q) || p.partner_name.toLowerCase().includes(q) || names.includes(q) || specs.includes(q);
        if (searchCol === 'doc_no') return p.doc_no.toLowerCase().includes(q);
        if (searchCol === 'partner') return p.partner_name.toLowerCase().includes(q);
        if (searchCol === 'name') return names.includes(q);
        if (searchCol === 'spec') return specs.includes(q);
        return false;
      });
    }
    return list;
  }, [pos, search, searchCol, dateFrom, dateTo, poItemData, poItemSpecs]);

  const { totalItems, totalPages, pageSize, getPage } = usePagination(filtered);
  const paged = getPage(page);

  useEffect(() => { setPage(1); }, [search, searchCol, dateFrom, dateTo]);

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-slate-900">발주서 관리</h2>
        <button
          onClick={() => navigate('/pos/new')}
          className="flex items-center gap-2 px-4 py-2.5 bg-indigo-600 text-white rounded-xl text-sm font-medium hover:bg-indigo-700 shadow-sm"
        >
          <Plus className="w-4 h-4" /> 발주서 작성
        </button>
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

      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-x-auto">
        <table className="w-full text-sm text-left min-w-[900px] whitespace-nowrap">
          <thead className="bg-slate-50 text-slate-500 border-b border-slate-200">
            <tr>
              <th className="px-4 py-3">일자</th>
              <th className="px-4 py-3">발주번호</th>
              <th className="px-4 py-3">거래처</th>
              <th className="px-4 py-3 text-right">발주금액</th>
              <th className="px-4 py-3 text-right">입고금액</th>
              <th className="px-4 py-3 text-center">결제조건</th>
              <th className="px-4 py-3 text-center">납기요청일</th>
              <th className="px-4 py-3 text-center">상태</th>
              <th className="px-4 py-3 text-center">관리</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {paged.map(p => (
              <tr key={p.id} className="hover:bg-slate-50">
                <td className="px-4 py-3 text-slate-600">{p.po_date}</td>
                <td
                  className="px-4 py-3 font-medium text-indigo-600 cursor-pointer hover:underline"
                  onClick={() => navigate(`/pos/${p.id}/preview`)}
                >
                  {p.doc_no}
                </td>
                <td className="px-4 py-3 font-medium text-slate-900">{p.partner_name}</td>
                <td className="px-4 py-3 text-right font-medium">{fmtW(p.po_amount)}</td>
                <td className="px-4 py-3 text-right text-slate-600">{fmtW(p.received_amount)}</td>
                <td className="px-4 py-3 text-center text-xs">
                  {PAYMENT_TERMS_LABELS[p.payment_terms as PaymentTerms] ?? p.payment_terms}
                </td>
                <td className="px-4 py-3 text-center text-slate-600">{p.required_date ?? '-'}</td>
                <td className="px-4 py-3 text-center">
                  <StatusBadge status={p.status} />
                </td>
                <td className="px-4 py-3 text-center">
                  <div className="flex items-center justify-center gap-1">
                    <button
                      onClick={() => navigate(`/pos/${p.id}/edit`)}
                      className="p-1.5 text-slate-400 hover:text-amber-600 transition-colors"
                      title="수정"
                    >
                      <Edit className="w-4 h-4" />
                    </button>
                    <button
                      onClick={async () => {
                        if (!confirm(`${p.doc_no}을(를) 삭제하시겠습니까?\n삭제 후 복구할 수 없습니다.`)) return;
                        const { error } = await deletePO(p.id);
                        if (error) alert('삭제 실패: ' + (error.message || '오류가 발생했습니다.'));
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
            {paged.length === 0 && (
              <tr><td colSpan={9} className="px-4 py-12 text-center text-slate-400">발주 데이터가 없습니다</td></tr>
            )}
          </tbody>
        </table>
        <Pagination page={page} totalPages={totalPages} onPageChange={setPage} totalItems={totalItems} pageSize={pageSize} />
      </div>
    </motion.div>
  );
}
