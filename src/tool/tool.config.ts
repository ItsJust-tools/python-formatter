import type { ToolConfig } from '@itsjust/core';

const toolConfig = {
  id: 'python-formatter',
  name: 'Python Formatter',
  description:
    'Format and beautify Python code with configurable indentation and style options, fully client-side.',
  version: '1.4.0',
  exportFormats: ['png', 'jpeg', 'webp', 'pdf'],
  features: {
    export: true,
    autoSave: true,
    undoRedo: true,
    sidebar: true,
    statusBar: true,
    darkMode: true,
  },
  theme: {
    accent: '#3b82f6',
    accentHover: '#2563eb',
    accentSubtle: 'rgba(59, 130, 246, 0.08)',
    brand: 'Python Formatter',
    icon: 'Py',
  },
} satisfies ToolConfig;

export default toolConfig;
