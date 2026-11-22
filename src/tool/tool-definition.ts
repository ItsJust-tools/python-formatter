import type { Tool, DeserializeResult } from '@itsjust/core';
import toolConfig from './tool.config';
import {
  DEFAULT_STATE,
  MAX_HISTORY,
  BLANK_LINE_MODES,
  QUOTE_STYLES,
  formatPython,
  type BlankLineMode,
  type HistoryEntry,
  type QuoteStyle,
  type ToolState,
} from './types';

/** Serialize tool state into a compact JSON string for share/import. */
export function serializeState(state: ToolState): string {
  return JSON.stringify({
    input: state.input,
    indentSize: state.indentSize,
    useTabs: state.useTabs,
    quoteStyle: state.quoteStyle,
    blankLines: state.blankLines,
    trimTrailingWhitespace: state.trimTrailingWhitespace,
    dedent: state.dedent,
    maxLineLength: state.maxLineLength,
    history: state.history,
  });
}

function stringOr(value: unknown, fallback: string): string {
  return typeof value === 'string' ? value : fallback;
}

function booleanOr(value: unknown, fallback: boolean): boolean {
  return typeof value === 'boolean' ? value : fallback;
}

function validHistory(value: unknown): HistoryEntry[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter(
      (entry): entry is HistoryEntry =>
        typeof entry === 'object' &&
        entry !== null &&
        typeof (entry as HistoryEntry).text === 'string' &&
        typeof (entry as HistoryEntry).createdAt === 'string'
    )
    .slice(0, MAX_HISTORY);
}

/** Validate and recover tool state from an arbitrary payload. */
export function deserializeState(data: unknown): DeserializeResult<ToolState> {
  if (typeof data !== 'object' || data === null || Array.isArray(data)) {
    return {
      success: false,
      error: 'Invalid data format: expected python-formatter state object',
    };
  }
  const v = data as Record<string, unknown>;
  const quoteStyle: QuoteStyle = QUOTE_STYLES.includes(v.quoteStyle as QuoteStyle)
    ? (v.quoteStyle as QuoteStyle)
    : DEFAULT_STATE.quoteStyle;
  const blankLines: BlankLineMode = BLANK_LINE_MODES.includes(v.blankLines as BlankLineMode)
    ? (v.blankLines as BlankLineMode)
    : DEFAULT_STATE.blankLines;
  const state: ToolState = {
    input: stringOr(v.input, DEFAULT_STATE.input),
    indentSize:
      v.indentSize === 2 || v.indentSize === 4 || v.indentSize === 8
        ? v.indentSize
        : DEFAULT_STATE.indentSize,
    useTabs: booleanOr(v.useTabs, DEFAULT_STATE.useTabs),
    quoteStyle,
    blankLines,
    trimTrailingWhitespace: booleanOr(
      v.trimTrailingWhitespace,
      DEFAULT_STATE.trimTrailingWhitespace
    ),
    dedent: booleanOr(v.dedent, DEFAULT_STATE.dedent),
    maxLineLength:
      typeof v.maxLineLength === 'number' && Number.isFinite(v.maxLineLength)
        ? Math.min(500, Math.max(0, Math.round(v.maxLineLength)))
        : DEFAULT_STATE.maxLineLength,
    history: validHistory(v.history),
  };
  return { success: true, data: state };
}

/** Append a history entry to state, capped at MAX_HISTORY, newest first. */
export function withHistory(state: ToolState, text: string, now = new Date()): ToolState {
  const entry: HistoryEntry = { text, createdAt: now.toISOString() };
  return { ...state, history: [entry, ...state.history].slice(0, MAX_HISTORY) };
}

/** True when a serialized string round-trips back to the same state. */
export function roundTrips(state: ToolState): boolean {
  try {
    const restored = deserializeState(JSON.parse(serializeState(state)));
    return restored.success && JSON.stringify(restored.data) === JSON.stringify(state);
  } catch {
    return false;
  }
}

export const pythonFormatterTool: Tool<ToolState> = {
  id: toolConfig.id,
  name: toolConfig.name,
  version: toolConfig.version,
  config: toolConfig,
  initialState: { ...DEFAULT_STATE },
  serialize: serializeState,
  deserialize: deserializeState,
  exporters: [
    { format: 'png', loader: () => import('./exporters/png') },
    { format: 'jpeg', loader: () => import('./exporters/jpeg') },
    { format: 'webp', loader: () => import('./exporters/webp') },
    { format: 'pdf', loader: () => import('./exporters/pdf') },
  ],
};

export { formatPython };
