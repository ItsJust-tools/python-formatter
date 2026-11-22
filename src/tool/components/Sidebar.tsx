'use client';

import React from 'react';
import {
  BLANK_LINE_MODES,
  DEFAULT_STATE,
  INDENT_SIZES,
  QUOTE_STYLES,
  type BlankLineMode,
  type ToolState,
} from '../types';

interface SidebarProps {
  state: ToolState;
  onChange: (next: ToolState) => void;
}

const BLANK_LABELS: Record<BlankLineMode, string> = {
  normalize: 'Normalize (max 2)',
  collapse: 'Collapse (max 1)',
  preserve: 'Preserve all',
};

export const Sidebar: React.FC<SidebarProps> = ({ state, onChange }) => {
  return (
    <div
      className="p-4 space-y-6 text-sm overflow-y-auto h-full"
      data-testid="python-formatter-sidebar"
    >
      <div>
        <h3 className="mb-2 font-medium text-gray-900 dark:text-gray-100">Indentation</h3>
        <div className="flex gap-2" role="group" aria-label="Indentation unit">
          {INDENT_SIZES.map((size) => (
            <button
              key={`spaces-${size}`}
              type="button"
              data-testid={`indent-spaces-${size}`}
              aria-pressed={!state.useTabs && state.indentSize === size}
              onClick={() => onChange({ ...state, useTabs: false, indentSize: size })}
              className={`rounded-md border px-3 py-1.5 text-xs font-medium ${
                !state.useTabs && state.indentSize === size
                  ? 'border-blue-500 bg-blue-50 text-blue-800 dark:bg-blue-900/40 dark:text-blue-100'
                  : 'border-gray-200 bg-white text-gray-600 hover:bg-gray-50 dark:border-gray-800 dark:bg-gray-900 dark:text-gray-400'
              }`}
            >
              {size} spaces
            </button>
          ))}
          <button
            type="button"
            data-testid="indent-tabs"
            aria-pressed={state.useTabs}
            onClick={() => onChange({ ...state, useTabs: true })}
            className={`rounded-md border px-3 py-1.5 text-xs font-medium ${
              state.useTabs
                ? 'border-blue-500 bg-blue-50 text-blue-800 dark:bg-blue-900/40 dark:text-blue-100'
                : 'border-gray-200 bg-white text-gray-600 hover:bg-gray-50 dark:border-gray-800 dark:bg-gray-900 dark:text-gray-400'
            }`}
          >
            Tabs
          </button>
        </div>
      </div>

      <div>
        <h3 className="mb-2 font-medium text-gray-900 dark:text-gray-100">Quote style</h3>
        <div className="flex gap-2" role="group" aria-label="Quote style">
          {QUOTE_STYLES.map((style) => (
            <button
              key={style}
              type="button"
              data-testid={`quote-${style}`}
              aria-pressed={state.quoteStyle === style}
              onClick={() => onChange({ ...state, quoteStyle: style })}
              className={`rounded-md border px-3 py-1.5 text-xs font-medium ${
                state.quoteStyle === style
                  ? 'border-blue-500 bg-blue-50 text-blue-800 dark:bg-blue-900/40 dark:text-blue-100'
                  : 'border-gray-200 bg-white text-gray-600 hover:bg-gray-50 dark:border-gray-800 dark:bg-gray-900 dark:text-gray-400'
              }`}
            >
              {style === 'single' ? "Single ' … '" : 'Double " … "'}
            </button>
          ))}
        </div>
      </div>

      <div>
        <h3 className="mb-2 font-medium text-gray-900 dark:text-gray-100">Blank lines</h3>
        <div className="flex flex-wrap gap-2" role="group" aria-label="Blank line handling">
          {BLANK_LINE_MODES.map((mode) => (
            <button
              key={mode}
              type="button"
              data-testid={`blank-${mode}`}
              aria-pressed={state.blankLines === mode}
              onClick={() => onChange({ ...state, blankLines: mode })}
              className={`rounded-md border px-3 py-1.5 text-xs font-medium ${
                state.blankLines === mode
                  ? 'border-blue-500 bg-blue-50 text-blue-800 dark:bg-blue-900/40 dark:text-blue-100'
                  : 'border-gray-200 bg-white text-gray-600 hover:bg-gray-50 dark:border-gray-800 dark:bg-gray-900 dark:text-gray-400'
              }`}
            >
              {BLANK_LABELS[mode]}
            </button>
          ))}
        </div>
      </div>

      <div>
        <h3 className="mb-2 font-medium text-gray-900 dark:text-gray-100">Cleanup</h3>
        <label className="flex items-center gap-2 text-xs text-gray-600 dark:text-gray-300">
          <input
            type="checkbox"
            checked={state.trimTrailingWhitespace}
            data-testid="check-trim-trailing"
            onChange={(e) => onChange({ ...state, trimTrailingWhitespace: e.target.checked })}
          />
          Strip trailing whitespace
        </label>
        <label className="mt-2 flex items-center gap-2 text-xs text-gray-600 dark:text-gray-300">
          <input
            type="checkbox"
            checked={state.dedent}
            data-testid="check-dedent"
            onChange={(e) => onChange({ ...state, dedent: e.target.checked })}
          />
          Dedent pasted code first
        </label>
      </div>

      <div>
        <h3 className="mb-2 font-medium text-gray-900 dark:text-gray-100">Long-line hint</h3>
        <label className="block text-xs text-gray-600 dark:text-gray-300">
          Warn above
          <input
            type="number"
            min={0}
            max={500}
            value={state.maxLineLength}
            data-testid="input-max-line-length"
            onChange={(e) =>
              onChange({ ...state, maxLineLength: Number.parseInt(e.target.value, 10) || 0 })
            }
            className="mt-1 w-full rounded-md border border-gray-300 px-2 py-1 text-xs dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
          />
        </label>
        <p className="mt-1 text-[10px] text-gray-500 dark:text-gray-400">
          0 disables the hint. PEP 8 recommends 79.
        </p>
      </div>

      <div>
        <h3 className="mb-2 font-medium text-gray-900 dark:text-gray-100">Saved runs</h3>
        <p className="text-xs text-gray-600 dark:text-gray-300" data-testid="sidebar-history-count">
          {state.history.length} entr{state.history.length === 1 ? 'y' : 'ies'} in history
          {state.history.length > 0 ? ' (newest first)' : ''}
        </p>
      </div>

      <div>
        <h3 className="mb-2 font-medium text-gray-900 dark:text-gray-100">Privacy</h3>
        <p className="text-xs text-gray-600 dark:text-gray-300">
          Formatting runs entirely in your browser — code is never uploaded.
        </p>
        <button
          type="button"
          data-testid="btn-reset-settings"
          onClick={() =>
            onChange({
              ...state,
              indentSize: DEFAULT_STATE.indentSize,
              useTabs: DEFAULT_STATE.useTabs,
              quoteStyle: DEFAULT_STATE.quoteStyle,
              blankLines: DEFAULT_STATE.blankLines,
              trimTrailingWhitespace: DEFAULT_STATE.trimTrailingWhitespace,
              dedent: DEFAULT_STATE.dedent,
              maxLineLength: DEFAULT_STATE.maxLineLength,
            })
          }
          className="mt-2 rounded-md border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-100 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
        >
          Reset settings
        </button>
      </div>
    </div>
  );
};
