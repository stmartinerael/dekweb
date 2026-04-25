# dekweb

Aesthetically-pleasing browser viewer for Donald Knuth's WEB literate programs.

## Project Overview

`dekweb` is a Node.js-based toolchain designed to convert classic WEB literate programming files into modern, interactive HTML documents. It specifically targets the core TeX system components (Tangle, Weave, and TeX itself), providing a searchable, cross-referenced, and syntax-highlighted web interface for exploring the source code.

For user-facing documentation, see the [README.md](./README.md).

### Core Architecture

- **`src/parser.js`**: A custom parser for the WEB format. It partitions `.web` files into sections, handles starred/unstarred headers, and extracts TeX prose, macro definitions (`@d`, `@f`), and Pascal code chunks.
- **`src/tex-to-html.js`**: Converts TeX-style prose into HTML, utilizing KaTeX for mathematical notation.
- **`src/build.js`**: The main build orchestrator. It integrates the parser, TeX converter, and PrismJS syntax highlighting to generate a single-file HTML viewer.
- **`viewer/`**: Contains the frontend CSS (`style.css`) and JavaScript (`viewer.js`) that power the interactive sidebar, Table of Contents, and section search.

## Building and Running

The project provides both `npm` scripts and a `Makefile` for common tasks.

### Prerequisites

- Node.js (Latest LTS recommended)
- `weave` and `pdftex` (Optional, only required for PDF generation)

### Commands

| Command | Description |
| :--- | :--- |
| `npm run fetch` | Downloads the original WEB source files from CTAN. |
| `npm run build` | Generates the HTML viewer for all sources. |
| `npm start` | Runs the local web server to host the viewer at `http://localhost:7776`. |
| `npm test` | Runs the suite of unit tests for the parser. |
| `make` | Default target: builds all HTML viewers and all PDF reference files. |
| `make setup` | Performs initial setup (installs dependencies and fetches sources). |
| `make html` | Generates HTML versions of the WEB sources in `output/`. |
| `make pdf` | Generates PDF versions using the traditional WEB toolchain. |
| `make clean` | Removes build artifacts (`output/`, `.pdf`, `.tex`, etc.). |

### Build Warnings

When building `tex.web` (`make html`), you may see several KaTeX warnings:
- `LaTeX-incompatible input and strict mode is set to 'warn': In LaTeX, \\ or \newline does nothing in display mode`.
These are expected as the converter maps TeX-style line breaks to HTML, and some of these occur within mathematical contexts that KaTeX considers display mode. These warnings do not stop the build.

## Development Conventions

- **Module System**: Uses ES Modules (ESM) exclusively.
- **Branching Policy**: Always work in a feature branch (e.g., `fix/name-of-fix`). At the start of each new task, check if the current branch has been merged into `main`. If it has, or if starting a new independent task, switch to `main` and create a new branch from there. **If the current branch is unmerged, alert the user before switching or starting new work.**
- **Bug Fixes**: Follow a **Reproduction-first** approach. Create a standalone reproduction script (e.g., `reproduce_issue.js`) that confirms the bug before implementing the fix. Verify the fix with the script and then delete it before committing.
- **Testing**: Employs the built-in Node.js test runner (`node:test`). Tests are located in `test/` and focus heavily on parser accuracy and cross-referencing logic.
- **Styling**: The viewer uses modern Vanilla CSS with a focus on readability. It supports both light mode and a **Solarized Dark** theme (via `prefers-color-scheme`).
- **Typography**: Uses the **Inter** sans-serif font for body text and modern monospace fonts for code, providing a polished look in modern web browsers while maintaining the structural integrity of the original WEB format.
- **Parsing**: The parser is hand-rolled to handle the unique interleaved structure of WEB files.
