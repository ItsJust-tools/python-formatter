import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import type { ReactNode } from 'react';
import ToolClient from '@/app/tool-client';
import ToolClientWrapper from '@/app/tool-client-wrapper';

vi.mock('next/link', () => ({
  default: ({ href, children, ...props }: { href: string; children: ReactNode }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

vi.mock('next/dynamic', () => ({
  default: () => () => <div data-testid="dynamic-tool-client">dynamic-tool-client</div>,
}));

const mockSetData = vi.fn();
const mockToast = vi.fn();
const mockHandleExport = vi.fn();
const mockImport = vi.fn();

vi.mock('@itsjust/core', () => ({
  ToolShell: ({ toolbar, sidebar, canvas, statusBar }: Record<string, unknown>) => (
    <div>
      <div>{toolbar as ReactNode}</div>
      <div>{sidebar as ReactNode}</div>
      <div>{canvas as ReactNode}</div>
      <div>{statusBar as ReactNode}</div>
    </div>
  ),
  ImportExport: ({ onShare }: { onShare?: () => void }) => (
    <button type="button" onClick={onShare}>
      trigger-share
    </button>
  ),
  useTool: () => ({
    state: {
      data: {
        input: 'x = 1',
        indentSize: 4,
        useTabs: false,
        quoteStyle: 'double',
        blankLines: 'normalize',
        trimTrailingWhitespace: true,
        dedent: false,
        maxLineLength: 79,
        history: [],
      },
      setData: mockSetData,
      isDirty: false,
      lastSaved: 'just now',
    },
    toast: mockToast,
    supportedFormats: ['png'],
    handleExport: mockHandleExport,
    importFromFile: mockImport,
    isImporting: false,
  }),
}));

vi.mock('@/tool', () => ({
  toolConfig: {
    id: 'python-formatter',
    name: 'Python Formatter',
    version: '1.4.0',
    features: { sidebar: true },
    theme: { brand: 'Python Formatter' },
  },
  templateBaseVersion: '1.4.0',
  Canvas: ({ state }: { state: Record<string, unknown> }) => (
    <div>canvas:{String(state.quoteStyle)}</div>
  ),
  Toolbar: () => <div>toolbar</div>,
  Sidebar: () => <div>sidebar</div>,
}));

vi.mock('@/tool/tool-definition', () => ({
  pythonFormatterTool: {
    serialize: (state: unknown) => JSON.stringify(state),
    deserialize: () => ({
      success: true,
      data: {
        input: 'x = 1',
        indentSize: 4,
        useTabs: false,
        quoteStyle: 'double',
        blankLines: 'normalize',
        trimTrailingWhitespace: true,
        dedent: false,
        maxLineLength: 79,
        history: [],
      },
    }),
  },
}));

describe('app client', () => {
  beforeEach(() => {
    mockSetData.mockReset();
    mockToast.mockReset();
    Object.defineProperty(navigator, 'clipboard', {
      writable: true,
      value: { writeText: vi.fn().mockResolvedValue(undefined) },
    });
    Object.defineProperty(navigator, 'share', {
      writable: true,
      value: vi.fn().mockResolvedValue(undefined),
    });
    window.history.replaceState(null, '', 'http://localhost:3000/');
  });

  it('renders dynamic tool client wrapper', () => {
    render(<ToolClientWrapper />);
    expect(screen.getByTestId('dynamic-tool-client')).toBeInTheDocument();
  });

  it('handles share flow in tool client', async () => {
    render(<ToolClient />);

    expect(screen.getByText('toolbar')).toBeInTheDocument();
    fireEvent.click(screen.getByText('trigger-share'));
    await Promise.resolve();
    await new Promise((r) => setTimeout(r, 0));

    expect(mockToast).toHaveBeenCalled();
  });

  it('loads shared state from URL', () => {
    // lz-string encode of a JSON payload
    const payload = JSON.stringify({ input: 'y = 2' });
    let encoded = '';
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { compressToEncodedURIComponent } = require('lz-string');
      encoded = compressToEncodedURIComponent(payload);
    } catch {
      encoded = '';
    }
    window.history.replaceState(
      null,
      '',
      `http://localhost:3000/?state=${encodeURIComponent(encoded)}`
    );
    render(<ToolClient />);
    expect(mockToast).toHaveBeenCalled();
  });
});
