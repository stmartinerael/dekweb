# dekweb — Makefile

# Tools
NODE = node
WEAVE = weave
PDFTEX = pdftex
NPM = npm

# Directories
SRC_DIR = src
WEB_DIR = web-sources
OUT_DIR = output
VIEWER_DIR = viewer

# Files
WEBS = $(wildcard $(WEB_DIR)/*.web)
HTMLS = $(patsubst $(WEB_DIR)/%.web,$(OUT_DIR)/%.html,$(WEBS))
PDFS = $(patsubst $(WEB_DIR)/%.web,%.pdf,$(WEBS))

.PHONY: all html pdf clean test setup

# Default target
all: html pdf

# Generate HTML viewer files
html: $(HTMLS)

$(OUT_DIR)/%.html: $(WEB_DIR)/%.web $(SRC_DIR)/*.js $(VIEWER_DIR)/*
	@mkdir -p $(OUT_DIR)
	$(NODE) $(SRC_DIR)/build.js $*

# Generate PDF reference files
pdf: $(PDFS)

%.pdf: $(WEB_DIR)/%.web
	$(WEAVE) $<
	$(PDFTEX) $*.tex

# Run tests
test:
	$(NPM) test

# Initial setup: install dependencies and fetch WEB sources
setup:
	$(NPM) install
	$(NPM) run fetch

# Cleanup build artifacts
clean:
	rm -rf $(OUT_DIR)
	rm -f *.pdf *.tex *.log *.idx *.scn CONTENTS.tex
	@if [ -f reports.json ]; then \
		if [ "$(FORCE_CLEAN_REPORTS)" = "1" ] || $(NODE) -e "const r=JSON.parse(require('fs').readFileSync('reports.json','utf8')); process.exit(r.processed || (Array.isArray(r) && r.length === 0) ? 0 : 1)" 2>/dev/null; then \
			rm -f reports.json; \
			echo "reports.json deleted."; \
		else \
			echo "Skipping reports.json (contains unprocessed reports). Use FORCE_CLEAN_REPORTS=1 to override."; \
		fi \
	fi
