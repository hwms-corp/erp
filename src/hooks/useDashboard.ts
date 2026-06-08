import { useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import type { Partner } from '@/types';

export interface DeliveredOrderRow {
  partner_id: number;
  delivery_date: string;
  total_amount: number;
}

export interface MonthlySalesPoint {
  month: string;
  label: string;
  total_amount: number;
}

export function buildYearMonths(year: number): string[] {
  return Array.from({ length: 12 }, (_, i) =>
    `${year}-${String(i + 1).padStart(2, '0')}`,
  );
}

export function aggregateMonthlySales(
  rows: DeliveredOrderRow[],
  year: number,
  partnerId?: number,
): MonthlySalesPoint[] {
  const months = buildYearMonths(year);
  const map = new Map(months.map(m => [m, 0]));

  for (const row of rows) {
    if (!row.delivery_date) continue;
    const ym = row.delivery_date.trim().slice(0, 7);
    if (!map.has(ym)) continue;
    if (partnerId !== undefined && row.partner_id !== partnerId) continue;
    map.set(ym, map.get(ym)! + Number(row.total_amount));
  }

  return months.map((m, i) => ({
    month: m,
    label: `${i + 1}월`,
    total_amount: map.get(m)!,
  }));
}

export interface PartnerMonthlyRow {
  partner_id: number;
  partner_code: string;
  partner_name: string;
  amounts: number[];
  total: number;
}

export function aggregatePartnerMatrix(
  rows: DeliveredOrderRow[],
  year: number,
  partners: Partner[],
): PartnerMonthlyRow[] {
  const months = buildYearMonths(year);
  const amountMap = new Map<number, number[]>();

  for (const row of rows) {
    if (!row.delivery_date) continue;
    const ym = row.delivery_date.trim().slice(0, 7);
    const idx = months.indexOf(ym);
    if (idx < 0) continue;
    if (!amountMap.has(row.partner_id)) {
      amountMap.set(row.partner_id, new Array(12).fill(0));
    }
    const arr = amountMap.get(row.partner_id)!;
    arr[idx] += Number(row.total_amount);
  }

  return partners.map(p => {
    const amounts = [...(amountMap.get(p.id) ?? new Array(12).fill(0))];
    return {
      partner_id: p.id,
      partner_code: p.code,
      partner_name: p.name,
      amounts,
      total: amounts.reduce((s, v) => s + v, 0),
    };
  });
}

export const MONTH_LABELS = Array.from({ length: 12 }, (_, i) => `${i + 1}월`);

export function useDashboard() {
  const fetchYearlySales = useCallback(async (year: number) => {
    const { data, error } = await supabase
      .from('v_orders_with_partner')
      .select('partner_id, delivery_date, total_amount')
      .eq('delivery_status', 'completed')
      .not('delivery_date', 'is', null)
      .gte('delivery_date', `${year}-01-01`)
      .lte('delivery_date', `${year}-12-31`);

    return { data: data as DeliveredOrderRow[] | null, error };
  }, []);

  return { fetchYearlySales, aggregateMonthlySales };
}
