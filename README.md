# YouTube Description Summarizer

🤖 **Get instant AI summaries of YouTube descriptions automatically!**

A Chrome extension that uses Google's Gemini AI to summarize long YouTube video descriptions and displays them prominently in the top-right corner of the page.

## 🚀 Features

- **🤖 Automatic AI Summaries**: Instantly get concise summaries when opening YouTube videos
- **📍 Top-Right Display**: Prominent, non-intrusive placement for maximum visibility
- **🎯 Smart Detection**: Only summarizes videos with substantial descriptions (100+ characters)
- **⚡ Zero-Click Experience**: No buttons to press - works automatically
- **🎨 Beautiful UI**: Smooth animations and responsive design that adapts to YouTube themes
- **🔒 Privacy-Focused**: Your API keys stay local, zero data tracking
- **🌙 Dark Mode Support**: Seamlessly matches YouTube's light/dark themes

## 📦 Installation

### Option 1: From Source (Recommended)

1. **Download or clone this repository**
2. **Open Chrome** and navigate to `chrome://extensions/`
3. **Enable "Developer mode"** (toggle in top right)
4. **Click "Load unpacked"** and select this folder
5. **Get a Gemini API key** (see setup below)
6. **Configure the extension** via the options page

### Option 2: Chrome Web Store

_Coming soon..._

## 🔑 Setup Instructions

### 1. Get Your Gemini API Key

1. Visit [Google AI Studio](https://makersuite.google.com/app/apikey)
2. Sign in with your Google account
3. Click "Create API Key"
4. Copy the generated API key

### 2. Configure the Extension

1. **Right-click the extension icon** → "Options"
2. **Paste your API key** in the configuration field
3. **Click "Test API Key"** to verify it works
4. **Click "Save API Key"** to save your settings

### 3. Start Using

1. **Visit any YouTube video** with a description
2. **Look for the "AI Summary" button** near the description
3. **Click the button** to generate a summary
4. **Enjoy concise, helpful summaries!**

## 🛠️ How It Works

1. **Detection**: The extension detects when you're on a YouTube video page
2. **Button Injection**: Adds an "AI Summary" button near the video description
3. **Content Extraction**: Extracts and cleans the video description text
4. **AI Processing**: Sends the description to Gemini AI for summarization
5. **Display**: Shows the summary in a clean, readable format

## 🎯 Perfect For

- **Busy viewers** who want quick video overviews
- **Researchers** scanning multiple videos efficiently
- **Content creators** analyzing competitor descriptions
- **Anyone** dealing with overly long YouTube descriptions

## 🔒 Privacy & Security

- ✅ **Local Storage**: API key stored securely in your browser
- ✅ **No Tracking**: Zero analytics or personal data collection
- ✅ **Direct API**: Descriptions sent directly to Google (not our servers)
- ✅ **Open Source**: Full code transparency

## 💡 Usage Tips

- **Short descriptions** (under ~200 characters) are shown as-is
- **Long descriptions** get summarized into 2-3 key sentences
- **Click "Hide Summary"** to collapse the summary box
- **Refresh the page** if the button doesn't appear initially

## 🆘 Troubleshooting

### Button Not Appearing?

- Make sure you're on a YouTube video page (not homepage/search)
- Try refreshing the page
- Check that the extension is enabled

### API Key Not Working?

- Verify you copied the entire key correctly
- Ensure your API key has Gemini access enabled
- Check you haven't exceeded usage limits

### Summaries Not Good Quality?

- Very short descriptions can't be meaningfully summarized
- Technical/non-English content may not summarize well
- Try the description on different types of videos

## 🔧 Development

Built with:

- **Manifest v3** for modern Chrome compatibility
- **Vanilla JavaScript** for lightweight performance
- **Google Gemini AI** for intelligent summarization
- **Responsive CSS** for cross-device compatibility

### Local Development

1. Clone the repository
2. Make your changes
3. Reload the extension in `chrome://extensions/`
4. Test on various YouTube videos

## 📈 Roadmap

- [ ] Support for multiple AI providers
- [ ] Customizable summary length
- [ ] Keyboard shortcuts
- [ ] Summary caching
- [ ] Dark/light theme preferences
- [ ] Multi-language support

## 🤝 Contributing

Contributions are welcome! Please feel free to:

- Report bugs via GitHub issues
- Suggest new features
- Submit pull requests
- Help with translations

## 📄 License

MIT License - feel free to modify and distribute!

## ❤️ Support

If you find this extension helpful:

- ⭐ Star the repository
- 📢 Share with friends
- 🐛 Report bugs to help improve it
- 💡 Suggest new features

---

**Made with ❤️ for YouTube viewers everywhere**
