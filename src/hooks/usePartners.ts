import { useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import type { Partner, PartnerType, BizType } from '@/types';

export interface PartnerFormData {
  code: string;
  name: string;
  type: PartnerType;
  biz_no: string;
  biz_type: BizType;
  rep: string;
  tel?: string;
  fax?: string;
  addr?: string;
  bank?: string;
  account?: string;
  email?: string;
}

export function usePartners() {
  const [partners, setPartners] = useState<Partner[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchPartners = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('partners')
      .select('*')
      .is('deleted_at', null)
      .order('code', { ascending: true });

    if (!error && data) setPartners(data);
    setLoading(false);
    return { data, error };
  }, []);

  const generateNextPartnerCode = useCallback(async (): Promise<string> => {
    // deleted_at 포함 전체 조회 — soft delete된 code도 UNIQUE에 잡히므로 채번에 반영해야 함
    const { data } = await supabase
      .from('partners')
      .select('code')
      .like('code', 'PTN-%');

    let max = 0;
    for (const row of data ?? []) {
      const m = row.code.match(/^PTN-(\d+)$/);
      if (m) max = Math.max(max, Number(m[1]));
    }
    return `PTN-${String(max + 1).padStart(3, '0')}`;
  }, []);

  const createPartner = useCallback(async (form: PartnerFormData) => {
    const { data, error } = await supabase
      .from('partners')
      .insert(form)
      .select()
      .single();

    if (!error && data) {
      setPartners(prev => [...prev, data]);
    }
    return { data, error };
  }, []);

  const updatePartner = useCallback(async (id: number, form: Partial<PartnerFormData>) => {
    const { data, error } = await supabase
      .from('partners')
      .update(form)
      .eq('id', id)
      .select()
      .single();

    if (!error && data) {
      setPartners(prev => prev.map(p => p.id === id ? data : p));
    }
    return { data, error };
  }, []);

  const deletePartner = useCallback(async (id: number) => {
    const { data, error } = await supabase
      .from('partners')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', id)
      .is('deleted_at', null)
      .select('id');

    if (error) return { error };

    // RLS로 인해 0건이 업데이트되어도 error가 null로 반환되므로
    // 실제 반영 여부를 별도로 확인한다.
    if (!data || data.length === 0) {
      return { error: { message: '삭제 권한이 없거나 이미 삭제된 거래처입니다.' } as { message: string } };
    }

    setPartners(prev => prev.filter(p => p.id !== id));
    return { error: null };
  }, []);

  return { partners, loading, fetchPartners, generateNextPartnerCode, createPartner, updatePartner, deletePartner };
}
