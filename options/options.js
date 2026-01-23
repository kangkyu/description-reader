// Options Page JavaScript for YouTube Description Summarizer

const API_BASE_URL = CONFIG.API_BASE_URL;

class SummarizerOptions {
  constructor() {
    this.init();
  }

  async init() {
    await this.loadSettings();
    this.setupEventListeners();
    this.updateUI();
    this.updateAuthUI();
  }

  async loadSettings() {
    try {
      const result = await chrome.storage.sync.get(["geminiApiKey", "authToken", "userEmail"]);
      this.apiKey = result.geminiApiKey || "";
      this.authToken = result.authToken || "";
      this.userEmail = result.userEmail || "";
    } catch (error) {
      console.error("Error loading settings:", error);
      this.apiKey = "";
      this.authToken = "";
      this.userEmail = "";
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

    // Auth tabs
    document.querySelectorAll(".auth-tab").forEach((tab) => {
      tab.addEventListener("click", (e) => this.switchAuthTab(e.target.dataset.tab));
    });

    // Auth forms
    document.getElementById("loginBtn").addEventListener("click", () => this.login());
    document.getElementById("registerBtn").addEventListener("click", () => this.register());
    document.getElementById("logoutBtn").addEventListener("click", () => this.logout());

    // Enter key support for auth forms
    document.getElementById("loginPassword").addEventListener("keypress", (e) => {
      if (e.key === "Enter") this.login();
    });
    document.getElementById("registerPasswordConfirm").addEventListener("keypress", (e) => {
      if (e.key === "Enter") this.register();
    });
  }

  switchAuthTab(tab) {
    document.querySelectorAll(".auth-tab").forEach((t) => t.classList.remove("active"));
    document.querySelector(`[data-tab="${tab}"]`).classList.add("active");

    document.getElementById("loginForm").style.display = tab === "login" ? "block" : "none";
    document.getElementById("registerForm").style.display = tab === "register" ? "block" : "none";
  }

  updateAuthUI() {
    const authForms = document.getElementById("authForms");
    const loggedInState = document.getElementById("loggedInState");
    const userEmailEl = document.getElementById("userEmail");

    if (this.authToken && this.userEmail) {
      authForms.style.display = "none";
      loggedInState.style.display = "block";
      userEmailEl.textContent = this.userEmail;
    } else {
      authForms.style.display = "block";
      loggedInState.style.display = "none";
    }
  }

  async login() {
    const email = document.getElementById("loginEmail").value.trim();
    const password = document.getElementById("loginPassword").value;

    if (!email || !password) {
      this.showAuthStatus("Please enter email and password.", "error");
      return;
    }

    const loginBtn = document.getElementById("loginBtn");
    this.setButtonLoading(loginBtn, true);

    try {
      const response = await fetch(`${API_BASE_URL}/session`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email_address: email, password }),
      });

      const data = await response.json();

      if (response.ok) {
        await chrome.storage.sync.set({ authToken: data.token, userEmail: data.email });
        this.authToken = data.token;
        this.userEmail = data.email;
        this.updateAuthUI();
        this.showNotification("Logged in successfully!", "success");
        document.getElementById("loginEmail").value = "";
        document.getElementById("loginPassword").value = "";
      } else {
        this.showAuthStatus(data.error || "Login failed.", "error");
      }
    } catch (error) {
      console.error("Login error:", error);
      this.showAuthStatus("Network error. Is the server running?", "error");
    } finally {
      this.setButtonLoading(loginBtn, false);
    }
  }

  async register() {
    const email = document.getElementById("registerEmail").value.trim();
    const password = document.getElementById("registerPassword").value;
    const passwordConfirm = document.getElementById("registerPasswordConfirm").value;

    if (!email || !password) {
      this.showAuthStatus("Please enter email and password.", "error");
      return;
    }

    if (password !== passwordConfirm) {
      this.showAuthStatus("Passwords do not match.", "error");
      return;
    }

    if (password.length < 6) {
      this.showAuthStatus("Password must be at least 6 characters.", "error");
      return;
    }

    const registerBtn = document.getElementById("registerBtn");
    this.setButtonLoading(registerBtn, true);

    try {
      const response = await fetch(`${API_BASE_URL}/registration`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email_address: email,
          password,
          password_confirmation: passwordConfirm,
        }),
      });

      const data = await response.json();

      if (response.ok) {
        await chrome.storage.sync.set({ authToken: data.token, userEmail: data.email });
        this.authToken = data.token;
        this.userEmail = data.email;
        this.updateAuthUI();
        this.showNotification("Registered and logged in!", "success");
        document.getElementById("registerEmail").value = "";
        document.getElementById("registerPassword").value = "";
        document.getElementById("registerPasswordConfirm").value = "";
      } else {
        this.showAuthStatus(data.errors?.join(", ") || "Registration failed.", "error");
      }
    } catch (error) {
      console.error("Register error:", error);
      this.showAuthStatus("Network error. Is the server running?", "error");
    } finally {
      this.setButtonLoading(registerBtn, false);
    }
  }

  async logout() {
    try {
      if (this.authToken) {
        await fetch(`${API_BASE_URL}/session`, {
          method: "DELETE",
          headers: { Authorization: `Bearer ${this.authToken}` },
        });
      }
    } catch (error) {
      console.error("Logout error:", error);
    }

    await chrome.storage.sync.remove(["authToken", "userEmail"]);
    this.authToken = "";
    this.userEmail = "";
    this.updateAuthUI();
    this.showNotification("Logged out successfully.", "info");
  }

  showAuthStatus(message, type) {
    const statusElement = document.getElementById("authStatus");
    statusElement.textContent = message;
    statusElement.className = `status-message ${type}`;
  }

  updateUI() {
    const apiKeyInput = document.getElementById("apiKey");
    apiKeyInput.value = this.apiKey;

    if (this.apiKey) {
      this.showStatus("Gemini API key configured ✓", "success");
    } else {
      this.showStatus(
        "Please configure your Gemini API key to start using the extension.",
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
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
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
