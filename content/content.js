// Content Script for YouTube Description Summarizer

class DescriptionSummarizer {
  constructor() {
    this.currentVideoId = null;
    this.summaryBox = null;
    this.isProcessing = false;
    this.currentSummaryText = null;
    this.currentAmazonLinks = [];
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
    // Clear previous video's data
    this.currentSummaryText = null;
    this.currentAmazonLinks = [];

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

      // Extract Amazon affiliate links
      const amazonLinks = this.extractAmazonLinks(description);
      console.log("TubeBoost: Found Amazon links:", amazonLinks.length);

      // Debug: log the description length and first 100 characters
      console.log("TubeBoost: Description length:", description.length);
      console.log(
        "TubeBoost: Description preview:",
        description.substring(0, 100) + "...",
      );

      // Check if description is too short
      if (description.length < 100) {
        // Even if description is short, show Amazon links if found
        if (amazonLinks.length > 0) {
          this.hideLoadingIndicator();
          this.showTopRightSummary(null, amazonLinks);
          return;
        }
        this.hideLoadingIndicator();
        return; // Don't show summary for short descriptions
      }

      // Generate summary
      const summaryResponse = await chrome.runtime.sendMessage({
        action: "generateSummary",
        description: description,
      });

      if (summaryResponse.success) {
        this.showTopRightSummary(summaryResponse.summary, amazonLinks);
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

  extractAmazonLinks(description) {
    if (!description) return [];

    // Regex patterns for various Amazon link formats
    const amazonPatterns = [
      // Full Amazon URLs (various country domains)
      /https?:\/\/(?:www\.)?amazon\.(com|co\.uk|de|fr|es|it|ca|com\.au|co\.jp|in|com\.br|com\.mx|nl|sg|ae|sa|se|pl|eg|tr)\/[^\s<>"']+/gi,
      // Amazon short links (amzn.to)
      /https?:\/\/amzn\.to\/[^\s<>"']+/gi,
      // Amazon smile links
      /https?:\/\/smile\.amazon\.[a-z.]+\/[^\s<>"']+/gi,
    ];

    const links = new Set();

    for (const pattern of amazonPatterns) {
      const matches = description.match(pattern);
      if (matches) {
        matches.forEach((link) => {
          // Clean up the link (remove trailing punctuation)
          const cleanedLink = link.replace(/[.,;:!?)]+$/, "");
          links.add(cleanedLink);
        });
      }
    }

    return Array.from(links);
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

  async showTopRightSummary(summaryText, amazonLinks = []) {
    this.removeSummaryElements();
    this.currentSummaryText = summaryText;
    this.currentAmazonLinks = amazonLinks;

    const summaryBox = document.createElement("div");
    summaryBox.id = "tubeboost-top-right-summary";
    summaryBox.className = "tubeboost-top-right-summary";

    // Check if user is logged in
    let isLoggedIn = false;
    try {
      const authStatus = await chrome.runtime.sendMessage({ action: "getAuthStatus" });
      isLoggedIn = authStatus.isLoggedIn;
    } catch (e) {
      console.log("Could not check auth status:", e);
    }

    const saveButtonHtml = isLoggedIn && summaryText
      ? `<button class="summary-save-btn" id="tubeboost-summary-save">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
            <path d="M17 3H5c-1.11 0-2 .9-2 2v14c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V7l-4-4zm-5 16c-1.66 0-3-1.34-3-3s1.34-3 3-3 3 1.34 3 3-1.34 3-3 3zm3-10H5V5h10v4z"/>
          </svg>
          Save
        </button>`
      : "";

    // Build Amazon links HTML
    const amazonLinksHtml = amazonLinks.length > 0
      ? `<div class="amazon-links-section">
          <div class="amazon-links-header">
            <span class="amazon-icon">🛒</span> Amazon Links (${amazonLinks.length})
          </div>
          <div class="amazon-links-list">
            ${amazonLinks.map((link, index) => `
              <a href="${link}" target="_blank" rel="noopener noreferrer" class="amazon-link">
                <span class="amazon-link-number">${index + 1}</span>
                <span class="amazon-link-url">${this.truncateUrl(link)}</span>
                <svg class="amazon-link-icon" width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M14,3V5H17.59L7.76,14.83L9.17,16.24L19,6.41V10H21V3M19,19H5V5H12V3H5C3.89,3 3,3.9 3,5V19A2,2 0 0,0 5,21H19A2,2 0 0,0 21,19V12H19V19Z"/>
                </svg>
              </a>
            `).join("")}
          </div>
        </div>`
      : `<div class="amazon-links-section">
          <div class="amazon-links-header">
            <span class="amazon-icon">🛒</span> Amazon Links
          </div>
          <div class="amazon-links-empty">
            There's no amazon affiliate links found
          </div>
        </div>`;

    // Determine header title based on content
    const headerTitle = summaryText ? "🤖 AI Summary" : "🛒 Amazon Links";

    // Build summary content HTML
    const summaryContentHtml = summaryText
      ? `<div class="summary-content">${summaryText}</div>`
      : "";

    // Build footer HTML
    const footerHtml = summaryText
      ? '<div class="summary-footer">Powered by Gemini AI</div>'
      : "";

    summaryBox.innerHTML = `
      <div class="summary-header">
        <div class="summary-title">
          ${headerTitle}
        </div>
        <div class="summary-header-actions">
          ${saveButtonHtml}
          <button class="summary-close" id="tubeboost-summary-close">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
              <path d="M19,6.41L17.59,5L12,10.59L6.41,5L5,6.41L10.59,12L5,17.59L6.41,19L12,13.41L17.59,19L19,17.59L13.41,12L19,6.41Z"/>
            </svg>
          </button>
        </div>
      </div>
      ${summaryContentHtml}
      ${amazonLinksHtml}
      ${footerHtml}
    `;

    // Add close functionality
    summaryBox
      .querySelector("#tubeboost-summary-close")
      .addEventListener("click", () => {
        this.removeSummaryElements();
      });

    // Add save functionality if logged in
    if (isLoggedIn && summaryText) {
      summaryBox
        .querySelector("#tubeboost-summary-save")
        .addEventListener("click", () => {
          this.saveSummary();
        });
    }

    document.body.appendChild(summaryBox);
  }

  truncateUrl(url) {
    // Extract meaningful part of the URL for display
    try {
      const urlObj = new URL(url);
      const path = urlObj.pathname;

      // For amzn.to links, show the full short URL
      if (urlObj.hostname === "amzn.to") {
        return url.replace(/^https?:\/\//, "");
      }

      // For full Amazon URLs, try to extract product info
      const dpMatch = path.match(/\/dp\/([A-Z0-9]+)/i);
      if (dpMatch) {
        return `amazon.../${dpMatch[1]}`;
      }

      const gpMatch = path.match(/\/gp\/product\/([A-Z0-9]+)/i);
      if (gpMatch) {
        return `amazon.../${gpMatch[1]}`;
      }

      // Fallback: truncate to reasonable length
      const displayUrl = url.replace(/^https?:\/\/(www\.)?/, "");
      return displayUrl.length > 40 ? displayUrl.substring(0, 37) + "..." : displayUrl;
    } catch {
      return url.length > 40 ? url.substring(0, 37) + "..." : url;
    }
  }

  async saveSummary() {
    const saveBtn = document.getElementById("tubeboost-summary-save");
    if (!saveBtn) return;

    saveBtn.disabled = true;
    saveBtn.innerHTML = `
      <div class="save-spinner"></div>
      Saving...
    `;

    try {
      const videoTitle = document.querySelector("h1.ytd-video-primary-info-renderer, h1.title")?.textContent?.trim() || "Unknown Title";
      const videoUrl = window.location.href;
      const videoId = this.currentVideoId;

      const response = await chrome.runtime.sendMessage({
        action: "saveSummary",
        data: {
          videoId,
          videoTitle,
          summaryText: this.currentSummaryText,
          videoUrl,
          amazonLinks: this.currentAmazonLinks || [],
        },
      });

      if (response.success) {
        saveBtn.innerHTML = `
          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
            <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/>
          </svg>
          Saved!
        `;
        saveBtn.classList.add("saved");
      } else {
        saveBtn.innerHTML = `Error`;
        saveBtn.disabled = false;
        setTimeout(() => {
          saveBtn.innerHTML = `
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
              <path d="M17 3H5c-1.11 0-2 .9-2 2v14c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V7l-4-4zm-5 16c-1.66 0-3-1.34-3-3s1.34-3 3-3 3 1.34 3 3-1.34 3-3 3zm3-10H5V5h10v4z"/>
            </svg>
            Save
          `;
        }, 2000);
        console.error("Save error:", response.error);
      }
    } catch (error) {
      console.error("Error saving summary:", error);
      saveBtn.innerHTML = `Error`;
      saveBtn.disabled = false;
    }
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
