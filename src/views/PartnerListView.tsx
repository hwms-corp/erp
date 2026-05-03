import { useState, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'motion/react';
import { Plus, Search, Edit3, Calendar, Trash2 } from 'lucide-react';
import { usePartners } from '@/hooks/usePartners';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/lib/supabase';
import { Modal } from '@/components/Modal';
import { Pagination, usePagination } from '@/components/Pagination';
import { PARTNER_TYPE_LABELS, BIZ_TYPE_LABELS, fmt, fmtW } from '@/types';
import type { Partner, PartnerType, BizType } from '@/types';

const inp = 'w-full px-3 py-2 border border-slate-300 rounded-lg text-sm outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500';

export function PartnerListView() {
  const { user } = useAuth();
  const { partners, fetchPartners, createPartner, updatePartner, deletePartner } = usePartners();
  const navigate = useNavigate();
  const [modal, setModal] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [form, setForm] = useState({ code: '', name: '', type: 'sales' as PartnerType, biz_no: '', biz_type: 'corporate' as BizType, rep: '', tel: '', fax: '', addr: '', bank: '', account: '', email: '' });
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [searchCol, setSearchCol] = useState('all');
  const [filter, setFilter] = useState('all');
  const [page, setPage] = useState(1);
  const [delivDateFrom, setDelivDateFrom] = useState('');
  const [delivDateTo, setDelivDateTo] = useState('');
  const [delivFilter, setDelivFilter] = useState(false);
  const [delivPartnerIds, setDelivPartnerIds] = useState<Set<number> | null>(null);

  useEffect(() => { fetchPartners(); }, [fetchPartners]);

  useEffect(() => {
    if (!delivFilter) { setDelivPartnerIds(null); return; }
    const load = async () => {
      let q = supabase.from('orders').select('partner_id').eq('delivery_status', 'completed').is('deleted_at', null);
      if (delivDateFrom) q = q.gte('delivery_date', delivDateFrom);
      if (delivDateTo) q = q.lte('delivery_date', delivDateTo);
      const { data } = await q;
      if (data) setDelivPartnerIds(new Set(data.map(r => r.partner_id)));
    };
    load();
  }, [delivFilter, delivDateFrom, delivDateTo]);

  const searchCols = [
    { k: 'all', l: '전체' }, { k: 'name', l: '거래처명' }, { k: 'biz_no', l: '사업자번호' },
    { k: 'rep', l: '대표자' }, { k: 'tel', l: '전화번호' }, { k: 'email', l: '메일주소' },
  ];

  const role = user?.role;
  const tabs = role === 'sales' ? ['all', 'sales'] : role === 'purchasing' ? ['all', 'purchasing'] : ['all', 'sales', 'purchasing'];
  const tabLabels: Record<string, string> = { all: '전체', sales: '영업', purchasing: '구매' };

  const visible = useMemo(() => {
    let list = partners;
    if (role === 'sales') list = list.filter(p => p.type === 'sales' || p.type === 'both');
    if (role === 'purchasing') list = list.filter(p => p.type === 'purchasing' || p.type === 'both');
    if (filter !== 'all') list = list.filter(p => p.type === filter || p.type === 'both');
    if (delivPartnerIds) list = list.filter(p => delivPartnerIds.has(p.id));
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(p => {
        if (searchCol === 'all') return p.name.toLowerCase().includes(q) || p.biz_no.includes(q) || p.code.toLowerCase().includes(q) || p.rep.toLowerCase().includes(q) || (p.email || '').toLowerCase().includes(q) || (p.tel || '').includes(q);
        const v = (p as unknown as Record<string, unknown>)[searchCol];
        return typeof v === 'string' && v.toLowerCase().includes(q);
      });
    }
    return list;
  }, [partners, role, filter, search, searchCol, delivPartnerIds]);

  const { totalItems, totalPages, pageSize, getPage } = usePagination(visible);
  const pagedVisible = getPage(page);

  useEffect(() => { setPage(1); }, [search, searchCol, filter, delivPartnerIds]);

  const openNew = () => {
    setEditId(null);
    setForm({ code: '', name: '', type: role === 'purchasing' ? 'purchasing' : 'sales', biz_no: '', biz_type: 'corporate', rep: '', tel: '', fax: '', addr: '', bank: '', account: '', email: '' });
    setModal(true);
  };
  const openEdit = (p: Partner, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditId(p.id);
    setForm({ code: p.code, name: p.name, type: p.type, biz_no: p.biz_no, biz_type: p.biz_type, rep: p.rep, tel: p.tel || '', fax: p.fax || '', addr: p.addr || '', bank: p.bank || '', account: p.account || '', email: p.email || '' });
    setModal(true);
  };
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (editId) {
      const { error } = await updatePartner(editId, form);
      if (error) { alert('수정 실패: ' + (error.message || JSON.stringify(error))); return; }
    } else {
      let code = form.code;
      if (!code) {
        const nums = partners.map(p => { const m = p.code.match(/^PTN-(\d+)$/); return m ? Number(m[1]) : 0; });
        const next = (nums.length > 0 ? Math.max(...nums) : 0) + 1;
        code = `PTN-${String(next).padStart(3, '0')}`;
      }
      const { error } = await createPartner({ ...form, code });
      if (error) { alert('등록 실패: ' + (error.message || JSON.stringify(error))); return; }
    }
    setModal(false);
  };

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-slate-900">거래처 관리</h2>
        <button onClick={openNew} className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 text-sm font-medium shadow-sm">
          <Plus className="w-4 h-4" /> 거래처 등록
        </button>
      </div>
      <div className="flex gap-1 border-b border-slate-200 pb-0">
        {tabs.map(t => (
          <button key={t} onClick={() => setFilter(t)} className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${filter === t ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}>
            {tabLabels[t]}
          </button>
        ))}
      </div>
      <div className="flex gap-3 items-center flex-wrap">
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
      <div className="flex items-center gap-3 flex-wrap">
        <label className="flex items-center gap-2 text-sm cursor-pointer select-none">
          <input type="checkbox" checked={delivFilter} onChange={e => setDelivFilter(e.target.checked)} className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500" />
          <span className="text-slate-700 font-medium">납품완료 거래처만</span>
        </label>
        {delivFilter && (
          <div className="flex items-center gap-2 text-sm">
            <Calendar className="w-4 h-4 text-slate-400" />
            <input type="date" className={`${inp} !w-36`} value={delivDateFrom} onChange={e => setDelivDateFrom(e.target.value)} />
            <span className="text-slate-400">~</span>
            <input type="date" className={`${inp} !w-36`} value={delivDateTo} onChange={e => setDelivDateTo(e.target.value)} />
          </div>
        )}
      </div>
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-x-auto">
        <table className="w-full text-sm text-left min-w-[900px] whitespace-nowrap">
          <thead className="bg-slate-50 text-slate-500 border-b border-slate-200">
            <tr>
              <th className="px-4 py-3">구분</th><th className="px-4 py-3">거래처명</th><th className="px-4 py-3">사업자번호</th>
              <th className="px-4 py-3">대표자</th><th className="px-4 py-3">전화번호</th><th className="px-4 py-3 text-right">관리</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {pagedVisible.map(p => (
              <tr key={p.id} className="hover:bg-slate-50">
                <td className="px-4 py-3">
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                    p.type === 'both' ? 'bg-purple-100 text-purple-700' :
                    p.type === 'sales' ? 'bg-blue-100 text-blue-700' : 'bg-orange-100 text-orange-700'
                  }`}>{PARTNER_TYPE_LABELS[p.type]}</span>
                </td>
                <td className="px-4 py-3 font-medium text-indigo-600 hover:underline cursor-pointer" onClick={() => navigate(`/partners/${p.code}`)}>{p.name}</td>
                <td className="px-4 py-3 text-slate-600">{p.biz_no}</td>
                <td className="px-4 py-3 text-slate-600">{p.rep}</td>
                <td className="px-4 py-3 text-slate-600">{p.tel}</td>
                <td className="px-4 py-3 text-right">
                  <div className="flex items-center justify-end gap-1">
                    <button onClick={(e) => openEdit(p, e)} className="p-1.5 text-slate-400 hover:text-indigo-600" title="수정"><Edit3 className="w-4 h-4" /></button>
                    <button
                      onClick={async (e) => {
                        e.stopPropagation();
                        if (!confirm(`"${p.name}" 거래처를 삭제하시겠습니까?`)) return;
                        const { error } = await deletePartner(p.id);
                        if (error) alert('삭제 실패: ' + (error.message || JSON.stringify(error)));
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
            {pagedVisible.length === 0 && <tr><td colSpan={6} className="px-4 py-12 text-center text-slate-400">검색 결과가 없습니다</td></tr>}
          </tbody>
        </table>
        <Pagination page={page} totalPages={totalPages} onPageChange={setPage} totalItems={totalItems} pageSize={pageSize} />
      </div>
      {modal && (
        <Modal title={editId ? '거래처 수정' : '거래처 등록'} onClose={() => setModal(false)} wide>
          <form onSubmit={submit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div><label className="block text-sm font-medium text-slate-700 mb-1">구분 *</label>
                <select className={inp} value={form.type} onChange={e => setForm({ ...form, type: e.target.value as PartnerType })}>
                  <option value="sales">영업</option><option value="purchasing">구매</option><option value="both">영업/구매</option>
                </select>
              </div>
              <div><label className="block text-sm font-medium text-slate-700 mb-1">개인/법인 *</label>
                <select className={inp} value={form.biz_type} onChange={e => setForm({ ...form, biz_type: e.target.value as BizType })}>
                  <option value="corporate">법인</option><option value="individual">개인</option>
                </select>
              </div>
            </div>
            <div><label className="block text-sm font-medium text-slate-700 mb-1">상호(거래처명) *</label><input required className={inp} value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} /></div>
            <div className="grid grid-cols-2 gap-4">
              <div><label className="block text-sm font-medium text-slate-700 mb-1">사업자등록번호 *</label><input required placeholder="000-00-00000" className={inp} value={form.biz_no} onChange={e => setForm({ ...form, biz_no: e.target.value })} /></div>
              <div><label className="block text-sm font-medium text-slate-700 mb-1">대표자 *</label><input required className={inp} value={form.rep} onChange={e => setForm({ ...form, rep: e.target.value })} /></div>
            </div>
            <div><label className="block text-sm font-medium text-slate-700 mb-1">주소</label><input className={inp} value={form.addr} onChange={e => setForm({ ...form, addr: e.target.value })} /></div>
            <div className="grid grid-cols-2 gap-4">
              <div><label className="block text-sm font-medium text-slate-700 mb-1">전화번호</label><input className={inp} value={form.tel} onChange={e => setForm({ ...form, tel: e.target.value })} /></div>
              <div><label className="block text-sm font-medium text-slate-700 mb-1">팩스번호</label><input className={inp} value={form.fax} onChange={e => setForm({ ...form, fax: e.target.value })} /></div>
            </div>
            <div><label className="block text-sm font-medium text-slate-700 mb-1">메일주소</label><input type="email" className={inp} value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} /></div>
            <div className="grid grid-cols-2 gap-4">
              <div><label className="block text-sm font-medium text-slate-700 mb-1">은행</label><input className={inp} value={form.bank} onChange={e => setForm({ ...form, bank: e.target.value })} /></div>
              <div><label className="block text-sm font-medium text-slate-700 mb-1">계좌번호</label><input className={inp} value={form.account} onChange={e => setForm({ ...form, account: e.target.value })} /></div>
            </div>
            <button type="submit" className="w-full py-2.5 bg-indigo-600 text-white rounded-lg font-medium hover:bg-indigo-700 mt-4">{editId ? '수정' : '등록'}</button>
          </form>
        </Modal>
      )}
    </motion.div>
  );
}
