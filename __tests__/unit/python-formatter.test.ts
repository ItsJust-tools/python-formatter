import { describe, it, expect } from 'vitest';
import {
  formatPython,
  convertQuotes,
  clampIndentSize,
  clampMaxLineLength,
  DEFAULT_STATE,
  INDENT_SIZES,
  SAMPLE_INPUT,
  type ToolState,
} from '@/tool/types';
import {
  deserializeState,
  serializeState,
  withHistory,
  roundTrips,
  pythonFormatterTool,
} from '@/tool/tool-definition';

const opts = (patch: Partial<ToolState> = {}): ToolState => ({ ...DEFAULT_STATE, ...patch });

const state = (patch: Partial<ToolState> = {}): ToolState => ({ ...DEFAULT_STATE, ...patch });

describe('convertQuotes', () => {
  it('converts single to double quotes', () => {
    expect(convertQuotes("msg = 'hi'", 'double')).toBe('msg = "hi"');
  });

  it('converts double to single quotes', () => {
    expect(convertQuotes('msg = "hi"', 'single')).toBe("msg = 'hi'");
  });

  it('escapes inner quotes when converting', () => {
    expect(convertQuotes('s = "a\'b"', 'single')).toBe("s = 'a\\'b'");
    expect(convertQuotes("s = 'a\"b'", 'double')).toBe('s = "a\\"b"');
  });

  it('unescapes previously escaped target quotes', () => {
    expect(convertQuotes('s = "say \\"hi\\""', 'single')).toBe('s = \'say "hi"\'');
    expect(convertQuotes("s = 'say \\'hi\\''", 'double')).toBe('s = "say \'hi\'"');
  });

  it('leaves triple-quoted strings alone', () => {
    expect(convertQuotes('s = """keep"""', 'single')).toBe('s = """keep"""');
    expect(convertQuotes("s = '''keep'''", 'double')).toBe("s = '''keep'''");
  });

  it('keeps escaped backslashes intact', () => {
    expect(convertQuotes('s = "a\\\\\\"b"', 'double')).toBe('s = "a\\\\\\"b"');
  });

  it('passes through non-string content untouched', () => {
    expect(convertQuotes('# comment "here"\nx = 1', 'single')).toBe('# comment "here"\nx = 1');
  });
});

describe('formatPython indentation', () => {
  it('normalizes inconsistent indentation to a single level', () => {
    const res = formatPython('if x:\n   a()\n     b()', opts());
    expect(res.output.split('\n')).toEqual(['if x:', '    a()', '    b()']);
  });

  it('respects a custom indent size', () => {
    const res = formatPython('if x:\n  a()', { ...DEFAULT_STATE, indentSize: 2 });
    expect(res.output).toBe('if x:\n  a()');
  });

  it('supports 8-space indentation', () => {
    const res = formatPython('if x:\n  a()', { ...DEFAULT_STATE, indentSize: 8 });
    expect(res.output).toBe('if x:\n        a()');
  });

  it('uses tabs when enabled', () => {
    const res = formatPython('if x:\n  a()', { ...DEFAULT_STATE, useTabs: true });
    expect(res.output).toBe('if x:\n\ta()');
  });

  it('dedents common leading indentation when asked', () => {
    const res = formatPython('    if x:\n        a()', { ...DEFAULT_STATE, dedent: true });
    expect(res.output).toBe('if x:\n    a()');
  });

  it('increases level after block openers ending in colon', () => {
    const res = formatPython('def f():\nif x:\nreturn', { ...DEFAULT_STATE });
    expect(res.output).toBe('def f():\n    if x:\n        return');
  });

  it('dedents else / elif / except / finally lines', () => {
    const res = formatPython('if x:\nrun()\nelse:\nstop()\nfinally:\ncleanup()', {
      ...DEFAULT_STATE,
    });
    expect(res.output.split('\n')).toEqual([
      'if x:',
      '    run()',
      'else:',
      '    stop()',
      'finally:',
      '    cleanup()',
    ]);
  });

  it('does not increase level inside brackets', () => {
    const res = formatPython('x = foo(\n    1,\n    2,\n)', { ...DEFAULT_STATE });
    expect(res.output).toBe('x = foo(\n    1,\n    2,\n)');
  });

  it('ignores colons and # inside string literals for block detection', () => {
    const res = formatPython('s = "a: not a block"\nnext()', { ...DEFAULT_STATE });
    expect(res.output).toBe('s = "a: not a block"\nnext()');
  });
});

describe('formatPython blank lines', () => {
  it('collapses blank line runs to one in collapse mode', () => {
    const res = formatPython('a()\n\n\n\nb()', { ...DEFAULT_STATE, blankLines: 'collapse' });
    expect(res.output).toBe('a()\n\nb()');
  });

  it('allows at most two blank lines in normalize mode', () => {
    const res = formatPython('a()\n\n\n\n\nb()', { ...DEFAULT_STATE, blankLines: 'normalize' });
    expect(res.output).toBe('a()\n\n\nb()');
  });

  it('keeps existing blank runs in preserve mode but still reindents', () => {
    const res = formatPython('if x:\n      a()\n\n\n\nb()', {
      ...DEFAULT_STATE,
      blankLines: 'preserve',
    });
    expect(res.output).toBe('if x:\n    a()\n\n\n\nb()');
  });

  it('strips leading and trailing blank lines', () => {
    const res = formatPython('\n\n\na()\n\n\n', { ...DEFAULT_STATE });
    expect(res.output).toBe('a()');
  });

  it('reports the number of removed blank lines', () => {
    const res = formatPython('\n\na()\n\n\n\nb()\n\n', { ...DEFAULT_STATE });
    expect(res.stats.blankLinesRemoved).toBeGreaterThan(0);
  });
});

describe('formatPython trailing whitespace and stats', () => {
  it('strips trailing whitespace per line', () => {
    const res = formatPython('a()   \nb()\t', { ...DEFAULT_STATE });
    expect(res.output).toBe('a()\nb()');
  });

  it('keeps trailing whitespace when the option is off', () => {
    const res = formatPython('a()   \nb()\t', { ...DEFAULT_STATE, trimTrailingWhitespace: false });
    expect(res.output).toBe('a()   \nb()\t');
  });

  it('normalizes CRLF line endings', () => {
    const res = formatPython('a()\r\nb()\r\n', { ...DEFAULT_STATE });
    expect(res.output).toBe('a()\nb()');
  });

  it('counts non-blank output lines', () => {
    const res = formatPython('a()\n\nb()', { ...DEFAULT_STATE });
    expect(res.stats.lineCount).toBe(2);
  });

  it('tracks the longest output line', () => {
    const res = formatPython('x = "aaaaaaaaaaaaaaaaaaaaaa"', { ...DEFAULT_STATE });
    expect(res.stats.maxOutputLineLength).toBe(28);
  });

  it('handles empty input', () => {
    const res = formatPython('', { ...DEFAULT_STATE });
    expect(res.output).toBe('');
    expect(res.stats.lineCount).toBe(0);
  });

  it('handles whitespace-only input', () => {
    const res = formatPython('   \n\t\n', { ...DEFAULT_STATE });
    expect(res.output).toBe('');
  });
});

describe('formatPython long-line hints', () => {
  it('reports lines longer than the threshold', () => {
    const res = formatPython(
      'x = "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"',
      {
        ...DEFAULT_STATE,
        maxLineLength: 20,
      }
    );
    expect(res.stats.longLineNumbers).toEqual([1]);
  });

  it('disables hints when threshold is 0', () => {
    const res = formatPython('x = "' + 'a'.repeat(200) + '"', {
      ...DEFAULT_STATE,
      maxLineLength: 0,
    });
    expect(res.stats.longLineNumbers).toEqual([]);
  });

  it('respects the long-line threshold when disabled (0)', () => {
    const res = formatPython('short', { ...DEFAULT_STATE, maxLineLength: 0 });
    expect(res.stats.longLineNumbers).toEqual([]);
  });

  it('never flags lines under the threshold', () => {
    const res = formatPython('x = 1', { ...DEFAULT_STATE, maxLineLength: 79 });
    expect(res.stats.longLineNumbers).toEqual([]);
  });
});

describe('clampers', () => {
  it('clamps indent sizes to allowed values', () => {
    for (const size of INDENT_SIZES) {
      expect(clampIndentSize(size)).toBe(size);
    }
    expect(clampIndentSize(3)).toBe(DEFAULT_STATE.indentSize);
    expect(clampIndentSize('x')).toBe(DEFAULT_STATE.indentSize);
    expect(clampIndentSize(NaN)).toBe(DEFAULT_STATE.indentSize);
  });

  it('clamps the long-line threshold', () => {
    expect(clampMaxLineLength(0)).toBe(0);
    expect(clampMaxLineLength(500)).toBe(500);
    expect(clampMaxLineLength(600)).toBe(DEFAULT_STATE.maxLineLength);
    expect(clampMaxLineLength(-5)).toBe(DEFAULT_STATE.maxLineLength);
    expect(clampMaxLineLength('abc')).toBe(DEFAULT_STATE.maxLineLength);
    expect(clampMaxLineLength(80.4)).toBe(80);
  });
});

describe('state serialization', () => {
  it('round-trips the default state', () => {
    expect(roundTrips(DEFAULT_STATE)).toBe(true);
  });

  it('round-trips custom states', () => {
    expect(
      roundTrips(
        state({ indentSize: 2, useTabs: true, quoteStyle: 'single', blankLines: 'collapse' })
      )
    ).toBe(true);
  });

  it('keeps input and history on round-trip', () => {
    const s = state({
      input: 'x = 1',
      history: [{ text: 'Formatted 1 line', createdAt: '2026-11-22T10:00:00.000Z' }],
    });
    const restored = deserializeState(JSON.parse(serializeState(s)));
    expect(restored.success).toBe(true);
    if (restored.success) {
      expect(restored.data.input).toBe('x = 1');
      expect(restored.data.history).toHaveLength(1);
    }
  });

  it('rejects non-object payloads', () => {
    expect(deserializeState('nope').success).toBe(false);
    expect(deserializeState(null).success).toBe(false);
    expect(deserializeState([1, 2]).success).toBe(false);
  });

  it('repairs invalid enum values with defaults', () => {
    const res = deserializeState({
      quoteStyle: 5,
      blankLines: 'nope',
      indentSize: 7,
      maxLineLength: 'x',
      useTabs: 'yes',
    });
    expect(res.success).toBe(true);
    if (res.success) {
      expect(res.data.quoteStyle).toBe(DEFAULT_STATE.quoteStyle);
      expect(res.data.blankLines).toBe(DEFAULT_STATE.blankLines);
      expect(res.data.indentSize).toBe(DEFAULT_STATE.indentSize);
      expect(res.data.maxLineLength).toBe(DEFAULT_STATE.maxLineLength);
      expect(res.data.useTabs).toBe(DEFAULT_STATE.useTabs);
    }
  });

  it('repairs scalar types with defaults', () => {
    const res = deserializeState({
      input: 42,
      trimTrailingWhitespace: 'yes',
      dedent: 1,
      history: 'x',
    });
    expect(res.success).toBe(true);
    if (res.success) {
      expect(res.data.input).toBe(DEFAULT_STATE.input);
      expect(res.data.trimTrailingWhitespace).toBe(DEFAULT_STATE.trimTrailingWhitespace);
      expect(res.data.dedent).toBe(DEFAULT_STATE.dedent);
      expect(res.data.history).toEqual([]);
    }
  });

  it('drops malformed history entries', () => {
    const res = deserializeState({
      history: [{ text: 'ok', createdAt: '2026-11-22T10:00:00.000Z' }, null, { text: 5 }, 3],
    });
    expect(res.success).toBe(true);
    if (res.success) {
      expect(res.data.history).toHaveLength(1);
    }
  });

  it('caps history at MAX_HISTORY', () => {
    const many = Array.from({ length: 30 }, (_, i) => ({
      text: String(i),
      createdAt: '2026-11-22T10:00:00.000Z',
    }));
    const res = deserializeState({ history: many });
    expect(res.success).toBe(true);
    if (res.success) expect(res.data.history).toHaveLength(20);
  });
});

describe('withHistory', () => {
  it('prepends the newest entry', () => {
    const next = withHistory(DEFAULT_STATE, 'Formatted 3 lines', new Date('2026-11-22T10:00:00Z'));
    expect(next.history[0]?.text).toBe('Formatted 3 lines');
    expect(next.history[0]?.createdAt).toBe('2026-11-22T10:00:00.000Z');
  });

  it('caps the history length', () => {
    let s = DEFAULT_STATE;
    for (let i = 0; i < 25; i++) {
      s = withHistory(s, `run ${i}`, new Date('2026-11-22T10:00:00Z'));
    }
    expect(s.history).toHaveLength(20);
    expect(s.history[0]?.text).toBe('run 24');
  });
});

describe('tool contract', () => {
  it('exposes the registered id and name', () => {
    expect(pythonFormatterTool.id).toBe('python-formatter');
    expect(pythonFormatterTool.name).toBe('Python Formatter');
  });

  it('returns distinct copies of the initial state', () => {
    const a = pythonFormatterTool.initialState;
    expect(a).toEqual(DEFAULT_STATE);
    expect(a).not.toBe(DEFAULT_STATE);
  });

  it('declares image and pdf exporters with working loaders', async () => {
    const exporters = pythonFormatterTool.exporters ?? [];
    expect(exporters.map((e) => e.format)).toEqual(['png', 'jpeg', 'webp', 'pdf']);
    for (const exporter of exporters) {
      const mod = await exporter.loader();
      const resolved =
        'default' in mod ? mod.default : (mod as { exporter?: { format: string } }).exporter;
      expect(resolved?.format ?? 'missing').toBeTruthy();
    }
  });

  it('formats the sample input without long lines over 500 chars', () => {
    const res = formatPython(SAMPLE_INPUT, DEFAULT_STATE);
    expect(res.output.length).toBeGreaterThan(0);
    expect(res.stats.longLineNumbers).toEqual([]);
  });
});
