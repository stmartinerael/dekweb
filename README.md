# dekweb

Aesthetically-pleasing browser viewer for Donald Knuth's WEB literate programs.

## Project Overview

`dekweb` is a Node.js-based toolchain designed to convert classic WEB literate programming files into modern, interactive HTML documents. It specifically targets the core TeX system components (Tangle, Weave, and TeX itself), providing a searchable, cross-referenced, and syntax-highlighted web interface for exploring the source code.

## Getting Started

### Prerequisites

- Node.js (Latest LTS recommended)
- `weave` and `pdftex` (Optional, only required for PDF generation)

### Installation

```bash
git clone https://github.com/stmartinerael/dekweb.git
cd dekweb
make setup
```

## Development

`dekweb` follows specific development conventions to ensure high quality and consistency.

### Conventions

- **Reproduction-first**: Always create a reproduction script before fixing a bug.
- **Always Push**: Feature and fix branches must always be pushed to the remote repository.
- **Hooks**: Use `./hooks/check-pushed.sh` to verify your branch state before submitting.

Detailed conventions are maintained in [GEMINI.md](./GEMINI.md).

### Testing

```bash
npm test
```

## Architecture

- **`src/parser.js`**: Custom WEB format parser.
- **`src/tex-to-html.js`**: TeX prose to HTML converter using KaTeX.
- **`src/build.js`**: Main build orchestrator and code renderer.
- **`viewer/`**: Frontend assets (CSS/JS) for the interactive viewer.

## License

ISC
