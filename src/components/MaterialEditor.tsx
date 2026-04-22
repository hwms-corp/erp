import { useState } from 'react';
import { Plus, X } from 'lucide-react';
import type { MaterialLine } from '@/types';
import { emptyMaterialLine, fmt } from '@/types';

const inp = 'w-full px-3 py-2 border border-slate-300 rounded-lg text-sm outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500';

interface Props {
  lines: MaterialLine[];
  onChange: (lines: MaterialLine[]) => void;
}

function PriceInput({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  const [editing, setEditing] = useState(false);
  const [raw, setRaw] = useState('');

  if (editing) {
    return (
      <input
        type="text"
        inputMode="numeric"
        className={`${inp} !py-1.5 !text-xs text-right`}
        value={raw}
        autoFocus
        onChange={e => {
          const v = e.target.value.replace(/[^-\d]/g, '');
          setRaw(v);
          const n = parseInt(v);
          if (!isNaN(n)) onChange(n);
        }}
        onBlur={() => {
          setEditing(false);
          if (raw === '' || raw === '-') onChange(0);
        }}
        placeholder="0"
      />
    );
  }

  return (
    <input
      type="text"
      className={`${inp} !py-1.5 !text-xs text-right`}
      value={value !== 0 ? fmt(value) : ''}
      readOnly
      onFocus={() => { setRaw(value !== 0 ? String(value) : ''); setEditing(true); }}
      placeholder="0"
    />
  );
}

export function MaterialEditor({ lines, onChange }: Props) {
  const update = (idx: number, field: keyof MaterialLine, value: string | number) => {
    const next = [...lines];
    next[idx] = { ...next[idx], [field]: value };
    onChange(next);
  };

  const total = lines.reduce((s, l) => s + l.qty * l.price, 0);

  return (
    <div className="space-y-2">
      <div className="overflow-x-auto">
        <table className="w-full text-sm min-w-[700px] whitespace-nowrap">
          <thead>
            <tr className="border-b border-slate-200 text-xs text-slate-500">
              <th className="py-2 px-1 w-8 text-center">#</th>
              <th className="py-2 px-1 text-left">품명 *</th>
              <th className="py-2 px-1 text-left">사양</th>
              <th className="py-2 px-1 w-20 text-right">수량</th>
              <th className="py-2 px-1 w-16 text-center">단위</th>
              <th className="py-2 px-1 w-28 text-right">단가</th>
              <th className="py-2 px-1 w-28 text-right">금액</th>
              <th className="py-2 px-1 text-left">비고</th>
              <th className="py-2 px-1 w-8"></th>
            </tr>
          </thead>
          <tbody>
            {lines.map((l, i) => (
              <tr key={i} className="border-b border-slate-100">
                <td className="py-2 px-1 text-center text-xs text-slate-400">{i + 1}</td>
                <td className="py-2 px-1">
                  <input required className={`${inp} !py-1.5 !text-xs`} value={l.name} onChange={e => update(i, 'name', e.target.value)} placeholder="품명" />
                </td>
                <td className="py-2 px-1">
                  <input className={`${inp} !py-1.5 !text-xs`} value={l.spec} onChange={e => update(i, 'spec', e.target.value)} placeholder="사양" />
                </td>
                <td className="py-2 px-1">
                  <input type="number" className={`${inp} !py-1.5 !text-xs text-right`} value={l.qty} onChange={e => update(i, 'qty', parseInt(e.target.value) || 0)} />
                </td>
                <td className="py-2 px-1">
                  <input className={`${inp} !py-1.5 !text-xs text-center`} value={l.unit} onChange={e => update(i, 'unit', e.target.value)} />
                </td>
                <td className="py-2 px-1">
                  <PriceInput value={l.price} onChange={v => update(i, 'price', v)} />
                </td>
                <td className="py-2 px-1 text-right text-xs font-medium text-slate-900">
                  {fmt(l.qty * l.price)}
                </td>
                <td className="py-2 px-1">
                  <input className={`${inp} !py-1.5 !text-xs`} value={l.remark} onChange={e => update(i, 'remark', e.target.value)} placeholder="비고" />
                </td>
                <td className="py-2 px-1">
                  {lines.length > 1 && (
                    <button type="button" onClick={() => onChange(lines.filter((_, j) => j !== i))} className="p-0.5 text-slate-300 hover:text-red-500">
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={() => onChange([...lines, emptyMaterialLine()])}
          className="flex items-center gap-2 text-sm text-indigo-600 hover:text-indigo-800 font-medium"
        >
          <Plus className="w-4 h-4" /> 행 추가
        </button>
        <div className="text-sm text-slate-600">
          합계: <span className="font-bold text-slate-900">{fmt(total)}원</span>
        </div>
      </div>
    </div>
  );
}
