import { useState, useEffect, useMemo, useCallback } from 'react';
import { motion } from 'motion/react';
import { ChevronLeft, ChevronRight, Search, Building2, TrendingUp } from 'lucide-react';
import { MonthlySalesChart } from '@/components/MonthlySalesChart';
import { PartnerSearchModal } from '@/components/PartnerSearchModal';
import { useDashboard } from '@/hooks/useDashboard';
import { usePartners } from '@/hooks/usePartners';
import { fmtW } from '@/types';
import type { Partner } from '@/types';
import type { MonthlySalesPoint } from '@/hooks/useDashboard';

type Tab = 'total' | 'partner';

const currentYear = () => new Date().getFullYear();

export function DashboardView() {
  const { fetchYearlySales, aggregateMonthlySales } = useDashboard();
  const { partners, fetchPartners } = usePartners();

  const [year, setYear] = useState(currentYear);
  const [tab, setTab] = useState<Tab>('total');
  const [selectedPartner, setSelectedPartner] = useState<Partner | null>(null);
  const [showPartnerModal, setShowPartnerModal] = useState(false);
  const [rawRows, setRawRows] = useState<Awaited<ReturnType<typeof fetchYearlySales>>['data']>([]);
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(async () => {
    setLoading(true);
    const { data } = await fetchYearlySales(year);
    setRawRows(data ?? []);
    setLoading(false);
  }, [fetchYearlySales, year]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    fetchPartners();
  }, [fetchPartners]);

  const monthlyData: MonthlySalesPoint[] = useMemo(() => {
    if (tab === 'partner' && !selectedPartner) {
      return aggregateMonthlySales([], year);
    }
    if (!rawRows) return [];
    return aggregateMonthlySales(
      rawRows,
      year,
      tab === 'partner' ? selectedPartner!.id : undefined,
    );
  }, [rawRows, year, tab, selectedPartner, aggregateMonthlySales]);

  const yearTotal = useMemo(
    () => monthlyData.reduce((s, m) => s + m.total_amount, 0),
    [monthlyData],
  );

  const chartPoints = useMemo(
    () => monthlyData.map(m => ({ label: m.label, value: m.total_amount })),
    [monthlyData],
  );

  const subtitle =
    tab === 'total'
      ? `${year}년 전체 월별 합계 매출 (납품완료 기준)`
      : selectedPartner
        ? `${year}년 ${selectedPartner.name} 월별 합계 매출`
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
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 sm:col-span-1">
          <div className="flex items-center gap-2 text-slate-500 text-xs mb-2">
            <TrendingUp className="w-4 h-4 text-indigo-600" />
            {year}년 합계 매출
          </div>
          <p className="text-2xl font-bold text-indigo-700">{fmtW(yearTotal)}</p>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-4 sm:px-6 pt-4 border-b border-slate-100 space-y-4">
          <div className="flex gap-1 p-1 bg-slate-100 rounded-xl w-fit">
            <button
              type="button"
              onClick={() => setTab('total')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                tab === 'total'
                  ? 'bg-white text-indigo-700 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              전체 매출
            </button>
            <button
              type="button"
              onClick={() => setTab('partner')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                tab === 'partner'
                  ? 'bg-white text-indigo-700 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              거래처별 매출
            </button>
          </div>

          {tab === 'partner' && (
            <div className="flex flex-wrap items-center gap-3 pb-4">
              <button
                type="button"
                onClick={() => setShowPartnerModal(true)}
                className="inline-flex items-center gap-2 px-4 py-2.5 bg-indigo-600 text-white rounded-xl text-sm font-medium hover:bg-indigo-700 transition-colors"
              >
                <Search className="w-4 h-4" />
                거래처 검색
              </button>
              {selectedPartner ? (
                <div className="inline-flex items-center gap-2 px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm">
                  <Building2 className="w-4 h-4 text-slate-400" />
                  <span className="font-medium text-slate-900">{selectedPartner.name}</span>
                  <span className="text-slate-500">{selectedPartner.code}</span>
                </div>
              ) : (
                <span className="text-sm text-slate-400">거래처를 선택하면 그래프가 표시됩니다</span>
              )}
            </div>
          )}
        </div>

        <div className="px-4 sm:px-6 py-5">
          <p className="text-sm text-slate-500 mb-4">{subtitle}</p>

          {loading ? (
            <div className="flex items-center justify-center h-64">
              <div className="w-8 h-8 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin" />
            </div>
          ) : tab === 'partner' && !selectedPartner ? (
            <div className="flex items-center justify-center h-64 text-slate-400 text-sm">
              거래처 검색 버튼을 눌러 매출을 조회할 거래처를 선택해 주세요
            </div>
          ) : (
            <MonthlySalesChart points={chartPoints} />
          )}
        </div>
      </div>

      {showPartnerModal && (
        <PartnerSearchModal
          partners={partners}
          title="매출 조회 거래처 선택"
          onSelect={setSelectedPartner}
          onClose={() => setShowPartnerModal(false)}
        />
      )}
    </motion.div>
  );
}
