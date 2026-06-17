/** 검색 컬럼·필드에 맞는 하이라이트용 검색어 목록 반환 */
export function getHighlightQueries(
  search: string,
  searchCol: string,
  fieldKey: string,
  search2 = '',
): string[] {
  const q1 = search.trim();
  const q2 = search2.trim();
  if (!q1) return [];

  if (searchCol === 'spec' && fieldKey === 'spec') {
    return q2 ? [q1, q2] : [q1];
  }
  if (searchCol === 'all' || searchCol === fieldKey) {
    return [q1];
  }
  return [];
}
