# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

YouTube Description Summarizer is a Chrome Extension (Manifest v3) that extracts YouTube video descriptions from the page's embedded JSON data and generates AI summaries using Google's Gemini API. Summaries appear in a top-right overlay on YouTube video pages.

## Architecture

The extension follows standard Chrome Extension Manifest v3 architecture:

- **content/content.js**: Content script injected into YouTube pages. The `DescriptionSummarizer` class observes URL changes (YouTube is a SPA), extracts descriptions from `ytInitialPlayerResponse` (YouTube's embedded JSON), and requests summaries from the background script via `chrome.runtime.sendMessage`. Falls back to DOM scraping if JSON extraction fails.

- **background/background.js**: Service worker that handles Gemini API calls. The `DescriptionSummarizerBackground` class generates summaries using `gemini-2.5-flash`.

- **options/options.js**: Settings page for configuring the Gemini API key with test/save/clear functionality.

## Key Behaviors

- Descriptions under 100 characters are skipped (no summary shown)
- Content script uses MutationObserver to detect YouTube navigation (SPA routing)
- Descriptions extracted from `ytInitialPlayerResponse` JSON (no YouTube API key needed)
- API key stored in `chrome.storage.sync`
- Summaries display in a fixed-position overlay in top-right corner

## Development

1. Load extension: `chrome://extensions/` > Enable Developer mode > Load unpacked > Select this folder
2. After code changes: Click refresh icon on extension card in `chrome://extensions/`
3. Test on YouTube video pages with descriptions 100+ characters

## API Setup

Only a Gemini API key is required:
- Get your key at: https://makersuite.google.com/app/apikey
