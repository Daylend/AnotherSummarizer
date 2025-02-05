// Saves API key and Open WebUI domain to browser storage.
function saveOptions() {
  const apiKey = document.getElementById("apiKey").value;
  const openWebuiDomain = document.getElementById("openWebuiDomain").value.trim();

  // Request permission for the specified domain.
  browser.permissions.request({
    origins: [openWebuiDomain + "/*"]
  }).then((granted) => {
    if (granted) {
      browser.storage.sync.set({ apiKey, openWebuiDomain }).then(() => {
        const status = document.getElementById("status");
        status.textContent = "Options saved.";
        setTimeout(() => status.textContent = "", 2000);
      });
    } else {
      console.warn("Permission not granted for " + openWebuiDomain);
      const status = document.getElementById("status");
      status.textContent = "Permission not granted for " + openWebuiDomain;
    }
  });
}

// Restores the API key and Open WebUI domain from storage.
function restoreOptions() {
  browser.storage.sync.get(["apiKey", "openWebuiDomain"]).then((result) => {
    if (result.apiKey) {
      document.getElementById("apiKey").value = result.apiKey;
    }
    if (result.openWebuiDomain) {
      document.getElementById("openWebuiDomain").value = result.openWebuiDomain;
    }
  });
}

document.addEventListener("DOMContentLoaded", restoreOptions);
document.getElementById("save").addEventListener("click", saveOptions);
