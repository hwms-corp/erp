import type { ReactNode } from 'react';

interface HighlightTextProps {
  text: string | null | undefined;
  queries?: string[];
  className?: string;
}

const MARK_CLASS = 'bg-yellow-200 text-inherit rounded-sm px-0.5 box-decoration-clone';

export function HighlightText({ text, queries = [], className }: HighlightTextProps) {
  const str = text ?? '';
  const terms = queries.map(q => q.trim()).filter(Boolean);

  if (!terms.length) {
    return className ? <span className={className}>{str}</span> : <>{str}</>;
  }

  const lower = str.toLowerCase();
  const lowerTerms = terms.map(t => t.toLowerCase());
  const parts: ReactNode[] = [];
  let i = 0;
  let key = 0;

  while (i < str.length) {
    let earliest = -1;
    let matchLen = 0;

    for (const term of lowerTerms) {
      const idx = lower.indexOf(term, i);
      if (idx === -1) continue;
      if (earliest === -1 || idx < earliest || (idx === earliest && term.length > matchLen)) {
        earliest = idx;
        matchLen = term.length;
      }
    }

    if (earliest === -1) {
      parts.push(str.slice(i));
      break;
    }

    if (earliest > i) parts.push(str.slice(i, earliest));
    parts.push(
      <mark key={key++} className={MARK_CLASS}>
        {str.slice(earliest, earliest + matchLen)}
      </mark>,
    );
    i = earliest + matchLen;
  }

  return className ? <span className={className}>{parts}</span> : <>{parts}</>;
}
