# Python Formatter

Format, beautify and clean up Python source code directly in your browser — no upload, no account, no tracking.

**Live:** [python-formatter.itsjust.tools](https://python-formatter.itsjust.tools)

## Features

- **Indentation normalization** — re-indents block structure to 2, 4 or 8 spaces (or tabs), fixing inconsistent pasted code
- **Quote style conversion** — rewrite single-line string literals to single or double quotes, escaping inner quotes correctly
- **Blank-line normalization** — collapse blank-line runs to one, cap them at two, or preserve everything
- **Trailing whitespace cleanup** — strips stray trailing spaces and tabs per line
- **Dedent pasted code** — remove common leading indentation before re-formatting
- **Long-line hints** — flags output lines over your threshold (PEP 8 recommends 79)
- **Formatting stats** — non-blank line count, blank lines removed, longest line length
- **Export & copy** — copy the formatted output or download it as a `.py` file
- **Shareable URL state** — the whole tool state (code + settings) compresses into the URL
- **Keyboard-friendly, dark mode, and PWA-ready** — built on the itsjust tool shell
- **100% client-side** — nothing ever leaves your browser

## Keyboard shortcuts

| Key | Action      |
| --- | ----------- |
| `Y` | Copy output |
| `X` | Clear input |

## Development

```bash
npm install
npm run build -w @itsjust/core   # build shared core first
npm run dev
npm test
```

## Deployment

```bash
docker build -t itsjust-python-formatter .
docker run -p 3000:3000 itsjust-python-formatter
```

## License

MIT
