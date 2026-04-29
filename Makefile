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

.PHONY: all html pdf clean test setup help server

# Default target
all: html pdf ## Generate HTML viewer and PDF reference files

# Show this help message
help: ## Show this help message
	@echo "Usage: make [target]"
	@echo ""
	@echo "Targets:"
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | sort | awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-15s\033[0m %s\n", $$1, $$2}'

# Run the local web server
server: ## Run the local web server to host the viewer
	$(NPM) start

# Generate HTML viewer files
html: $(HTMLS) ## Generate HTML viewer files

$(OUT_DIR)/%.html: $(WEB_DIR)/%.web $(SRC_DIR)/*.js $(VIEWER_DIR)/*
	@mkdir -p $(OUT_DIR)
	$(NODE) $(SRC_DIR)/build.js $*

# Generate PDF reference files
pdf: $(PDFS) ## Generate PDF reference files

%.pdf: $(WEB_DIR)/%.web
	$(WEAVE) $<
	$(PDFTEX) $*.tex

# Run tests
test: ## Run tests
	$(NPM) test

# Initial setup: install dependencies and fetch WEB sources
setup: ## Initial setup: install dependencies and fetch WEB sources
	$(NPM) install
	$(NPM) run fetch

# Cleanup build artifacts
clean: ## Cleanup build artifacts
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
