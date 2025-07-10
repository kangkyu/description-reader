// Popup JavaScript for TubeBoost Chrome Extension

class TubeBoostPopup {
  constructor() {
    this.currentTab = null;
    this.isYouTube = false;
    this.videoData = null;
    this.init();
  }

  async init() {
    await this.checkCurrentTab();
    this.setupEventListeners();
    this.updateUI();
  }

  async checkCurrentTab() {
    try {
      const [tab] = await chrome.tabs.query({
        active: true,
        currentWindow: true,
      });
      this.currentTab = tab;
      this.isYouTube = tab.url && tab.url.includes("youtube.com");

      if (this.isYouTube && tab.url.includes("/watch")) {
        await this.getVideoData();
      }
    } catch (error) {
      console.error("Error checking current tab:", error);
    }
  }

  async getVideoData() {
    try {
      const results = await chrome.scripting.executeScript({
        target: { tabId: this.currentTab.id },
        function: this.extractVideoData,
      });

      if (results && results[0] && results[0].result) {
        this.videoData = results[0].result;
      }
    } catch (error) {
      console.error("Error getting video data:", error);
    }
  }

  // This function runs in the context of the YouTube page
  extractVideoData() {
    try {
      const videoTitle =
        document.querySelector("h1.ytd-watch-metadata yt-formatted-string")
          ?.textContent ||
        document.querySelector("#container h1")?.textContent ||
        "Unknown Title";

      const viewsElement =
        document.querySelector("#info-container #count .view-count") ||
        document.querySelector(".view-count") ||
        document.querySelector('[class*="view"]');

      const likesElement = document.querySelector(
        '[aria-label*="like this video along with"]:not([aria-label*="dislike"]), [aria-label*="likes"]',
      );

      const commentsElement = document.querySelector("#count .count-text");

      // Extract numbers from text
      const extractNumber = (text) => {
        if (!text) return 0;
        const cleaned = text.replace(/[^\d.,]/g, "");
        if (cleaned.includes("K")) return parseFloat(cleaned) * 1000;
        if (cleaned.includes("M")) return parseFloat(cleaned) * 1000000;
        if (cleaned.includes("B")) return parseFloat(cleaned) * 1000000000;
        return parseInt(cleaned.replace(/,/g, "")) || 0;
      };

      const views = extractNumber(viewsElement?.textContent || "0");
      const likes = extractNumber(
        likesElement?.getAttribute("aria-label") || "0",
      );
      const comments = extractNumber(commentsElement?.textContent || "0");

      // Calculate engagement rate
      const engagementRate = views > 0 ? ((likes + comments) / views) * 100 : 0;

      // Get video description for SEO analysis
      const description =
        document.querySelector("#description-text")?.textContent || "";
      const tags = Array.from(
        document.querySelectorAll("meta[property='og:video:tag']"),
      ).map((meta) => meta.content);

      return {
        title: videoTitle,
        views: views,
        likes: likes,
        comments: comments,
        engagementRate: engagementRate.toFixed(2),
        description: description,
        tags: tags,
        url: window.location.href,
      };
    } catch (error) {
      console.error("Error extracting video data:", error);
      return null;
    }
  }

  setupEventListeners() {
    // Quick action buttons
    document.getElementById("optimizeBtn")?.addEventListener("click", () => {
      this.openOptimizationTool();
    });

    document.getElementById("keywordBtn")?.addEventListener("click", () => {
      this.openKeywordTool();
    });

    document.getElementById("tagsBtn")?.addEventListener("click", () => {
      this.openTagGenerator();
    });

    document.getElementById("analyticsBtn")?.addEventListener("click", () => {
      this.openAnalytics();
    });

    // Tool items
    document.getElementById("thumbnailTool")?.addEventListener("click", () => {
      this.openThumbnailTool();
    });

    document.getElementById("bulkTool")?.addEventListener("click", () => {
      this.openBulkEditor();
    });

    document.getElementById("competitorTool")?.addEventListener("click", () => {
      this.openCompetitorAnalysis();
    });

    // Footer buttons
    document.getElementById("settingsBtn")?.addEventListener("click", () => {
      chrome.runtime.openOptionsPage();
    });

    document.getElementById("helpBtn")?.addEventListener("click", () => {
      chrome.tabs.create({ url: "https://tubeBoost.help" });
    });
  }

  updateUI() {
    const statusIndicator = document.getElementById("statusIndicator");
    const statusText = document.getElementById("statusText");
    const statsSection = document.getElementById("statsSection");
    const seoSection = document.getElementById("seoSection");

    if (this.isYouTube) {
      statusIndicator.classList.remove("inactive");
      statusText.textContent = "YouTube Detected";

      if (this.videoData) {
        this.showVideoStats();
        this.showSEOAnalysis();
        statsSection.style.display = "block";
        seoSection.style.display = "block";
      } else {
        statusText.textContent = "Browse to a video";
        statsSection.style.display = "none";
        seoSection.style.display = "none";
      }
    } else {
      statusIndicator.classList.add("inactive");
      statusText.textContent = "Not on YouTube";
      statsSection.style.display = "none";
      seoSection.style.display = "none";
    }
  }

  showVideoStats() {
    if (!this.videoData) return;

    const formatNumber = (num) => {
      if (num >= 1000000) return (num / 1000000).toFixed(1) + "M";
      if (num >= 1000) return (num / 1000).toFixed(1) + "K";
      return num.toString();
    };

    document.getElementById("viewCount").textContent = formatNumber(
      this.videoData.views,
    );
    document.getElementById("likeCount").textContent = formatNumber(
      this.videoData.likes,
    );
    document.getElementById("commentCount").textContent = formatNumber(
      this.videoData.comments,
    );
    document.getElementById("engagementRate").textContent =
      this.videoData.engagementRate + "%";
  }

  showSEOAnalysis() {
    if (!this.videoData) return;

    // Simple SEO scoring
    let totalScore = 0;
    const titleScore = this.analyzeTitleSEO(this.videoData.title);
    const descScore = this.analyzeDescriptionSEO(this.videoData.description);
    const tagsScore = this.analyzeTagsSEO(this.videoData.tags);

    totalScore = Math.round((titleScore + descScore + tagsScore) / 3);

    // Update SEO score circle
    const scoreCircle = document.querySelector(".score-circle");
    const scoreAngle = (totalScore / 100) * 360;
    scoreCircle.style.setProperty("--score-angle", scoreAngle + "deg");
    document.getElementById("seoScore").textContent = totalScore;

    // Update individual scores
    this.updateScoreIndicator("titleScore", titleScore);
    this.updateScoreIndicator("descScore", descScore);
    this.updateScoreIndicator("tagsScore", tagsScore);
  }

  analyzeTitleSEO(title) {
    if (!title) return 0;
    let score = 50; // Base score

    // Length check (optimal: 60-70 characters)
    if (title.length >= 40 && title.length <= 70) score += 20;
    else if (title.length > 70) score -= 10;

    // Contains numbers (often perform well)
    if (/\d/.test(title)) score += 10;

    // Contains emotional words
    const emotionalWords = [
      "amazing",
      "incredible",
      "shocking",
      "must-see",
      "ultimate",
      "best",
      "worst",
      "secret",
    ];
    if (emotionalWords.some((word) => title.toLowerCase().includes(word)))
      score += 10;

    // Avoid excessive caps
    if (title === title.toUpperCase()) score -= 15;

    return Math.min(100, Math.max(0, score));
  }

  analyzeDescriptionSEO(description) {
    if (!description) return 20;
    let score = 30; // Base score

    // Length check
    if (description.length >= 200) score += 25;
    if (description.length >= 500) score += 15;

    // Contains links
    if (description.includes("http")) score += 10;

    // Contains hashtags
    if (description.includes("#")) score += 10;

    // Contains call-to-action words
    const ctaWords = ["subscribe", "like", "comment", "share", "follow"];
    if (ctaWords.some((word) => description.toLowerCase().includes(word)))
      score += 10;

    return Math.min(100, Math.max(0, score));
  }

  analyzeTagsSEO(tags) {
    if (!tags || tags.length === 0) return 30;
    let score = 40; // Base score

    // Number of tags
    if (tags.length >= 5) score += 20;
    if (tags.length >= 10) score += 20;
    if (tags.length > 15) score -= 10; // Too many tags

    // Tag variety
    const avgLength =
      tags.reduce((sum, tag) => sum + tag.length, 0) / tags.length;
    if (avgLength >= 8 && avgLength <= 20) score += 20;

    return Math.min(100, Math.max(0, score));
  }

  updateScoreIndicator(elementId, score) {
    const indicator = document.getElementById(elementId);
    indicator.classList.remove("good", "fair", "poor");

    if (score >= 80) indicator.classList.add("good");
    else if (score >= 60) indicator.classList.add("fair");
    else indicator.classList.add("poor");
  }

  // Tool opening methods
  openOptimizationTool() {
    this.injectTool("optimization");
  }

  openKeywordTool() {
    this.injectTool("keywords");
  }

  openTagGenerator() {
    this.injectTool("tags");
  }

  openAnalytics() {
    this.injectTool("analytics");
  }

  openThumbnailTool() {
    this.injectTool("thumbnail");
  }

  openBulkEditor() {
    this.injectTool("bulk");
  }

  openCompetitorAnalysis() {
    this.injectTool("competitor");
  }

  async injectTool(toolType) {
    if (!this.isYouTube) {
      alert("Please navigate to YouTube first!");
      return;
    }

    try {
      await chrome.scripting.executeScript({
        target: { tabId: this.currentTab.id },
        function: (toolType) => {
          // Send message to content script to show tool
          window.postMessage(
            { type: "TUBEBOOST_SHOW_TOOL", toolType: toolType },
            "*",
          );
        },
        args: [toolType],
      });

      // Close popup after opening tool
      window.close();
    } catch (error) {
      console.error("Error injecting tool:", error);
    }
  }
}

// Initialize popup when DOM is loaded
document.addEventListener("DOMContentLoaded", () => {
  new TubeBoostPopup();
});
