import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'motion/react';
import { ArrowLeft, Building2, Phone, Mail, MapPin, Banknote, TrendingUp } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { PARTNER_TYPE_LABELS, BIZ_TYPE_LABELS, fmt, fmtW } from '@/types';
import type { Partner, PartnerDeliverySummary, OrderWithPartner } from '@/types';
import { StatusBadge } from '@/components/StatusBadge';

/** DB/뷰가 월 단위임에도 yyyy-mm-dd로 올 때 표시만 yyyy-mm */
function formatMonthYm(month: string): string {
  const t = month.trim();
  if (/^\d{4}-\d{2}/.test(t)) return t.slice(0, 7);
  return month;
}

export function PartnerDetailView() {
  const { code } = useParams<{ code: string }>();
  const navigate = useNavigate();
  const [partner, setPartner] = useState<Partner | null>(null);
  const [summary, setSummary] = useState<PartnerDeliverySummary[]>([]);
  const [deliveredOrders, setDeliveredOrders] = useState<OrderWithPartner[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!code) return;
    const load = async () => {
      setLoading(true);

      const { data: p } = await supabase
        .from('partners')
        .select('*')
        .eq('code', code)
        .single();

      if (!p) { setLoading(false); return; }
      setPartner(p);

      const { data: sumData } = await supabase
        .from('v_partner_delivery_summary')
        .select('*')
        .eq('partner_id', p.id)
        .order('month', { ascending: false });

      if (sumData) setSummary(sumData);

      const { data: orderData } = await supabase
        .from('v_orders_with_partner')
        .select('*')
        .eq('partner_id', p.id)
        .eq('delivery_status', 'completed')
        .order('delivery_date', { ascending: false });

      if (orderData) setDeliveredOrders(orderData);

      setLoading(false);
    };
    load();
  }, [code]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin" />
      </div>
    );
  }

  if (!partner) {
    return (
      <div className="text-center py-20">
        <p className="text-slate-400 text-lg">거래처를 찾을 수 없습니다</p>
        <button onClick={() => navigate('/partners')} className="mt-4 text-indigo-600 hover:underline text-sm">목록으로 돌아가기</button>
      </div>
    );
  }

  const totalSupply = summary.reduce((s, r) => s + r.supply_amount, 0);
  const totalTax = summary.reduce((s, r) => s + r.tax_amount, 0);
  const totalAmount = summary.reduce((s, r) => s + r.total_amount, 0);
  const totalDeliveries = summary.reduce((s, r) => s + r.delivery_count, 0);

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
      <div className="flex items-center gap-3">
        <button onClick={() => navigate('/partners')} className="p-2 hover:bg-slate-100 rounded-lg transition-colors">
          <ArrowLeft className="w-5 h-5 text-slate-600" />
        </button>
        <div>
          <h2 className="text-2xl font-bold text-slate-900">{partner.name}</h2>
          <p className="text-sm text-slate-500">{partner.code}</p>
        </div>
        <span className={`ml-3 px-2.5 py-1 rounded-full text-xs font-medium ${
          partner.type === 'both' ? 'bg-purple-100 text-purple-700' :
          partner.type === 'sales' ? 'bg-blue-100 text-blue-700' : 'bg-orange-100 text-orange-700'
        }`}>{PARTNER_TYPE_LABELS[partner.type]}</span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1 space-y-6">
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 space-y-4">
            <h3 className="font-semibold text-slate-900">기본 정보</h3>
            <div className="space-y-3 text-sm">
              <div className="flex items-start gap-3">
                <Building2 className="w-4 h-4 text-slate-400 mt-0.5 shrink-0" />
                <div>
                  <p className="text-slate-500 text-xs">사업자번호 / 구분</p>
                  <p className="text-slate-900">{partner.biz_no} · {BIZ_TYPE_LABELS[partner.biz_type]}</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <Building2 className="w-4 h-4 text-slate-400 mt-0.5 shrink-0" />
                <div>
                  <p className="text-slate-500 text-xs">대표자</p>
                  <p className="text-slate-900">{partner.rep}</p>
                </div>
              </div>
              {partner.tel && (
                <div className="flex items-start gap-3">
                  <Phone className="w-4 h-4 text-slate-400 mt-0.5 shrink-0" />
                  <div>
                    <p className="text-slate-500 text-xs">전화번호</p>
                    <p className="text-slate-900">{partner.tel}</p>
                  </div>
                </div>
              )}
              {partner.email && (
                <div className="flex items-start gap-3">
                  <Mail className="w-4 h-4 text-slate-400 mt-0.5 shrink-0" />
                  <div>
                    <p className="text-slate-500 text-xs">메일주소</p>
                    <p className="text-slate-900">{partner.email}</p>
                  </div>
                </div>
              )}
              {partner.addr && (
                <div className="flex items-start gap-3">
                  <MapPin className="w-4 h-4 text-slate-400 mt-0.5 shrink-0" />
                  <div>
                    <p className="text-slate-500 text-xs">주소</p>
                    <p className="text-slate-900">{partner.addr}</p>
                  </div>
                </div>
              )}
              {(partner.bank || partner.account) && (
                <div className="flex items-start gap-3">
                  <Banknote className="w-4 h-4 text-slate-400 mt-0.5 shrink-0" />
                  <div>
                    <p className="text-slate-500 text-xs">은행 / 계좌번호</p>
                    <p className="text-slate-900">{[partner.bank, partner.account].filter(Boolean).join(' ')}</p>
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
            <div className="flex items-center gap-2 mb-4">
              <TrendingUp className="w-4 h-4 text-indigo-600" />
              <h3 className="font-semibold text-slate-900">납품 종합</h3>
            </div>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div className="bg-slate-50 rounded-xl p-3 text-center">
                <p className="text-slate-500 text-xs mb-1">납품 건수</p>
                <p className="text-xl font-bold text-slate-900">{fmt(totalDeliveries)}</p>
              </div>
              <div className="bg-slate-50 rounded-xl p-3 text-center">
                <p className="text-slate-500 text-xs mb-1">공급가액</p>
                <p className="text-xl font-bold text-slate-900">{fmtW(totalSupply)}</p>
              </div>
              <div className="bg-slate-50 rounded-xl p-3 text-center">
                <p className="text-slate-500 text-xs mb-1">세액</p>
                <p className="text-xl font-bold text-slate-900">{fmtW(totalTax)}</p>
              </div>
              <div className="bg-indigo-50 rounded-xl p-3 text-center">
                <p className="text-indigo-500 text-xs mb-1">합계</p>
                <p className="text-xl font-bold text-indigo-700">{fmtW(totalAmount)}</p>
              </div>
            </div>
          </div>
        </div>

        <div className="lg:col-span-2 space-y-6">
          {summary.length > 0 && (
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
              <div className="px-6 py-4 border-b border-slate-100">
                <h3 className="font-semibold text-slate-900">월별 납품 실적</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-left whitespace-nowrap">
                  <thead className="bg-slate-50 text-slate-500 border-b border-slate-200">
                    <tr>
                      <th className="px-4 py-3">월</th>
                      <th className="px-4 py-3 text-center">건수</th>
                      <th className="px-4 py-3 text-right">공급가액</th>
                      <th className="px-4 py-3 text-right">세액</th>
                      <th className="px-4 py-3 text-right">합계</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {summary.map(r => (
                      <tr key={r.month} className="hover:bg-slate-50">
                        <td className="px-4 py-3 font-medium text-slate-900">{formatMonthYm(r.month)}</td>
                        <td className="px-4 py-3 text-center text-slate-600">{r.delivery_count}</td>
                        <td className="px-4 py-3 text-right text-slate-600">{fmtW(r.supply_amount)}</td>
                        <td className="px-4 py-3 text-right text-slate-600">{fmtW(r.tax_amount)}</td>
                        <td className="px-4 py-3 text-right font-medium text-slate-900">{fmtW(r.total_amount)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100">
              <h3 className="font-semibold text-slate-900">납품 완료 주문</h3>
            </div>
            {deliveredOrders.length === 0 ? (
              <div className="px-6 py-12 text-center text-slate-400 text-sm">납품 완료된 주문이 없습니다</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-left whitespace-nowrap">
                  <thead className="bg-slate-50 text-slate-500 border-b border-slate-200">
                    <tr>
                      <th className="px-4 py-3">문서번호</th>
                      <th className="px-4 py-3">주문일</th>
                      <th className="px-4 py-3">납품일</th>
                      <th className="px-4 py-3">상태</th>
                      <th className="px-4 py-3 text-right">합계금액</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {deliveredOrders.map(o => (
                      <tr key={o.id} className="hover:bg-slate-50 cursor-pointer" onClick={() => navigate(`/orders/${o.id}/preview`)}>
                        <td className="px-4 py-3 font-medium text-indigo-600 hover:underline">{o.doc_no}</td>
                        <td className="px-4 py-3 text-slate-600">{o.order_date}</td>
                        <td className="px-4 py-3 text-slate-600">{o.delivery_date}</td>
                        <td className="px-4 py-3"><StatusBadge status={o.delivery_status || o.status} /></td>
                        <td className="px-4 py-3 text-right font-medium text-slate-900">{fmtW(o.total_amount)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>
    </motion.div>
  );
}
