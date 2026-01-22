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
        this.autoGenerateSummary();
      } else {
        this.removeSummaryElements();
      }
    }, 2000); // Increased delay to ensure page is fully loaded
  }

  extractVideoId() {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get("v");
  }

  async autoGenerateSummary() {
    // Remove existing elements
    this.removeSummaryElements();

    // Check if we're already processing
    if (this.isProcessing) return;

    // Show loading indicator in top-right corner
    this.showLoadingIndicator();

    try {
      // Get video description from page DOM
      const description = this.extractDescription();

      if (!description || description.trim().length === 0) {
        this.hideLoadingIndicator();
        return; // Don't show anything for videos without descriptions
      }

      // Debug: log the description length and first 100 characters
      console.log("TubeBoost: Description length:", description.length);
      console.log(
        "TubeBoost: Description preview:",
        description.substring(0, 100) + "...",
      );

      // Check if description is too short
      if (description.length < 100) {
        this.hideLoadingIndicator();
        return; // Don't show summary for short descriptions
      }

      // Generate summary
      const summaryResponse = await chrome.runtime.sendMessage({
        action: "generateSummary",
        description: description,
      });

      if (summaryResponse.success) {
        this.showTopRightSummary(summaryResponse.summary);
      } else {
        this.showTopRightMessage(`Error: ${summaryResponse.error}`, false);
      }
    } catch (error) {
      console.error("Error auto-generating summary:", error);
      this.showTopRightMessage("Failed to generate summary", false);
    } finally {
      this.hideLoadingIndicator();
    }
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

    // Get video description from page DOM
    try {
      const description = this.extractDescription();

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
    // First, try to get description from YouTube's embedded JSON data
    const jsonDescription = this.extractDescriptionFromInitialData();
    if (jsonDescription && jsonDescription.length > 10) {
      console.log("TubeBoost: Got description from ytInitialPlayerResponse");
      return jsonDescription;
    }

    // Fallback to DOM scraping if JSON extraction fails
    console.log("TubeBoost: Falling back to DOM scraping");
    return this.extractDescriptionFromDOM();
  }

  extractDescriptionFromInitialData() {
    // Try accessing the global variable first (faster)
    if (typeof ytInitialPlayerResponse !== "undefined" && ytInitialPlayerResponse) {
      const desc = ytInitialPlayerResponse?.videoDetails?.shortDescription;
      if (desc) return desc;
    }

    // Parse from script tags if global variable not available
    const scripts = document.querySelectorAll("script");
    for (const script of scripts) {
      const text = script.textContent;
      if (text && text.includes("ytInitialPlayerResponse")) {
        // Match the JSON object assignment
        const match = text.match(/ytInitialPlayerResponse\s*=\s*(\{.+?\});/s);
        if (match) {
          try {
            const data = JSON.parse(match[1]);
            const desc = data?.videoDetails?.shortDescription;
            if (desc) return desc;
          } catch (e) {
            console.log("TubeBoost: Failed to parse ytInitialPlayerResponse", e);
          }
        }
      }
    }

    return null;
  }

  extractDescriptionFromDOM() {
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

  showLoadingIndicator() {
    this.removeSummaryElements();

    const loadingIndicator = document.createElement("div");
    loadingIndicator.id = "tubeboost-loading-indicator";
    loadingIndicator.className = "tubeboost-top-right-loading";
    loadingIndicator.innerHTML = `
      <div class="loading-content">
        <div class="loading-spinner"></div>
        <span>Generating AI Summary...</span>
      </div>
    `;

    document.body.appendChild(loadingIndicator);
  }

  hideLoadingIndicator() {
    const loadingIndicator = document.getElementById(
      "tubeboost-loading-indicator",
    );
    if (loadingIndicator) loadingIndicator.remove();
  }

  showTopRightSummary(summaryText) {
    this.removeSummaryElements();

    const summaryBox = document.createElement("div");
    summaryBox.id = "tubeboost-top-right-summary";
    summaryBox.className = "tubeboost-top-right-summary";

    summaryBox.innerHTML = `
      <div class="summary-header">
        <div class="summary-title">
          🤖 AI Summary
        </div>
        <button class="summary-close" id="tubeboost-summary-close">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
            <path d="M19,6.41L17.59,5L12,10.59L6.41,5L5,6.41L10.59,12L5,17.59L6.41,19L12,13.41L17.59,19L19,17.59L13.41,12L19,6.41Z"/>
          </svg>
        </button>
      </div>
      <div class="summary-content">
        ${summaryText}
      </div>
      <div class="summary-footer">Powered by Gemini AI</div>
    `;

    // Add close functionality
    summaryBox
      .querySelector("#tubeboost-summary-close")
      .addEventListener("click", () => {
        this.removeSummaryElements();
      });

    document.body.appendChild(summaryBox);
  }

  showTopRightMessage(message, isAISummary) {
    this.removeSummaryElements();

    const messageBox = document.createElement("div");
    messageBox.id = "tubeboost-top-right-summary";
    messageBox.className = "tubeboost-top-right-summary error";

    messageBox.innerHTML = `
      <div class="summary-header">
        <div class="summary-title">
          ${isAISummary ? "🤖" : "⚠️"} TubeBoost
        </div>
        <button class="summary-close" id="tubeboost-summary-close">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
            <path d="M19,6.41L17.59,5L12,10.59L6.41,5L5,6.41L10.59,12L5,17.59L6.41,19L12,13.41L17.59,19L19,17.59L13.41,12L19,6.41Z"/>
          </svg>
        </button>
      </div>
      <div class="summary-content">
        ${message}
      </div>
    `;

    // Add close functionality
    messageBox
      .querySelector("#tubeboost-summary-close")
      .addEventListener("click", () => {
        this.removeSummaryElements();
      });

    document.body.appendChild(messageBox);

    // Auto-hide error messages after 5 seconds
    if (!isAISummary) {
      setTimeout(() => {
        this.removeSummaryElements();
      }, 5000);
    }
  }

  removeSummaryElements() {
    const button = document.getElementById("description-summary-btn");
    const summaryBox = document.getElementById("tubeboost-top-right-summary");
    const loadingIndicator = document.getElementById(
      "tubeboost-loading-indicator",
    );

    if (button) button.remove();
    if (summaryBox) summaryBox.remove();
    if (loadingIndicator) loadingIndicator.remove();
  }
}

// Initialize when the script loads
if (window.location.hostname.includes("youtube.com")) {
  new DescriptionSummarizer();
}
