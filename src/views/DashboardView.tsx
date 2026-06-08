import { useState, useEffect, useMemo, useCallback } from 'react';
import { motion } from 'motion/react';
import { ChevronLeft, ChevronRight, Search, Building2, TrendingUp, ShoppingCart } from 'lucide-react';
import { MonthlySalesChart } from '@/components/MonthlySalesChart';
import { PartnerSearchModal } from '@/components/PartnerSearchModal';
import {
  useDashboard,
  MONTH_LABELS,
  aggregatePartnerMatrix,
  aggregateMonthlyPurchases,
  subtractMonthly,
} from '@/hooks/useDashboard';
import { usePartners } from '@/hooks/usePartners';
import { fmtW } from '@/types';
import type { Partner } from '@/types';
import type { MonthlySalesPoint } from '@/hooks/useDashboard';

type ViewMode = 'table' | 'graph';
type SalesTab = 'total' | 'partner';

const currentYear = () => new Date().getFullYear();

const MONTH_COL = 'w-[108px] min-w-[108px] max-w-[108px]';
const TOTAL_COL = 'w-[140px] min-w-[140px] max-w-[140px]';
const PARTNER_COL = 'w-[160px] min-w-[160px] max-w-[160px]';
const CODE_COL = 'w-[100px] min-w-[100px] max-w-[100px]';

function SalesSubTabs({ tab, onChange }: { tab: SalesTab; onChange: (t: SalesTab) => void }) {
  return (
    <div className="flex gap-1 p-1 bg-slate-100 rounded-xl w-fit">
      <button
        type="button"
        onClick={() => onChange('total')}
        className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
          tab === 'total' ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-600 hover:text-slate-900'
        }`}
      >
        전체 매출
      </button>
      <button
        type="button"
        onClick={() => onChange('partner')}
        className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
          tab === 'partner' ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-600 hover:text-slate-900'
        }`}
      >
        거래처별 매출
      </button>
    </div>
  );
}

function MatrixCell({ value, emphasis }: { value: number; emphasis?: boolean }) {
  return (
    <td
      className={`${MONTH_COL} px-2 py-2.5 text-right text-sm whitespace-nowrap overflow-visible ${
        value > 0
          ? emphasis ? 'text-indigo-800 font-semibold' : 'text-slate-900'
          : 'text-slate-300'
      }`}
    >
      {value > 0 ? fmtW(value) : '-'}
    </td>
  );
}

function TotalCell({ value, emphasis, variant }: { value: number; emphasis?: boolean; variant?: 'sales' | 'purchase' | 'diff' }) {
  const color =
    variant === 'purchase' ? 'text-orange-700' :
    variant === 'diff' ? (value < 0 ? 'text-red-600' : value > 0 ? 'text-blue-700' : 'text-slate-300') :
    variant === 'sales' ? 'text-lime-700' :
    emphasis ? 'text-indigo-700' : 'text-slate-900';

  return (
    <td
      className={`${TOTAL_COL} px-3 py-2.5 text-right text-sm whitespace-nowrap overflow-visible font-medium ${
        emphasis ? 'font-semibold' : ''
      } ${color}`}
    >
      {value === 0 ? '-' : fmtW(value)}
    </td>
  );
}

function TableRowLabel({ title, sub, className }: { title: string; sub?: string; className?: string }) {
  return (
    <td className={`px-4 py-3 font-medium leading-snug ${className ?? ''}`}>
      {title}
      {sub && (
        <>
          <br />
          <span className="text-xs font-normal">({sub})</span>
        </>
      )}
    </td>
  );
}

function DiffCell({ value, emphasis }: { value: number; emphasis?: boolean }) {
  const color =
    value < 0 ? 'text-red-600' :
    value > 0 ? (emphasis ? 'text-blue-800' : 'text-blue-700') :
    'text-slate-300';

  return (
    <td
      className={`${MONTH_COL} px-2 py-2.5 text-right text-sm whitespace-nowrap overflow-visible ${color} ${
        emphasis ? 'font-semibold' : ''
      }`}
    >
      {value === 0 ? '-' : fmtW(value)}
    </td>
  );
}

export function DashboardView() {
  const { fetchYearlySales, fetchYearlyPurchases, aggregateMonthlySales } = useDashboard();
  const { partners, fetchPartners } = usePartners();

  const [year, setYear] = useState(currentYear);
  const [viewMode, setViewMode] = useState<ViewMode>('table');
  const [salesTab, setSalesTab] = useState<SalesTab>('total');
  const [graphPartner, setGraphPartner] = useState<Partner | null>(null);
  const [tablePartnerQuery, setTablePartnerQuery] = useState('');
  const [showPartnerModal, setShowPartnerModal] = useState(false);
  const [rawSalesRows, setRawSalesRows] = useState<Awaited<ReturnType<typeof fetchYearlySales>>['data']>([]);
  const [rawPurchaseRows, setRawPurchaseRows] = useState<Awaited<ReturnType<typeof fetchYearlyPurchases>>['data']>([]);
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(async () => {
    setLoading(true);
    const [sales, purchases] = await Promise.all([
      fetchYearlySales(year),
      fetchYearlyPurchases(year),
    ]);
    setRawSalesRows(sales.data ?? []);
    setRawPurchaseRows(purchases.data ?? []);
    setLoading(false);
  }, [fetchYearlySales, fetchYearlyPurchases, year]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    fetchPartners();
  }, [fetchPartners]);

  const totalMonthlyData: MonthlySalesPoint[] = useMemo(() => {
    if (!rawSalesRows) return [];
    return aggregateMonthlySales(rawSalesRows, year);
  }, [rawSalesRows, year, aggregateMonthlySales]);

  const totalPurchaseData: MonthlySalesPoint[] = useMemo(() => {
    if (!rawPurchaseRows) return [];
    return aggregateMonthlyPurchases(rawPurchaseRows, year);
  }, [rawPurchaseRows, year]);

  const netMonthlyData: MonthlySalesPoint[] = useMemo(
    () => subtractMonthly(totalMonthlyData, totalPurchaseData),
    [totalMonthlyData, totalPurchaseData],
  );

  const graphMonthlyData: MonthlySalesPoint[] = useMemo(() => {
    if (salesTab === 'partner' && !graphPartner) {
      return aggregateMonthlySales([], year);
    }
    if (!rawSalesRows) return [];
    return aggregateMonthlySales(
      rawSalesRows,
      year,
      salesTab === 'partner' ? graphPartner!.id : undefined,
    );
  }, [rawSalesRows, year, salesTab, graphPartner, aggregateMonthlySales]);

  const partnerMatrix = useMemo(() => {
    if (!rawSalesRows) return [];
    return aggregatePartnerMatrix(rawSalesRows, year, partners);
  }, [rawSalesRows, year, partners]);

  const filteredPartnerMatrix = useMemo(() => {
    if (!tablePartnerQuery.trim()) return partnerMatrix;
    const q = tablePartnerQuery.trim().toLowerCase();
    return partnerMatrix.filter(
      p => p.partner_name.toLowerCase().includes(q) || p.partner_code.toLowerCase().includes(q),
    );
  }, [partnerMatrix, tablePartnerQuery]);

  const yearSalesTotal = useMemo(
    () => totalMonthlyData.reduce((s, m) => s + m.total_amount, 0),
    [totalMonthlyData],
  );

  const yearPurchaseTotal = useMemo(
    () => totalPurchaseData.reduce((s, m) => s + m.total_amount, 0),
    [totalPurchaseData],
  );

  const yearNetTotal = yearSalesTotal - yearPurchaseTotal;

  const yearTotal = useMemo(() => {
    if (salesTab === 'partner') {
      if (viewMode === 'table') {
        return filteredPartnerMatrix.reduce((s, r) => s + r.total, 0);
      }
      return graphMonthlyData.reduce((s, m) => s + m.total_amount, 0);
    }
    return yearSalesTotal;
  }, [salesTab, viewMode, filteredPartnerMatrix, graphMonthlyData, yearSalesTotal]);

  const chartSeries = useMemo(() => {
    if (salesTab === 'total') {
      return [
        {
          label: '매출금액 (납품완료)',
          color: '#84cc16',
          points: totalMonthlyData.map(m => ({ label: m.label, value: m.total_amount })),
        },
        {
          label: '구매금액 (입고완료)',
          color: '#ea580c',
          points: totalPurchaseData.map(m => ({ label: m.label, value: m.total_amount })),
        },
        {
          label: '매출-구매',
          color: '#2563eb',
          points: netMonthlyData.map(m => ({ label: m.label, value: m.total_amount })),
        },
      ];
    }
    return [{
      label: '매출금액 (납품완료)',
      color: '#84cc16',
      points: graphMonthlyData.map(m => ({ label: m.label, value: m.total_amount })),
    }];
  }, [salesTab, totalMonthlyData, totalPurchaseData, netMonthlyData, graphMonthlyData]);

  const monthTotals = useMemo(
    () => MONTH_LABELS.map((_, i) => filteredPartnerMatrix.reduce((s, r) => s + r.amounts[i], 0)),
    [filteredPartnerMatrix],
  );

  const graphSubtitle =
    salesTab === 'total'
      ? `${year}년 전체 월별 매출·구매·차액 (납품완료 / 입고완료 기준)`
      : graphPartner
        ? `${year}년 ${graphPartner.name} 월별 합계 매출`
        : `${year}년 거래처를 선택해 주세요`;

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">대시보드</h2>
          <p className="text-sm text-slate-500 mt-1">납품완료 기준 월별 매출 현황</p>
        </div>

        <div className="flex items-center gap-2 bg-white border border-slate-200 rounded-xl px-2 py-1.5 shadow-sm self-start">
          <button
            type="button"
            onClick={() => setYear(y => y - 1)}
            className="p-2 rounded-lg hover:bg-slate-100 text-slate-600 transition-colors"
            aria-label="이전 년도"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <span className="min-w-[5rem] text-center font-semibold text-slate-900">{year}년</span>
          <button
            type="button"
            onClick={() => setYear(y => y + 1)}
            className="p-2 rounded-lg hover:bg-slate-100 text-slate-600 transition-colors"
            aria-label="다음 년도"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {salesTab === 'total' ? (
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 sm:col-span-1 space-y-4">
            <div>
              <div className="flex items-center gap-2 text-slate-500 text-xs mb-1">
                <TrendingUp className="w-4 h-4 text-lime-600" />
                {year}년 매출금액 (납품완료)
              </div>
              <p className="text-2xl font-bold text-lime-700">{fmtW(yearSalesTotal)}</p>
            </div>
            <div>
              <div className="flex items-center gap-2 text-slate-500 text-xs mb-1">
                <ShoppingCart className="w-4 h-4 text-orange-600" />
                {year}년 구매금액 (입고완료)
              </div>
              <p className="text-2xl font-bold text-orange-600">{fmtW(yearPurchaseTotal)}</p>
            </div>
          </div>
        ) : (
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 sm:col-span-1">
            <div className="flex items-center gap-2 text-slate-500 text-xs mb-2">
              <TrendingUp className="w-4 h-4 text-indigo-600" />
              {year}년 합계 매출
            </div>
            <p className="text-2xl font-bold text-indigo-700">{fmtW(yearTotal)}</p>
          </div>
        )}
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm">
        <div className="px-4 sm:px-6 pt-4 border-b border-slate-100 space-y-4">
          <div className="flex gap-1 p-1 bg-slate-200 rounded-xl w-fit">
            <button
              type="button"
              onClick={() => setViewMode('table')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                viewMode === 'table' ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              표
            </button>
            <button
              type="button"
              onClick={() => setViewMode('graph')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                viewMode === 'graph' ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              그래프
            </button>
          </div>

          <SalesSubTabs tab={salesTab} onChange={setSalesTab} />

          {viewMode === 'graph' && salesTab === 'partner' && (
            <div className="flex flex-wrap items-center gap-3 pb-4">
              <button
                type="button"
                onClick={() => setShowPartnerModal(true)}
                className="inline-flex items-center gap-2 px-4 py-2.5 bg-indigo-600 text-white rounded-xl text-sm font-medium hover:bg-indigo-700 transition-colors"
              >
                <Search className="w-4 h-4" />
                거래처 검색
              </button>
              {graphPartner ? (
                <div className="inline-flex items-center gap-2 px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm">
                  <Building2 className="w-4 h-4 text-slate-400" />
                  <span className="font-medium text-slate-900">{graphPartner.name}</span>
                  <span className="text-slate-500">{graphPartner.code}</span>
                </div>
              ) : (
                <span className="text-sm text-slate-400">거래처를 선택하면 그래프가 표시됩니다</span>
              )}
            </div>
          )}

          {viewMode === 'table' && salesTab === 'partner' && (
            <div className="flex items-center gap-2 bg-slate-50 rounded-xl px-3 py-2 border border-slate-200 max-w-md pb-4">
              <Search className="w-4 h-4 text-slate-400 shrink-0" />
              <input
                type="text"
                className="flex-1 bg-transparent outline-none text-sm"
                placeholder="거래처명·코드 검색..."
                value={tablePartnerQuery}
                onChange={e => setTablePartnerQuery(e.target.value)}
              />
            </div>
          )}
        </div>

        <div className="px-4 sm:px-6 py-5">
          {loading ? (
            <div className="flex items-center justify-center h-64">
              <div className="w-8 h-8 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin" />
            </div>
          ) : viewMode === 'graph' ? (
            <>
              <p className="text-sm text-slate-500 mb-4">{graphSubtitle}</p>
              {salesTab === 'partner' && !graphPartner ? (
                <div className="flex items-center justify-center h-64 text-slate-400 text-sm">
                  거래처 검색 버튼을 눌러 매출을 조회할 거래처를 선택해 주세요
                </div>
              ) : (
                <MonthlySalesChart series={chartSeries} />
              )}
            </>
          ) : salesTab === 'total' ? (
            <div className="overflow-x-auto">
              <table className="table-fixed text-sm text-left w-[1636px]">
                <colgroup>
                  <col className="w-[120px]" />
                  {MONTH_LABELS.map(m => (
                    <col key={m} className="w-[108px]" />
                  ))}
                  <col className="w-[140px]" />
                </colgroup>
                <thead className="bg-slate-50 text-slate-500 border-b border-slate-200">
                  <tr>
                    <th className="px-4 py-3">구분</th>
                    {MONTH_LABELS.map(m => (
                      <th key={m} className={`${MONTH_COL} px-2 py-3 text-right`}>{m}</th>
                    ))}
                    <th className={`${TOTAL_COL} px-3 py-3 text-right font-semibold text-indigo-700`}>합계</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  <tr className="hover:bg-slate-50">
                    <TableRowLabel title="매출금액" sub="납품완료" className="text-lime-700" />
                    {totalMonthlyData.map(m => (
                      <MatrixCell key={m.month} value={m.total_amount} />
                    ))}
                    <TotalCell value={yearSalesTotal} emphasis variant="sales" />
                  </tr>
                  <tr className="hover:bg-slate-50">
                    <TableRowLabel title="구매금액" sub="입고완료" className="text-orange-700" />
                    {totalPurchaseData.map(m => (
                      <MatrixCell key={m.month} value={m.total_amount} />
                    ))}
                    <TotalCell value={yearPurchaseTotal} emphasis variant="purchase" />
                  </tr>
                  <tr className="bg-blue-50/60">
                    <TableRowLabel title="매출-구매" className="font-semibold text-blue-900" />
                    {netMonthlyData.map(m => (
                      <DiffCell key={m.month} value={m.total_amount} emphasis />
                    ))}
                    <TotalCell value={yearNetTotal} emphasis variant="diff" />
                  </tr>
                </tbody>
              </table>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="table-fixed text-sm text-left w-[1696px]">
                <colgroup>
                  <col className="w-[160px]" />
                  <col className="w-[100px]" />
                  {MONTH_LABELS.map(m => (
                    <col key={m} className="w-[108px]" />
                  ))}
                  <col className="w-[140px]" />
                </colgroup>
                <thead className="bg-slate-50 text-slate-500 border-b border-slate-200">
                  <tr>
                    <th className={`${PARTNER_COL} px-4 py-3 sticky left-0 bg-slate-50 z-10`}>거래처</th>
                    <th className={`${CODE_COL} px-3 py-3 sticky left-[160px] bg-slate-50 z-10`}>코드</th>
                    {MONTH_LABELS.map(m => (
                      <th key={m} className={`${MONTH_COL} px-2 py-3 text-right`}>{m}</th>
                    ))}
                    <th className={`${TOTAL_COL} px-3 py-3 text-right font-semibold text-indigo-700`}>합계</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredPartnerMatrix.length === 0 ? (
                    <tr>
                      <td colSpan={15} className="px-4 py-12 text-center text-slate-400">
                        검색 결과가 없습니다
                      </td>
                    </tr>
                  ) : (
                    filteredPartnerMatrix.map(row => (
                      <tr key={row.partner_id} className="hover:bg-slate-50">
                        <td className={`${PARTNER_COL} px-4 py-2.5 font-medium text-slate-900 sticky left-0 bg-white truncate`}>
                          {row.partner_name}
                        </td>
                        <td className={`${CODE_COL} px-3 py-2.5 text-slate-500 sticky left-[160px] bg-white`}>
                          {row.partner_code}
                        </td>
                        {row.amounts.map((amt, i) => (
                          <MatrixCell key={i} value={amt} />
                        ))}
                        <TotalCell value={row.total} />
                      </tr>
                    ))
                  )}
                  {filteredPartnerMatrix.length > 0 && (
                    <tr className="bg-indigo-50/60 border-t border-slate-200">
                      <td className={`${PARTNER_COL} px-4 py-3 text-indigo-900 font-semibold sticky left-0 bg-indigo-50/60`} colSpan={2}>
                        합계
                      </td>
                      {monthTotals.map((amt, i) => (
                        <MatrixCell key={i} value={amt} emphasis />
                      ))}
                      <TotalCell value={yearTotal} emphasis />
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {showPartnerModal && (
        <PartnerSearchModal
          partners={partners}
          title="그래프 조회 거래처 선택"
          onSelect={setGraphPartner}
          onClose={() => setShowPartnerModal(false)}
        />
      )}
    </motion.div>
  );
}
