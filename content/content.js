// Content Script for Amazon Link Finder

const API_BASE_URL = "https://descriptionreader.com";
// const API_BASE_URL = "http://localhost:3000";

class AmazonLinkFinder {
  constructor() {
    this.currentVideoId = null;
    this.currentAmazonLinks = [];
    this.init();
  }

  init() {
    console.log("Amazon Link Finder: Content script loaded");
    this.injectStyles();
    this.observePageChanges();
  }

  injectStyles() {
    if (document.getElementById("amazon-link-styles")) return;

    const style = document.createElement("link");
    style.id = "amazon-link-styles";
    style.rel = "stylesheet";
    style.href = chrome.runtime.getURL("content/content.css");
    document.head.appendChild(style);
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
    // Clear previous video's data immediately
    this.currentAmazonLinks = [];
    this.removeOverlay();

    const newVideoId = this.extractVideoId();
    if (!newVideoId) return;

    this.currentVideoId = newVideoId;
    this.waitForDescriptionAndShow(newVideoId);
  }

  waitForDescriptionAndShow(videoId, attempts = 0) {
    const maxAttempts = 5;
    const delay = 1000;

    // Check if we've navigated away
    if (this.currentVideoId !== videoId) return;

    const description = this.extractDescriptionForVideo(videoId);

    if (description) {
      const amazonLinks = this.extractAmazonLinks(description);
      console.log("Amazon Link Finder: Found", amazonLinks.length, "links for video", videoId);
      this.showOverlay(amazonLinks);
    } else if (attempts < maxAttempts) {
      setTimeout(() => this.waitForDescriptionAndShow(videoId, attempts + 1), delay);
    } else {
      console.log("Amazon Link Finder: Could not get description after", maxAttempts, "attempts");
      this.showOverlay([]);
    }
  }

  extractVideoId() {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get("v");
  }

  extractDescriptionForVideo(videoId) {
    // Parse ytInitialPlayerResponse from script tags
    const scripts = document.querySelectorAll("script");
    for (const script of scripts) {
      const text = script.textContent;
      if (text && text.includes("ytInitialPlayerResponse")) {
        const match = text.match(/ytInitialPlayerResponse\s*=\s*(\{.+?\});/s);
        if (match) {
          try {
            const data = JSON.parse(match[1]);
            const responseVideoId = data?.videoDetails?.videoId;
            // Only use if video ID matches
            if (responseVideoId === videoId) {
              const desc = data?.videoDetails?.shortDescription;
              if (desc) return desc;
            }
          } catch (e) {
            console.log("Failed to parse ytInitialPlayerResponse", e);
          }
        }
      }
    }

    // Fallback to DOM scraping
    return this.extractDescriptionFromDOM();
  }

  extractDescriptionFromDOM() {
    const selectors = [
      "ytd-text-inline-expander #plain-snippet-text",
      "ytd-text-inline-expander #snippet-text",
      "#description ytd-text-inline-expander .content",
      "#description .content.style-scope.ytd-expandable-video-description-body-renderer",
      "ytd-expandable-video-description-body-renderer .content",
      "#description-inline-expander .content",
      "#description .content",
      "#description-text",
      ".content.style-scope.ytd-expandable-video-description-body-renderer",
    ];

    for (const selector of selectors) {
      const element = document.querySelector(selector);
      if (element) {
        let text = element.innerText || element.textContent || "";
        if (!text.trim()) continue;

        text = text.trim().replace(/\s+/g, " ");
        text = text.replace(/Show more/gi, "");
        text = text.replace(/Show less/gi, "");

        if (text.length > 10) {
          return text;
        }
      }
    }

    return null;
  }

  extractAmazonLinks(description) {
    if (!description) return [];

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
          const cleanedLink = link.replace(/[.,;:!?)]+$/, "");
          links.add(cleanedLink);
        });
      }
    }

    return Array.from(links);
  }

  async showOverlay(amazonLinks = []) {
    this.removeOverlay();
    this.currentAmazonLinks = amazonLinks;

    // Get auth status for save button
    const webPageUrl = `${API_BASE_URL}/videos`;
    let isLoggedIn = false;
    try {
      const authStatus = await chrome.runtime.sendMessage({ action: "getAuthStatus" });
      isLoggedIn = authStatus.isLoggedIn;
    } catch (e) {
      console.log("Could not get auth status:", e);
    }

    const overlay = document.createElement("div");
    overlay.id = "amazon-link-overlay";
    overlay.className = "tubeboost-top-right-summary";

    // Save button (only show if logged in and has links)
    const saveButtonHtml = (isLoggedIn && amazonLinks.length > 0)
      ? `<button class="save-btn" id="amazon-save-btn">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
            <path d="M17 3H5c-1.11 0-2 .9-2 2v14c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V7l-4-4zm-5 16c-1.66 0-3-1.34-3-3s1.34-3 3-3 3 1.34 3 3-1.34 3-3 3zm3-10H5V5h10v4z"/>
          </svg>
          Save
        </button>`
      : '';

    const linksHtml = amazonLinks.length > 0
      ? `<div class="amazon-links-list">
          ${amazonLinks.map((link, index) => `
            <a href="${link}" target="_blank" rel="noopener noreferrer" class="amazon-link">
              <span class="amazon-link-number">${index + 1}</span>
              <span class="amazon-link-url">${this.truncateUrl(link)}</span>
              <svg class="amazon-link-icon" width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                <path d="M14,3V5H17.59L7.76,14.83L9.17,16.24L19,6.41V10H21V3M19,19H5V5H12V3H5C3.89,3 3,3.9 3,5V19A2,2 0 0,0 5,21H19A2,2 0 0,0 21,19V12H19V19Z"/>
              </svg>
            </a>
          `).join("")}
        </div>`
      : `<div class="amazon-links-empty">
          For amazon links of this video, reload the page
        </div>`;

    overlay.innerHTML = `
      <div class="summary-header">
        <div class="summary-title">
          🛒 Amazon Links${amazonLinks.length > 0 ? ` (${amazonLinks.length})` : ''}
        </div>
        <div class="header-actions">
          ${saveButtonHtml}
          <button class="summary-close" id="amazon-link-close">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
              <path d="M19,6.41L17.59,5L12,10.59L6.41,5L5,6.41L10.59,12L5,17.59L6.41,19L12,13.41L17.59,19L19,17.59L13.41,12L19,6.41Z"/>
            </svg>
          </button>
        </div>
      </div>
      ${linksHtml}
      <div class="overlay-footer">
        <button class="view-all-link" id="view-all-btn">
          View all saved videos →
        </button>
      </div>
    `;

    overlay.querySelector("#amazon-link-close").addEventListener("click", () => {
      this.removeOverlay();
    });

    // Add save button handler
    const saveBtn = overlay.querySelector("#amazon-save-btn");
    if (saveBtn) {
      saveBtn.addEventListener("click", () => this.saveVideo());
    }

    // Add view all button handler
    const viewAllBtn = overlay.querySelector("#view-all-btn");
    if (viewAllBtn) {
      viewAllBtn.addEventListener("click", async () => {
        await chrome.runtime.sendMessage({ action: "openVideosPage" });
      });
    }

    document.body.appendChild(overlay);
  }

  async saveVideo() {
    const saveBtn = document.getElementById("amazon-save-btn");
    if (!saveBtn) return;

    saveBtn.disabled = true;
    saveBtn.innerHTML = `<span class="saving-spinner"></span> Saving...`;

    try {
      const videoTitle = document.querySelector("h1.ytd-watch-metadata yt-formatted-string, h1.ytd-video-primary-info-renderer, h1.title, #title h1")?.textContent?.trim() || "Untitled";
      const videoUrl = window.location.href;
      const videoId = this.currentVideoId;
      const description = this.extractDescriptionForVideo(videoId) || "";

      // Generate summary using Gemini
      let summaryText = "";
      if (description) {
        const summaryResponse = await chrome.runtime.sendMessage({
          action: "generateSummary",
          description: description,
        });
        if (summaryResponse.success) {
          summaryText = summaryResponse.summary;
        }
      }

      const response = await chrome.runtime.sendMessage({
        action: "saveSummary",
        data: {
          videoId,
          videoTitle,
          summaryText,
          videoUrl,
          amazonLinks: this.currentAmazonLinks || [],
        },
      });

      if (response.success) {
        saveBtn.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
          <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/>
        </svg> Saved!`;
        saveBtn.classList.add("saved");
      } else {
        saveBtn.innerHTML = `Error`;
        saveBtn.disabled = false;
        console.error("Save error:", response.error);
      }
    } catch (error) {
      console.error("Error saving:", error);
      saveBtn.innerHTML = `Error`;
      saveBtn.disabled = false;
    }
  }

  truncateUrl(url) {
    try {
      const urlObj = new URL(url);
      const path = urlObj.pathname;

      if (urlObj.hostname === "amzn.to") {
        return url.replace(/^https?:\/\//, "");
      }

      const dpMatch = path.match(/\/dp\/([A-Z0-9]+)/i);
      if (dpMatch) {
        return `amazon.../${dpMatch[1]}`;
      }

      const gpMatch = path.match(/\/gp\/product\/([A-Z0-9]+)/i);
      if (gpMatch) {
        return `amazon.../${gpMatch[1]}`;
      }

      const displayUrl = url.replace(/^https?:\/\/(www\.)?/, "");
      return displayUrl.length > 40 ? displayUrl.substring(0, 37) + "..." : displayUrl;
    } catch {
      return url.length > 40 ? url.substring(0, 37) + "..." : url;
    }
  }

  removeOverlay() {
    const overlay = document.getElementById("amazon-link-overlay");
    if (overlay) overlay.remove();
  }
}

// Initialize when the script loads
if (window.location.hostname.includes("youtube.com")) {
  new AmazonLinkFinder();
}
