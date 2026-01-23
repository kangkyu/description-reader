# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

YouTube Amazon Link Finder is a Chrome Extension (Manifest v3) that extracts Amazon affiliate links from YouTube video descriptions and displays them in an overlay. Users can save videos with their Amazon links to a Rails backend, which also generates AI summaries using Google's Gemini API.

## Architecture

The extension follows standard Chrome Extension Manifest v3 architecture:

- **content/content.js**: Content script injected into YouTube pages. The `AmazonLinkFinder` class observes URL changes (YouTube is a SPA), extracts descriptions from `ytInitialPlayerResponse` (YouTube's embedded JSON), parses Amazon links using regex patterns, and displays them in an overlay. Falls back to DOM scraping if JSON extraction fails.

- **background/background.js**: Service worker that handles:
  - Gemini API calls for generating summaries (`generateSummary` action)
  - Saving videos to the backend (`saveSummary` action)
  - Opening the videos page with auth token injection (`openVideosPage` action)
  - User authentication status (`getAuthStatus` action)

- **options/options.js**: Settings page for:
  - Configuring the Gemini API key
  - User login/registration with the backend
  - Import/export settings

- **content/content.css**: Styles for the overlay including dark theme support

## Key Behaviors

- Extracts Amazon links from descriptions (amazon.com, amzn.to, smile.amazon, etc.)
- Content script uses MutationObserver to detect YouTube SPA navigation
- Descriptions extracted from `ytInitialPlayerResponse` JSON with video ID verification
- On SPA navigation, may require page reload to fetch new video's description (user is notified)
- API keys and auth tokens stored in `chrome.storage.sync`
- "Save" button generates AI summary via Gemini and saves to backend
- "View all saved videos" opens backend page with auth token passed via URL hash

## Backend Integration

The extension communicates with a Rails backend (URL configured in `API_BASE_URL`):
- `POST /session` - User login
- `POST /registration` - User registration
- `DELETE /session` - User logout
- `POST /summaries` - Save video with Amazon links and AI summary
- `GET /amazon_links` - Fetch saved Amazon links (used by web view)

## Development

1. Load extension: `chrome://extensions/` > Enable Developer mode > Load unpacked > Select this folder
2. After code changes: Click refresh icon on extension card in `chrome://extensions/`
3. To use localhost, edit `config.js` (use `git update-index --assume-unchanged config.js` to ignore local changes)
4. Test on YouTube video pages that have Amazon links in their descriptions

## API Setup

- **Gemini API key**: Get at https://makersuite.google.com/app/apikey (required for summary generation)
- **Backend account**: Register via extension options page (required for saving videos)
