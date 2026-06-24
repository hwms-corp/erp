/** 부가세 면제 거래처 (거래처명에 포함 여부) */
export const INTERNET_PURCHASE_PARTNER_KEYWORD = '인터넷구매';

export function isInternetPurchasePartner(partnerName: string): boolean {
  return partnerName.includes(INTERNET_PURCHASE_PARTNER_KEYWORD);
}

export interface POAmountBreakdown {
  supply: number;
  tax: number;
  total: number;
}

export function calcPOAmounts(
  items: { name: string; qty: number; price: number }[],
  partnerName = '',
): POAmountBreakdown {
  const supply = items.reduce((s, it) => s + it.qty * it.price, 0);
  const tax = isInternetPurchasePartner(partnerName) ? 0 : Math.round(supply * 0.1);
  const total = supply + tax;
  return { supply, tax, total };
}
