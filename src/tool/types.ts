export type QuoteStyle = 'single' | 'double';
export type BlankLineMode = 'normalize' | 'collapse' | 'preserve';

export interface HistoryEntry {
  /** Short human readable description of the formatting run. */
  text: string;
  /** ISO timestamp when the entry was saved. */
  createdAt: string;
}

export interface ToolState {
  /** Python source code to format. */
  input: string;
  /** Spaces per indentation level (ignored when useTabs is true). */
  indentSize: number;
  /** Indent with tabs instead of spaces. */
  useTabs: boolean;
  /** Preferred quote character for single-line string literals. */
  quoteStyle: QuoteStyle;
  /** How to normalize runs of blank lines. */
  blankLines: BlankLineMode;
  /** Strip trailing whitespace from every line. */
  trimTrailingWhitespace: boolean;
  /** Remove common leading indentation before re-indenting. */
  dedent: boolean;
  /** Long-line hint threshold; 0 disables the hint. */
  maxLineLength: number;
  /** Saved formatting runs, newest first. */
  history: HistoryEntry[];
}

export const SAMPLE_INPUT = `def greet(name, punctuation="!"):
    msg = 'Hello, ' + name + punctuation
    if len(msg) > 10:
       print(msg)
    else:
      print('short')
    return msg





class Greeter:
        def __init__(self):
            self.count = 0`;

export const DEFAULT_STATE: ToolState = {
  input: SAMPLE_INPUT,
  indentSize: 4,
  useTabs: false,
  quoteStyle: 'double',
  blankLines: 'normalize',
  trimTrailingWhitespace: true,
  dedent: false,
  maxLineLength: 79,
  history: [],
};

export const MAX_HISTORY = 20;
export const INDENT_SIZES = [2, 4, 8] as const;
export const QUOTE_STYLES: QuoteStyle[] = ['single', 'double'];
export const BLANK_LINE_MODES: BlankLineMode[] = ['normalize', 'collapse', 'preserve'];

const DEDENT_KEYWORDS = /^(else\b|elif\b|except\b|finally\b|case\b)/;

interface FormatOptions {
  indentSize: number;
  useTabs: boolean;
  quoteStyle: QuoteStyle;
  blankLines: BlankLineMode;
  trimTrailingWhitespace: boolean;
  dedent: boolean;
  maxLineLength: number;
}

export interface FormatStats {
  /** Number of non-blank output lines. */
  lineCount: number;
  /** 1-based numbers of output lines longer than maxLineLength (when enabled). */
  longLineNumbers: number[];
  /** How many blank lines were removed by normalization. */
  blankLinesRemoved: number;
  /** Max output line length. */
  maxOutputLineLength: number;
}

export interface FormatResult {
  output: string;
  stats: FormatStats;
}

/** Matches single-line and triple-quoted string literals. */
const STRING_RE = /('''[\s\S]*?'''|"""[\s\S]*?"""|'(?:\\.|[^'\\\n])*'|"(?:\\.|[^"\\\n])*")/g;

function clampIndentSize(value: unknown): number {
  const n = typeof value === 'number' ? value : Number.parseInt(String(value), 10);
  if (!Number.isFinite(n)) return DEFAULT_STATE.indentSize;
  const allowed = INDENT_SIZES as readonly number[];
  return allowed.includes(n) ? n : DEFAULT_STATE.indentSize;
}

function clampMaxLineLength(value: unknown): number {
  const n = typeof value === 'number' ? value : Number.parseInt(String(value), 10);
  if (!Number.isFinite(n) || n < 0 || n > 500) return DEFAULT_STATE.maxLineLength;
  return Math.round(n);
}

/** Rewrite the delimiters of single-line string literals to the preferred style. */
export function convertQuotes(code: string, style: QuoteStyle): string {
  return code
    .split('\n')
    .map((line) => convertQuotesInLine(line, style))
    .join('\n');
}

/** Split a line into code part and comment part (first # outside a string). */
function splitComment(line: string): { code: string; comment: string } {
  let i = 0;
  let quote: string | null = null;
  while (i < line.length) {
    const ch = line[i];
    if (quote) {
      if (ch === '\\')
        i++; // skip escaped char
      else if (ch === quote) quote = null;
    } else if (ch === "'" || ch === '"') {
      quote = ch;
    } else if (ch === '#') {
      return { code: line.slice(0, i), comment: line.slice(i) };
    }
    i++;
  }
  return { code: line, comment: '' };
}

function convertQuotesInLine(line: string, style: QuoteStyle): string {
  const { code, comment } = splitComment(line);
  if (!code) return line;
  const converted = code.replace(STRING_RE, (lit) => {
    if (lit.startsWith('"""') || lit.startsWith("'''")) return lit;
    const target = style === 'single' ? "'" : '"';
    const other = style === 'single' ? '"' : "'";
    const delim = lit[0];
    if (delim === target) return lit;
    const body = lit.slice(1, -1);
    let out = '';
    for (let i = 0; i < body.length; i++) {
      const ch = body[i];
      if (ch === '\\') {
        const next = body[i + 1] ?? '';
        if (next === other) {
          out += other;
          i++;
        } else if (next === target) {
          out += target;
          i++;
        } else {
          out += ch + next;
          if (next) i++;
        }
      } else if (ch === target) {
        out += '\\' + target;
      } else {
        out += ch;
      }
    }
    return target + out + target;
  });
  return converted + comment;
}

/** Line content with string literals blanked and comments removed (for structure analysis). */
function structureCode(line: string): string {
  let s = line.replace(STRING_RE, "''");
  const hash = s.indexOf('#');
  if (hash >= 0) s = s.slice(0, hash);
  return s;
}

function bracketDelta(code: string): number {
  let delta = 0;
  for (const ch of code) {
    if (ch === '(' || ch === '[' || ch === '{') delta++;
    else if (ch === ')' || ch === ']' || ch === '}') delta--;
  }
  return delta;
}

function leadingWidth(line: string, tabWidth: number): number {
  let width = 0;
  for (const ch of line) {
    if (ch === ' ') width += 1;
    else if (ch === '\t') width += tabWidth;
    else break;
  }
  return width;
}

/**
 * Format Python source: normalize indentation, quote style, trailing
 * whitespace and blank-line runs. Deterministic and heuristic — it never
 * rewrites code semantics, only whitespace and string delimiters.
 */
export function formatPython(input: string, options: FormatOptions): FormatResult {
  const unit = options.useTabs ? '\t' : ' '.repeat(clampIndentSize(options.indentSize));
  const tabWidth = options.useTabs ? 1 : clampIndentSize(options.indentSize);
  const lines = input.replace(/\r\n?/g, '\n').split('\n');

  // 1. Strip trailing whitespace (except when preserving it for trailing runs).
  let work = lines.map((line) => {
    if (!options.trimTrailingWhitespace) {
      // Keep original line incl. trailing whitespace, but drop pure-whitespace noise only at EOF
      return line;
    }
    const stripped = line.replace(/[ \t]+$/, '');
    return stripped;
  });
  if (!options.trimTrailingWhitespace) {
    // Remove trailing whitespace-only lines at EOF (they carry no content)
    while (work.length > 0 && (work[work.length - 1] ?? '').trim().length === 0) work.pop();
  }

  // 2. Optional dedent: remove the common leading indentation.
  if (options.dedent) {
    const widths = work
      .filter((line) => line.trim().length > 0)
      .map((line) => leadingWidth(line, tabWidth));
    const common = widths.length > 0 ? Math.min(...widths) : 0;
    if (common > 0) {
      work = work.map((line) => {
        let removed = 0;
        let i = 0;
        while (i < line.length && removed < common) {
          const ch = line[i];
          if (ch === ' ') {
            removed += 1;
            i++;
          } else if (ch === '\t') {
            removed += tabWidth;
            i++;
          } else break;
        }
        return line.slice(i);
      });
    }
  }

  // 3. Re-indent based on block openers, dedent keywords, original indentation
  //    widths and bracket depth.
  let level = 0;
  let depth = 0;
  let prevWidth = 0;
  const reindented: string[] = [];
  for (const line of work) {
    const trimmed = line.trim();
    if (trimmed.length === 0) {
      reindented.push('');
      continue;
    }
    const width = leadingWidth(line, tabWidth);
    if (DEDENT_KEYWORDS.test(trimmed)) {
      level = Math.max(0, level - 1);
    } else if (width < prevWidth && depth === 0) {
      level = Math.max(0, level - Math.floor((prevWidth - width) / tabWidth));
    }
    const cc = structureCode(trimmed);
    const startsWithCloser = /^[)\]}]/.test(trimmed);
    const continuation = depth > 0 && !startsWithCloser;
    const indentUnits = level + (continuation ? 1 : 0);
    const content = options.trimTrailingWhitespace ? trimmed : line.replace(/^[ \t]+/, '');
    reindented.push(unit.repeat(Math.max(0, indentUnits)) + content);
    const delta = bracketDelta(cc);
    depth = Math.max(0, depth + delta);
    if (depth === 0 && !continuation && cc.trimEnd().endsWith(':')) {
      level += 1;
    }
    prevWidth = width;
  }

  // 4. Normalize blank-line runs.
  const blankLinesRemovedBefore = reindented.filter((l) => l.length === 0).length;
  const maxRun =
    options.blankLines === 'preserve' ? Infinity : options.blankLines === 'collapse' ? 1 : 2;
  const normalized: string[] = [];
  let run = 0;
  for (const line of reindented) {
    if (line.length === 0) {
      run++;
      if (run > maxRun) continue;
      normalized.push(line);
    } else {
      run = 0;
      normalized.push(line);
    }
  }

  // 5. Trim leading/trailing blank lines for normalize/collapse modes.
  let outputLines = normalized;
  if (options.blankLines !== 'preserve') {
    while (outputLines.length > 0 && (outputLines[0] ?? '').length === 0) outputLines.shift();
    while (outputLines.length > 0 && (outputLines[outputLines.length - 1] ?? '').length === 0) {
      outputLines.pop();
    }
  }
  outputLines = options.blankLines === 'preserve' ? reindented : outputLines;

  const blankLinesRemoved = Math.max(
    0,
    blankLinesRemovedBefore - outputLines.filter((l) => l.length === 0).length
  );

  const quoteConverted = convertQuotes(outputLines.join('\n'), options.quoteStyle).split('\n');

  const maxLen = quoteConverted.reduce((max, l) => Math.max(max, l.length), 0);
  const effectiveMax = clampMaxLineLength(options.maxLineLength);
  const longLineNumbers =
    effectiveMax > 0
      ? quoteConverted.reduce<number[]>((acc, line, idx) => {
          if (line.length > effectiveMax) acc.push(idx + 1);
          return acc;
        }, [])
      : [];

  return {
    output: quoteConverted.join('\n'),
    stats: {
      lineCount: quoteConverted.filter((l) => l.length > 0).length,
      longLineNumbers,
      blankLinesRemoved,
      maxOutputLineLength: maxLen,
    },
  };
}

export { clampIndentSize, clampMaxLineLength };
