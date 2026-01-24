# YouTube Amazon Link Finder

A Chrome extension that extracts Amazon product links from YouTube video descriptions and displays them in an overlay.

## Features

- **Amazon Link Extraction**: Finds Amazon links (amazon.com, amzn.to, smile.amazon) in video descriptions
- **Overlay Display**: Shows all found links in a convenient overlay after page reload
- **Save Videos**: Save videos with their Amazon links to your account
- **AI Summaries**: Generate summaries of product descriptions using Google Gemini
- **Dark Mode Support**: Matches YouTube's light/dark themes

## Installation

1. Download or clone this repository
2. Open Chrome and go to `chrome://extensions/`
3. Enable **Developer mode** (toggle in top right)
4. Click **Load unpacked** and select this folder

## Setup

### Gemini API Key (for AI summaries)

1. Visit [Google AI Studio](https://makersuite.google.com/app/apikey)
2. Create an API key
3. Right-click extension icon → Options → paste and save your key

### Account (for saving videos)

1. Right-click extension icon → Options
2. Register or log in to save videos with their Amazon links

## Usage

1. Navigate to a YouTube video with Amazon links in the description
2. Reload the page to see the overlay with extracted links
3. Click **Save** to store the video with an AI-generated summary

## Development

Built with Manifest v3, vanilla JavaScript, and Google Gemini AI.

To develop locally:
1. Make changes to the code
2. Reload the extension in `chrome://extensions/`
3. Test on YouTube video pages

## License

MIT License
