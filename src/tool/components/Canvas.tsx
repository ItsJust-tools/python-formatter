'use client';

import React from 'react';
import { useMemo } from 'react';
import { formatPython } from '../types';
import type { ToolState } from '../types';

interface CanvasProps {
  state: ToolState;
  onChange?: (state: ToolState) => void;
  onSaveHistory?: (text: string) => void;
}

function CopyButton({ value, testid }: { value: string; testid?: string }) {
  const [copied, setCopied] = React.useState(false);
  const handleCopy = React.useCallback(async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      // clipboard unavailable; ignore
    }
  }, [value]);
  return (
    <button
      type="button"
      onClick={handleCopy}
      data-testid={testid}
      className="text-xs px-2 py-1 rounded border border-gray-300 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-800"
      aria-label="Copy value"
    >
      {copied ? 'Copied!' : 'Copy'}
    </button>
  );
}

export const Canvas: React.FC<CanvasProps> = ({ state, onChange, onSaveHistory }) => {
  const result = useMemo(() => formatPython(state.input, state), [state]);
  const { output, stats } = result;

  const handleDownload = React.useCallback(() => {
    const blob = new Blob([output], { type: 'text/x-python;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'formatted.py';
    a.click();
    URL.revokeObjectURL(url);
  }, [output]);

  const handleUseAsInput = React.useCallback(() => {
    onChange?.({ ...state, input: output });
  }, [onChange, output, state]);

  return (
    <div className="p-4 space-y-6 overflow-y-auto h-full" data-testid="python-formatter-canvas">
      <div className="grid gap-4 lg:grid-cols-2">
        <div>
          <div className="mb-1 flex items-center justify-between">
            <span className="text-[10px] uppercase tracking-widest text-gray-500 dark:text-gray-400">
              Input
            </span>
            <span className="text-[10px] text-gray-400">
              {state.input.split('\n').length} lines
            </span>
          </div>
          <textarea
            value={state.input}
            onChange={(e) => onChange?.({ ...state, input: e.target.value })}
            spellCheck={false}
            data-testid="input-code"
            aria-label="Python source code to format"
            rows={16}
            className="w-full rounded-md border border-gray-300 bg-white p-3 font-mono text-xs text-gray-900 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
            placeholder="Paste your Python code here…"
          />
        </div>
        <div>
          <div className="mb-1 flex items-center justify-between">
            <span className="text-[10px] uppercase tracking-widest text-gray-500 dark:text-gray-400">
              Formatted output
            </span>
            <span className="flex items-center gap-1">
              <CopyButton value={output} testid="copy-output" />
              <button
                type="button"
                data-testid="btn-download"
                onClick={handleDownload}
                className="text-xs px-2 py-1 rounded border border-gray-300 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-800"
                aria-label="Download formatted Python file"
              >
                Download .py
              </button>
            </span>
          </div>
          <pre
            data-testid="output-code"
            aria-label="Formatted Python code"
            className="max-h-96 w-full overflow-auto rounded-md border border-gray-200 bg-gray-50 p-3 font-mono text-xs text-gray-900 dark:border-gray-800 dark:bg-gray-900 dark:text-gray-100"
          >
            {output || '—'}
          </pre>
        </div>
      </div>

      <div
        className="rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900"
        data-testid="stats-card"
        role="status"
      >
        <span className="mb-2 block text-[10px] uppercase tracking-widest text-gray-500 dark:text-gray-400">
          Formatting stats
        </span>
        <div className="flex flex-wrap gap-4 text-xs" data-testid="stats-list">
          <span data-testid="stat-lines">{stats.lineCount} non-blank lines</span>
          <span data-testid="stat-blanks">
            {stats.blankLinesRemoved} blank line{stats.blankLinesRemoved === 1 ? '' : 's'} removed
          </span>
          <span data-testid="stat-max-line">longest line: {stats.maxOutputLineLength} chars</span>
          <span data-testid="stat-long-lines">
            {stats.longLineNumbers.length === 0
              ? 'no long lines'
              : `long lines: ${stats.longLineNumbers.join(', ')}`}
          </span>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            data-testid="btn-save-history"
            onClick={() => onSaveHistory?.(`Formatted ${stats.lineCount} lines`)}
            className="rounded-md border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-100 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
          >
            Save to history
          </button>
          <button
            type="button"
            data-testid="btn-use-as-input"
            onClick={handleUseAsInput}
            className="rounded-md border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-100 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
          >
            Use output as input
          </button>
        </div>
      </div>

      <div>
        <h3 className="mb-2 text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">
          History
        </h3>
        {state.history.length === 0 ? (
          <p className="text-xs text-gray-500 dark:text-gray-400" data-testid="history-empty">
            No saved formatting runs yet.
          </p>
        ) : (
          <ul className="space-y-1" data-testid="history-list">
            {state.history.map((entry, i) => (
              <li
                key={`${entry.createdAt}-${i}`}
                className="flex items-center justify-between gap-2 rounded-md border border-gray-200 px-3 py-1.5 text-xs dark:border-gray-800"
              >
                <span className="text-gray-700 dark:text-gray-300">{entry.text}</span>
                <CopyButton value={entry.text} />
              </li>
            ))}
          </ul>
        )}
      </div>

      <p className="text-center text-xs text-gray-500 dark:text-gray-400">
        All formatting runs locally in your browser; nothing is uploaded.
      </p>
    </div>
  );
};
