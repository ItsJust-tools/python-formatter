import { DEFAULT_STATE, type QuoteStyle, type ToolState } from './types';

export const SETTINGS_GROUPS = [
  { title: 'Indentation', hint: 'spaces per block level' },
  { title: 'Quotes', hint: 'preferred string delimiters' },
  { title: 'Blank lines', hint: 'normalize blank-line runs' },
] as const;

export function quoteLabel(style: QuoteStyle): string {
  return style === 'single' ? "Single quotes (' … ')" : 'Double quotes (" … ")';
}

export function isState(value: unknown): value is ToolState {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as Partial<ToolState>;
  return (
    typeof v.input === 'string' && typeof v.indentSize === 'number' && DEFAULT_STATE !== undefined
  );
}
