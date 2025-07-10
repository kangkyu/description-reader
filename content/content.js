// Content Script for YouTube Description Summarizer

class DescriptionSummarizer {
  constructor() {
    this.currentVideoId = null;
    this.summaryBox = null;
    this.isProcessing = false;
    this.init();
  }

  init() {
    console.log("YouTube Description Summarizer: Content script loaded");
    this.injectStyles();
    this.observePageChanges();
    this.setupMessageListener();
  }

  injectStyles() {
    if (document.getElementById("summary-styles")) return;

    const style = document.createElement("link");
    style.id = "summary-styles";
    style.rel = "stylesheet";
    style.href = chrome.runtime.getURL("content/content.css");
    document.head.appendChild(style);
  }

  setupMessageListener() {
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
      if (request.action === "summarizeDescription") {
        this.handleSummarizeRequest();
        sendResponse({ success: true });
      }
    });
  }

  observePageChanges() {
    // YouTube is a SPA, so we need to watch for navigation changes
    let lastUrl = location.href;
    new MutationObserver(() => {
      const url = location.href;
      if (url !== lastUrl) {
        lastUrl = url;
        this.onPageChange();
      }
    }).observe(document, { subtree: true, childList: true });

    this.onPageChange();
  }

  onPageChange() {
    setTimeout(() => {
      this.currentVideoId = this.extractVideoId();
      if (this.currentVideoId) {
        this.addSummaryButton();
      } else {
        this.removeSummaryElements();
      }
    }, 1000);
  }

  extractVideoId() {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get("v");
  }

  addSummaryButton() {
    // Remove existing elements
    this.removeSummaryElements();

    // Find the description area
    const descriptionContainer = this.findDescriptionContainer();
    if (!descriptionContainer) {
      console.log("Description container not found");
      return;
    }

    // Create summary button
    const summaryButton = document.createElement("button");
    summaryButton.id = "description-summary-btn";
    summaryButton.className = "summary-button";
    summaryButton.innerHTML = `
      <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
        <path d="M14,17H7V15H14M17,13H7V11H17M17,9H7V7H17M19,3H5C3.89,3 3,3.89 3,5V19A2,2 0 0,0 5,21H19A2,2 0 0,0 21,19V5C19,3.89 18.1,3 17,3Z"/>
      </svg>
      <span>AI Summary</span>
    `;

    summaryButton.addEventListener("click", () => {
      this.handleSummaryClick();
    });

    // Insert button near description
    descriptionContainer.insertBefore(
      summaryButton,
      descriptionContainer.firstChild,
    );
  }

  findDescriptionContainer() {
    // Try multiple selectors for different YouTube layouts
    const selectors = [
      "#description-inline-expander",
      "#description",
      "#description-text",
      ".content.style-scope.ytd-video-secondary-info-renderer",
      ".content.style-scope.ytd-expandable-video-description-body-renderer",
    ];

    for (const selector of selectors) {
      const element = document.querySelector(selector);
      if (element) {
        return (
          element.closest("#description, #description-inline-expander") ||
          element.parentElement
        );
      }
    }

    return null;
  }

  async handleSummaryClick() {
    if (this.isProcessing) return;

    const button = document.getElementById("description-summary-btn");
    const existingSummary = document.getElementById("description-summary-box");

    // If summary box exists, toggle it
    if (existingSummary) {
      if (existingSummary.style.display === "none") {
        existingSummary.style.display = "block";
        button.innerHTML = `
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
            <path d="M19,6.41L17.59,5L12,10.59L6.41,5L5,6.41L10.59,12L5,17.59L6.41,19L12,13.41L17.59,19L19,17.59L13.41,12L19,6.41Z"/>
          </svg>
          <span>Hide Summary</span>
        `;
      } else {
        existingSummary.style.display = "none";
        button.innerHTML = `
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
            <path d="M14,17H7V15H14M17,13H7V11H17M17,9H7V7H17M19,3H5C3.89,3 3,3.89 3,5V19A2,2 0 0,0 5,21H19A2,2 0 0,0 21,19V5C19,3.89 18.1,3 17,3Z"/>
          </svg>
          <span>AI Summary</span>
        `;
      }
      return;
    }

    // Get video description from YouTube API
    try {
      const response = await chrome.runtime.sendMessage({
        action: "getVideoDescription",
        videoId: this.currentVideoId,
      });

      if (!response.success) {
        this.showMessage(`Error: ${response.error}`);
        return;
      }

      const description = response.description;
      if (!description || description.trim().length === 0) {
        this.showMessage("This video has no description.");
        return;
      }

      // Debug: log the description length and first 100 characters
      console.log("TubeBoost: Description length:", description.length);
      console.log(
        "TubeBoost: Description preview:",
        description.substring(0, 100) + "...",
      );

      // Check if description is too short
      if (description.length < 100) {
        this.showSummary("Description is already short enough!", false);
        return;
      }

      // Continue with summarization using the API description
      const summaryResponse = await chrome.runtime.sendMessage({
        action: "generateSummary",
        description: description,
      });

      if (summaryResponse.success) {
        this.showSummary(summaryResponse.summary, true);
      } else {
        this.showMessage(`Error: ${summaryResponse.error}`);
      }
    } catch (error) {
      console.error("Error getting video description:", error);
      this.showMessage("Failed to get video description. Please try again.");
    } finally {
      this.isProcessing = false;
      button.disabled = false;
      button.innerHTML = `
        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
          <path d="M19,6.41L17.59,5L12,10.59L6.41,5L5,6.41L10.59,12L5,17.59L6.41,19L12,13.41L17.59,19L19,17.59L13.41,12L19,6.41Z"/>
        </svg>
        <span>Hide Summary</span>
      `;
    }
  }

  extractDescription() {
    // Try multiple selectors to find description text (updated for current YouTube)
    const selectors = [
      // New YouTube layout selectors
      "ytd-text-inline-expander #plain-snippet-text",
      "ytd-text-inline-expander #snippet-text",
      "#description ytd-text-inline-expander .content",
      "#description .content.style-scope.ytd-expandable-video-description-body-renderer",
      "ytd-expandable-video-description-body-renderer .content",
      "#description-inline-expander .content",
      "#description .content",
      // Legacy selectors as fallback
      "#description-text",
      ".content.style-scope.ytd-expandable-video-description-body-renderer",
    ];

    for (const selector of selectors) {
      const element = document.querySelector(selector);
      if (element) {
        // Get text content and clean it up
        let text = element.innerText || element.textContent || "";

        // Skip if empty
        if (!text.trim()) continue;

        // Remove extra whitespace and clean up
        text = text.trim().replace(/\s+/g, " ");

        // Remove common footer elements (show more, timestamps, etc.)
        text = text.replace(/Show more/gi, "");
        text = text.replace(/Show less/gi, "");
        text = text.replace(/\d{1,2}:\d{2}/g, ""); // Remove timestamps
        text = text.replace(/\.{3,}/g, ""); // Remove multiple dots

        // Clean up and return if we have content
        text = text.trim();
        if (text.length > 10) {
          // Make sure we have substantial content
          return text;
        }
      }
    }

    return null;
  }

  showSummary(summaryText, isAISummary) {
    this.removeSummaryBox();

    const summaryBox = document.createElement("div");
    summaryBox.id = "description-summary-box";
    summaryBox.className = "summary-box";

    summaryBox.innerHTML = `
      <div class="summary-header">
        <div class="summary-title">
          ${isAISummary ? "🤖 AI Summary" : "📝 Note"}
        </div>
        <button class="summary-close" id="summary-close-btn">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
            <path d="M19,6.41L17.59,5L12,10.59L6.41,5L5,6.41L10.59,12L5,17.59L6.41,19L12,13.41L17.59,19L19,17.59L13.41,12L19,6.41Z"/>
          </svg>
        </button>
      </div>
      <div class="summary-content">
        ${summaryText}
      </div>
      ${isAISummary ? '<div class="summary-footer">Powered by Gemini AI</div>' : ""}
    `;

    // Add close functionality
    summaryBox
      .querySelector("#summary-close-btn")
      .addEventListener("click", () => {
        this.hideSummary();
      });

    // Insert after the button
    const button = document.getElementById("description-summary-btn");
    button.parentNode.insertBefore(summaryBox, button.nextSibling);
  }

  showMessage(message) {
    this.showSummary(message, false);
  }

  hideSummary() {
    const summaryBox = document.getElementById("description-summary-box");
    if (summaryBox) {
      summaryBox.style.display = "none";
    }

    const button = document.getElementById("description-summary-btn");
    if (button) {
      button.innerHTML = `
        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
          <path d="M14,17H7V15H14M17,13H7V11H17M17,9H7V7H17M19,3H5C3.89,3 3,3.89 3,5V19A2,2 0 0,0 5,21H19A2,2 0 0,0 21,19V5C19,3.89 18.1,3 17,3Z"/>
        </svg>
        <span>AI Summary</span>
      `;
    }
  }

  removeSummaryElements() {
    const button = document.getElementById("description-summary-btn");
    const summaryBox = document.getElementById("description-summary-box");

    if (button) button.remove();
    if (summaryBox) summaryBox.remove();
  }

  removeSummaryBox() {
    const summaryBox = document.getElementById("description-summary-box");
    if (summaryBox) summaryBox.remove();
  }
}

// Initialize when the script loads
if (window.location.hostname.includes("youtube.com")) {
  new DescriptionSummarizer();
}
