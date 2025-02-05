// Saves API key to browser storage.
function saveOptions() {
    const apiKey = document.getElementById("apiKey").value;
    browser.storage.sync.set({ apiKey }).then(() => {
      const status = document.getElementById("status");
      status.textContent = "Options saved.";
      setTimeout(() => status.textContent = "", 2000);
    });
  }
  
  // Restores the API key from storage.
  function restoreOptions() {
    browser.storage.sync.get("apiKey").then((result) => {
      if (result.apiKey) {
        document.getElementById("apiKey").value = result.apiKey;
      }
    });
  }
  
  document.addEventListener("DOMContentLoaded", restoreOptions);
  document.getElementById("save").addEventListener("click", saveOptions);
  