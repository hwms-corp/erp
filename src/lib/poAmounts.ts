/** 부가세 면제 품목 (품명 기준) */
export const CUSTOMS_DUTY_ITEM_NAME = '관세';

export function isCustomsDutyItem(name: string): boolean {
  return name.trim() === CUSTOMS_DUTY_ITEM_NAME;
}

export interface POAmountBreakdown {
  /** 전 품목 공급가액 합계 */
  supply: number;
  /** 관세 제외 품목에 대한 부가세(10%) */
  tax: number;
  /** 공급가액 + 부가세 (관세는 부가세 없이 합계에 포함) */
  total: number;
  taxableSupply: number;
  nonTaxableSupply: number;
}

export function calcPOAmounts(
  items: { name: string; qty: number; price: number }[],
): POAmountBreakdown {
  let taxableSupply = 0;
  let nonTaxableSupply = 0;

  for (const it of items) {
    const amount = it.qty * it.price;
    if (isCustomsDutyItem(it.name)) {
      nonTaxableSupply += amount;
    } else {
      taxableSupply += amount;
    }
  }

  const supply = taxableSupply + nonTaxableSupply;
  const tax = Math.round(taxableSupply * 0.1);
  const total = supply + tax;

  return { supply, tax, total, taxableSupply, nonTaxableSupply };
}
