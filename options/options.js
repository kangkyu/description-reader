// Options Page JavaScript for YouTube Description Summarizer

class SummarizerOptions {
  constructor() {
    this.init();
  }

  async init() {
    await this.loadSettings();
    this.setupEventListeners();
    this.updateUI();
  }

  async loadSettings() {
    try {
      const result = await chrome.storage.sync.get([
        "geminiApiKey",
        "youtubeApiKey",
      ]);
      this.apiKey = result.geminiApiKey || "";
      this.youtubeApiKey = result.youtubeApiKey || "";
    } catch (error) {
      console.error("Error loading settings:", error);
      this.apiKey = "";
      this.youtubeApiKey = "";
    }
  }

  setupEventListeners() {
    // API Key management
    document
      .getElementById("saveApiKey")
      .addEventListener("click", () => this.saveApiKey());

    document
      .getElementById("testApiKey")
      .addEventListener("click", () => this.testApiKey());

    document
      .getElementById("clearApiKey")
      .addEventListener("click", () => this.clearApiKey());

    document
      .getElementById("toggleApiKey")
      .addEventListener("click", () => this.toggleApiKeyVisibility());

    // YouTube API Key management
    document
      .getElementById("saveYouTubeApiKey")
      .addEventListener("click", () => this.saveYouTubeApiKey());

    document
      .getElementById("testYouTubeApiKey")
      .addEventListener("click", () => this.testYouTubeApiKey());

    document
      .getElementById("clearYouTubeApiKey")
      .addEventListener("click", () => this.clearYouTubeApiKey());

    document
      .getElementById("toggleYouTubeApiKey")
      .addEventListener("click", () => this.toggleYouTubeApiKeyVisibility());

    // Import/Export
    document
      .getElementById("exportSettings")
      .addEventListener("click", () => this.exportSettings());

    document
      .getElementById("importSettings")
      .addEventListener("click", () => this.importSettings());

    document
      .getElementById("importFileInput")
      .addEventListener("change", (e) => this.handleFileImport(e));

    // Enter key support
    document.getElementById("apiKey").addEventListener("keypress", (e) => {
      if (e.key === "Enter") {
        this.saveApiKey();
      }
    });
  }

  updateUI() {
    const apiKeyInput = document.getElementById("apiKey");
    const youtubeApiKeyInput = document.getElementById("youtubeApiKey");

    apiKeyInput.value = this.apiKey;
    youtubeApiKeyInput.value = this.youtubeApiKey;

    // Update Gemini API status
    if (this.apiKey) {
      this.showStatus("Gemini API key configured ✓", "success");
    } else {
      this.showStatus(
        "Please configure your Gemini API key to start using the extension.",
        "info",
      );
    }

    // Update YouTube API status
    if (this.youtubeApiKey) {
      this.showYouTubeStatus("YouTube API key configured ✓", "success");
    } else {
      this.showYouTubeStatus(
        "Please configure your YouTube API key for reliable description fetching.",
        "info",
      );
    }
  }

  async saveApiKey() {
    const apiKeyInput = document.getElementById("apiKey");
    const apiKey = apiKeyInput.value.trim();

    if (!apiKey) {
      this.showStatus("Please enter an API key.", "error");
      return;
    }

    // Basic validation
    if (apiKey.length < 20) {
      this.showStatus("API key appears to be too short.", "error");
      return;
    }

    const saveButton = document.getElementById("saveApiKey");
    this.setButtonLoading(saveButton, true);

    try {
      // Save to storage - preserve existing YouTube API key
      const currentData = await chrome.storage.sync.get(["youtubeApiKey"]);
      await chrome.storage.sync.set({
        geminiApiKey: apiKey,
        youtubeApiKey: currentData.youtubeApiKey || this.youtubeApiKey,
      });
      this.apiKey = apiKey;

      // Notify background script of the new API key
      chrome.runtime.sendMessage({
        action: "setApiKey",
        apiKey: apiKey,
      });

      this.showStatus("API key saved successfully! ✓", "success");
      this.showNotification("API key saved successfully!", "success");
    } catch (error) {
      console.error("Error saving API key:", error);
      this.showStatus("Failed to save API key.", "error");
      this.showNotification("Failed to save API key.", "error");
    } finally {
      this.setButtonLoading(saveButton, false);
    }
  }

  async testApiKey() {
    const apiKeyInput = document.getElementById("apiKey");
    const apiKey = apiKeyInput.value.trim();

    if (!apiKey) {
      this.showStatus("Please enter an API key to test.", "error");
      return;
    }

    const testButton = document.getElementById("testApiKey");
    this.setButtonLoading(testButton, true);

    try {
      // Test the API key with a simple request
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
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
                    text: "Hello, this is a test message. Please respond with 'API key working'.",
                  },
                ],
              },
            ],
            generationConfig: {
              maxOutputTokens: 20,
            },
          }),
        },
      );

      if (response.ok) {
        const data = await response.json();
        if (data.candidates && data.candidates[0]) {
          this.showStatus("✅ API key is working correctly!", "success");
          this.showNotification("API key test successful!", "success");
        } else {
          this.showStatus("❌ Unexpected response from API.", "error");
        }
      } else {
        let errorMessage = "❌ API key test failed.";
        if (response.status === 400) {
          errorMessage += " Invalid request or API key format.";
        } else if (response.status === 403) {
          errorMessage += " API key invalid or access denied.";
        } else if (response.status === 429) {
          errorMessage += " Rate limit exceeded.";
        } else {
          errorMessage += ` Status: ${response.status}`;
        }
        this.showStatus(errorMessage, "error");
      }
    } catch (error) {
      console.error("Error testing API key:", error);
      this.showStatus("❌ Network error during API test.", "error");
    } finally {
      this.setButtonLoading(testButton, false);
    }
  }

  async clearApiKey() {
    if (
      !confirm(
        "Are you sure you want to clear your API key? You'll need to reconfigure it to use the extension.",
      )
    ) {
      return;
    }

    try {
      await chrome.storage.sync.remove("geminiApiKey");
      this.apiKey = "";
      document.getElementById("apiKey").value = "";
      this.showStatus(
        "API key cleared. Please configure a new one to use the extension.",
        "info",
      );
      this.showNotification("API key cleared successfully.", "info");
    } catch (error) {
      console.error("Error clearing API key:", error);
      this.showStatus("Failed to clear API key.", "error");
    }
  }

  toggleApiKeyVisibility() {
    const apiKeyInput = document.getElementById("apiKey");
    const toggleButton = document.getElementById("toggleApiKey");

    if (apiKeyInput.type === "password") {
      apiKeyInput.type = "text";
      toggleButton.textContent = "🙈";
    } else {
      apiKeyInput.type = "password";
      toggleButton.textContent = "👁️";
    }
  }

  async exportSettings() {
    try {
      const settings = await chrome.storage.sync.get(null);
      const dataStr = JSON.stringify(settings, null, 2);
      const dataUri =
        "data:application/json;charset=utf-8," + encodeURIComponent(dataStr);

      const exportFileDefaultName = `youtube-summarizer-settings-${new Date().toISOString().split("T")[0]}.json`;

      const linkElement = document.createElement("a");
      linkElement.setAttribute("href", dataUri);
      linkElement.setAttribute("download", exportFileDefaultName);
      linkElement.click();

      this.showNotification("Settings exported successfully!", "success");
    } catch (error) {
      console.error("Error exporting settings:", error);
      this.showNotification("Failed to export settings.", "error");
    }
  }

  importSettings() {
    document.getElementById("importFileInput").click();
  }

  async handleFileImport(event) {
    const file = event.target.files[0];
    if (!file) return;

    try {
      const text = await file.text();
      const settings = JSON.parse(text);

      // Validate the settings
      if (typeof settings !== "object" || settings === null) {
        throw new Error("Invalid settings file format");
      }

      // Import settings
      await chrome.storage.sync.set(settings);
      await this.loadSettings();
      this.updateUI();

      this.showNotification("Settings imported successfully!", "success");
    } catch (error) {
      console.error("Error importing settings:", error);
      this.showNotification(
        "Failed to import settings. Invalid file.",
        "error",
      );
    }

    // Clear the file input
    event.target.value = "";
  }

  showStatus(message, type) {
    const statusElement = document.getElementById("apiStatus");
    statusElement.textContent = message;
    statusElement.className = `status-message ${type}`;
  }

  showNotification(message, type) {
    const notification = document.getElementById("notification");
    notification.textContent = message;
    notification.className = `notification ${type}`;
    notification.classList.add("show");

    setTimeout(() => {
      notification.classList.remove("show");
    }, 3000);
  }

  async saveYouTubeApiKey() {
    const youtubeApiKeyInput = document.getElementById("youtubeApiKey");
    const apiKey = youtubeApiKeyInput.value.trim();

    if (!apiKey) {
      this.showYouTubeStatus("Please enter a YouTube API key.", "error");
      return;
    }

    if (apiKey.length < 20) {
      this.showYouTubeStatus(
        "YouTube API key appears to be too short.",
        "error",
      );
      return;
    }

    const saveButton = document.getElementById("saveYouTubeApiKey");
    this.setButtonLoading(saveButton, true);

    try {
      // Save to storage - preserve existing Gemini API key
      const currentData = await chrome.storage.sync.get(["geminiApiKey"]);
      await chrome.storage.sync.set({
        youtubeApiKey: apiKey,
        geminiApiKey: currentData.geminiApiKey || this.apiKey,
      });
      this.youtubeApiKey = apiKey;

      // Notify background script of the new API key
      chrome.runtime.sendMessage({
        action: "setYouTubeApiKey",
        apiKey: apiKey,
      });

      this.showYouTubeStatus(
        "YouTube API key saved successfully! ✓",
        "success",
      );
      this.showNotification("YouTube API key saved successfully!", "success");
    } catch (error) {
      console.error("Error saving YouTube API key:", error);
      this.showYouTubeStatus("Failed to save YouTube API key.", "error");
      this.showNotification("Failed to save YouTube API key.", "error");
    } finally {
      this.setButtonLoading(saveButton, false);
    }
  }

  async testYouTubeApiKey() {
    const youtubeApiKeyInput = document.getElementById("youtubeApiKey");
    const apiKey = youtubeApiKeyInput.value.trim();

    if (!apiKey) {
      this.showYouTubeStatus(
        "Please enter a YouTube API key to test.",
        "error",
      );
      return;
    }

    const testButton = document.getElementById("testYouTubeApiKey");
    this.setButtonLoading(testButton, true);

    try {
      // Test with a well-known YouTube video ID
      const response = await fetch(
        `https://www.googleapis.com/youtube/v3/videos?id=dQw4w9WgXcQ&part=snippet&key=${apiKey}`,
      );

      if (response.ok) {
        const data = await response.json();
        if (data.items && data.items.length > 0) {
          this.showYouTubeStatus(
            "✅ YouTube API key is working correctly!",
            "success",
          );
          this.showNotification("YouTube API key test successful!", "success");
        } else {
          this.showYouTubeStatus(
            "❌ API responded but no video data found.",
            "error",
          );
        }
      } else {
        let errorMessage = "❌ YouTube API key test failed.";
        if (response.status === 400) {
          errorMessage += " Invalid request or API key format.";
        } else if (response.status === 403) {
          errorMessage +=
            " API key invalid, quota exceeded, or YouTube Data API not enabled.";
        } else if (response.status === 429) {
          errorMessage += " Rate limit exceeded.";
        } else {
          errorMessage += ` Status: ${response.status}`;
        }
        this.showYouTubeStatus(errorMessage, "error");
      }
    } catch (error) {
      console.error("Error testing YouTube API key:", error);
      this.showYouTubeStatus("❌ Network error during API test.", "error");
    } finally {
      this.setButtonLoading(testButton, false);
    }
  }

  async clearYouTubeApiKey() {
    if (!confirm("Are you sure you want to clear your YouTube API key?")) {
      return;
    }

    try {
      await chrome.storage.sync.remove("youtubeApiKey");
      this.youtubeApiKey = "";
      document.getElementById("youtubeApiKey").value = "";
      this.showYouTubeStatus("YouTube API key cleared.", "info");
      this.showNotification("YouTube API key cleared successfully.", "info");
    } catch (error) {
      console.error("Error clearing YouTube API key:", error);
      this.showYouTubeStatus("Failed to clear YouTube API key.", "error");
    }
  }

  toggleYouTubeApiKeyVisibility() {
    const youtubeApiKeyInput = document.getElementById("youtubeApiKey");
    const toggleButton = document.getElementById("toggleYouTubeApiKey");

    if (youtubeApiKeyInput.type === "password") {
      youtubeApiKeyInput.type = "text";
      toggleButton.textContent = "🙈";
    } else {
      youtubeApiKeyInput.type = "password";
      toggleButton.textContent = "👁️";
    }
  }

  showYouTubeStatus(message, type) {
    const statusElement = document.getElementById("youtubeApiStatus");
    statusElement.textContent = message;
    statusElement.className = `status-message ${type}`;
  }

  setButtonLoading(button, loading) {
    if (loading) {
      button.disabled = true;
      button.classList.add("loading");
      button.dataset.originalText = button.textContent;
      button.textContent = "Loading...";
    } else {
      button.disabled = false;
      button.classList.remove("loading");
      button.textContent = button.dataset.originalText || button.textContent;
    }
  }
}

// Initialize options page when DOM is loaded
document.addEventListener("DOMContentLoaded", () => {
  new SummarizerOptions();
});
