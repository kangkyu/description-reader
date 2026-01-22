// Background Script for YouTube Description Summarizer

class DescriptionSummarizerBackground {
  constructor() {
    this.geminiApiKey = null;
    this.init();
  }

  init() {
    console.log("Description Summarizer: Background script loaded");
    this.setupEventListeners();
    this.loadApiKey();
  }

  setupEventListeners() {
    // Handle messages from content script
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
      this.handleMessage(request, sender, sendResponse);
      return true; // Keep message channel open for async responses
    });

    // Handle extension installation
    chrome.runtime.onInstalled.addListener((details) => {
      if (details.reason === "install") {
        this.handleFirstInstall();
      }
    });
  }

  async loadApiKey() {
    try {
      const result = await chrome.storage.sync.get(["geminiApiKey"]);
      this.geminiApiKey = result.geminiApiKey;
    } catch (error) {
      console.error("Error loading API key:", error);
    }
  }

  async handleMessage(request, sender, sendResponse) {
    switch (request.action) {
      case "generateSummary":
        await this.generateSummary(request.description, sendResponse);
        break;

      case "setApiKey":
        await this.setApiKey(request.apiKey, sendResponse);
        await this.loadApiKey(); // Reload keys after setting
        break;

      case "getApiKey":
        sendResponse({ success: true, apiKey: this.geminiApiKey });
        break;

      default:
        sendResponse({ success: false, error: "Unknown action" });
    }
  }

  async generateSummary(description, sendResponse) {
    try {
      if (!this.geminiApiKey) {
        sendResponse({
          success: false,
          error:
            "Gemini API key not configured. Please set it in extension options.",
        });
        return;
      }

      if (!description || description.trim().length < 50) {
        sendResponse({
          success: false,
          error: "Description too short to summarize.",
        });
        return;
      }

      // Call Gemini API
      const summary = await this.callGeminiAPI(description);

      sendResponse({
        success: true,
        summary: summary,
      });
    } catch (error) {
      console.error("Error generating summary:", error);
      sendResponse({
        success: false,
        error: "Failed to generate summary: " + error.message,
      });
    }
  }

  async callGeminiAPI(description) {
    const prompt = `Please provide a concise summary of this YouTube video description in 2-3 sentences. Focus on the main topic, key points, and what viewers can expect. Here's the description:

${description}

Summary:`;

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${this.geminiApiKey}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                {
                  text: prompt,
                },
              ],
            },
          ],
          generationConfig: {
            temperature: 0.3,
            maxOutputTokens: 1024,
            topP: 0.8,
            topK: 40,
          },
        }),
      },
    );

    if (!response.ok) {
      if (response.status === 400) {
        throw new Error("Invalid API request. Please check your API key.");
      } else if (response.status === 403) {
        throw new Error("API key invalid or quota exceeded.");
      } else {
        throw new Error(`API request failed: ${response.status}`);
      }
    }

    const data = await response.json();

    if (
      !data.candidates ||
      !data.candidates[0] ||
      !data.candidates[0].content ||
      !data.candidates[0].content.parts ||
      !data.candidates[0].content.parts[0]
    ) {
      throw new Error("Invalid response from Gemini API");
    }

    let summary = data.candidates[0].content.parts[0].text.trim();

    // Clean up the summary
    summary = summary.replace(/^Summary:\s*/i, "");
    summary = summary.replace(/^\**Summary\**:?\s*/i, "");

    return summary;
  }

  async setApiKey(apiKey, sendResponse) {
    try {
      await chrome.storage.sync.set({ geminiApiKey: apiKey });
      this.geminiApiKey = apiKey;
      sendResponse({ success: true });
    } catch (error) {
      console.error("Error saving API key:", error);
      sendResponse({ success: false, error: error.message });
    }
  }

  handleFirstInstall() {
    // Open options page for API key setup
    chrome.runtime.openOptionsPage();

    // Show welcome notification
    chrome.notifications.create({
      type: "basic",
      iconUrl: "icons/icon48.png",
      title: "YouTube Description Summarizer",
      message:
        "Welcome! Please set up your Gemini API key in the options to start summarizing descriptions.",
    });
  }

  // Simple fallback summarization if Gemini API fails
  generateFallbackSummary(description) {
    // Extract first few sentences
    const sentences = description.split(/[.!?]+/).filter((s) => s.trim());

    if (sentences.length <= 2) {
      return description;
    }

    // Take first 2-3 sentences or up to 200 characters
    let summary = "";
    for (let i = 0; i < Math.min(3, sentences.length); i++) {
      const sentence = sentences[i].trim();
      if (summary.length + sentence.length > 200) break;
      summary += sentence + ". ";
    }

    return summary.trim() || description.substring(0, 200) + "...";
  }
}

// Initialize background script
new DescriptionSummarizerBackground();
