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
