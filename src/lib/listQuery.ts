/** URLSearchParams 병합. 값이 null/undefined/빈 문자열이면 해당 키 제거. */
export function mergeQuery(
  prev: URLSearchParams,
  patch: Record<string, string | null | undefined>,
): URLSearchParams {
  const next = new URLSearchParams(prev);
  for (const [key, val] of Object.entries(patch)) {
    if (val === undefined || val === null || val === '') next.delete(key);
    else next.set(key, val);
  }
  return next;
}
