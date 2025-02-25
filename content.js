// Global variables to track the last summarized video URL and cached transcript.
let lastSummarizedUrl = "";
let storedTranscript = "";

// Utility: Wait for a DOM element to appear matching the selector.
function waitForElement(selector, timeout = 10000) {
  return new Promise((resolve, reject) => {
    const interval = 100;
    let elapsed = 0;
    const timer = setInterval(() => {
      const element = document.querySelector(selector);
      if (element) {
        clearInterval(timer);
        resolve(element);
      }
      elapsed += interval;
      if (elapsed >= timeout) {
        clearInterval(timer);
        reject(new Error(`Timeout waiting for element: ${selector}`));
      }
    }, interval);
  });
}

// Helper: Save the summary container's state (position and size) to storage.
// Note: if the container is minimized, state is not saved.
function saveSummaryBoxState(container) {
  if (container.dataset.minimized === "true") return;
  const state = {
    left: container.style.left,
    top: container.style.top,
    width: container.style.width,
    height: container.style.height
  };
  browser.storage.sync.set({ videoSummaryBoxState: state });
}

// Helper: Ensure the container stays within the viewport.
function ensureContainerOnScreen(container) {
  const rect = container.getBoundingClientRect();
  let newLeft = rect.left;
  let newTop = rect.top;
  if (rect.left < 0) {
    newLeft = 0;
  }
  if (rect.top < 0) {
    newTop = 0;
  }
  if (rect.right > window.innerWidth) {
    newLeft = window.innerWidth - rect.width;
  }
  if (rect.bottom > window.innerHeight) {
    newTop = window.innerHeight - rect.height;
  }
  container.style.left = newLeft + "px";
  container.style.top = newTop + "px";
}

// Create a sleek loading indicator in the bottom right.
function createLoadingIndicator() {
  const existing = document.getElementById("summary-loading-indicator");
  if (existing) existing.remove();

  const indicator = document.createElement("div");
  indicator.id = "summary-loading-indicator";
  indicator.innerHTML = "Loading summary...";
  indicator.style.position = "fixed";
  indicator.style.bottom = "10px";
  indicator.style.right = "10px";
  indicator.style.padding = "6px 10px";
  indicator.style.backgroundColor = "rgba(0, 0, 0, 0.8)";
  indicator.style.color = "#fff";
  indicator.style.borderRadius = "4px";
  indicator.style.zIndex = "100000";
  indicator.style.fontSize = "12px";
  document.body.appendChild(indicator);
  return indicator;
}

// Create the summary container (draggable & resizable) that displays the summary.
async function createSummaryContainer() {
  const oldContainer = document.getElementById("video-summary-container");
  if (oldContainer) oldContainer.remove();

  const container = document.createElement("div");
  container.id = "video-summary-container";
  container.style.position = "fixed";
  // Mark container as not minimized.
  container.dataset.minimized = "false";

  const savedState = await browser.storage.sync.get("videoSummaryBoxState");
  if (savedState.videoSummaryBoxState) {
    container.style.left = savedState.videoSummaryBoxState.left;
    container.style.top = savedState.videoSummaryBoxState.top;
    container.style.width = savedState.videoSummaryBoxState.width;
    container.style.height = savedState.videoSummaryBoxState.height;
  } else {
    container.style.left = "20px";
    container.style.top = "20px";
    container.style.width = "400px";
    container.style.height = "300px";
  }

  container.style.minWidth = "200px";
  container.style.minHeight = "100px";
  container.style.backgroundColor = "rgba(0, 0, 0, 0.95)";
  container.style.color = "#fff";
  container.style.borderRadius = "8px";
  container.style.zIndex = "99999";
  container.style.fontSize = "14px";
  container.style.lineHeight = "1.5";
  container.style.boxShadow = "0 0 10px rgba(0,0,0,0.5)";
  container.style.overflow = "hidden";
  container.style.display = "flex";
  container.style.flexDirection = "column";

  const header = document.createElement("div");
  header.style.display = "flex";
  header.style.justifyContent = "space-between";
  header.style.alignItems = "center";
  header.style.cursor = "move";
  header.style.backgroundColor = "rgba(255, 255, 255, 0.1)";
  header.style.padding = "8px 10px";
  header.style.borderRadius = "8px 8px 0 0";
  header.style.userSelect = "none";
  
  const title = document.createElement("span");
  title.textContent = "Video Summary (Drag me)";
  header.appendChild(title);

  // Button container to hold action buttons.
  const buttonContainer = document.createElement("div");

  // Refresh button (uses stored transcript).
  const refreshButton = document.createElement("button");
  refreshButton.textContent = "⟳";
  refreshButton.title = "Refresh summary";
  refreshButton.style.border = "none";
  refreshButton.style.background = "transparent";
  refreshButton.style.color = "#fff";
  refreshButton.style.cursor = "pointer";
  refreshButton.style.fontSize = "14px";
  refreshButton.style.marginLeft = "10px";
  refreshButton.addEventListener("click", function(e) {
    e.stopPropagation();
    // Force re-summarization using the stored transcript.
    summarizeVideo(true);
  });
  buttonContainer.appendChild(refreshButton);

  // Clipboard button to copy transcript text.
  const clipboardButton = document.createElement("button");
  clipboardButton.textContent = "📋";
  clipboardButton.title = "Copy transcript to clipboard";
  clipboardButton.style.border = "none";
  clipboardButton.style.background = "transparent";
  clipboardButton.style.color = "#fff";
  clipboardButton.style.cursor = "pointer";
  clipboardButton.style.fontSize = "14px";
  clipboardButton.style.marginLeft = "10px";
  clipboardButton.addEventListener("click", function(e) {
    e.stopPropagation();
    if (storedTranscript) {
      navigator.clipboard.writeText(storedTranscript).then(() => {
        console.log("Transcript copied to clipboard.");
      }).catch(err => {
        console.error("Error copying transcript:", err);
      });
    } else {
      console.warn("No transcript available to copy.");
    }
  });
  buttonContainer.appendChild(clipboardButton);

  // Minimize/Maximize button to toggle container state.
  const minimizeButton = document.createElement("button");
  minimizeButton.textContent = "−"; // Initially showing minimize icon.
  minimizeButton.title = "Minimize summary";
  minimizeButton.style.border = "none";
  minimizeButton.style.background = "transparent";
  minimizeButton.style.color = "#fff";
  minimizeButton.style.cursor = "pointer";
  minimizeButton.style.fontSize = "14px";
  minimizeButton.style.marginLeft = "10px";
  minimizeButton.addEventListener("click", function(e) {
    e.stopPropagation();
    const content = container.querySelector("#video-summary-content");
    const resizer = container.querySelector("div[style*='cursor: se-resize']");
    const minWidth = 300; // fixed minimized width in pixels
    const minHeight = 30; // fixed minimized height in pixels
    if (container.dataset.minimized !== "true") {
      // Save the current (original) state.
      container.dataset.originalLeft = container.style.left;
      container.dataset.originalTop = container.style.top;
      container.dataset.originalWidth = container.style.width;
      container.dataset.originalHeight = container.style.height;
      // Change to minimized state: a small bar at the bottom right.
      container.style.width = minWidth + "px";
      container.style.height = minHeight + "px";
      container.style.left = (window.innerWidth - minWidth) + "px";
      container.style.top = (window.innerHeight - minHeight) + "px";
      container.dataset.minimized = "true";
      // Hide content and resizer.
      content.style.display = "none";
      if (resizer) resizer.style.display = "none";
      // Update button to show maximize option.
      minimizeButton.textContent = "☐";
      minimizeButton.title = "Maximize summary";
    } else {
      // Restore the original state.
      container.style.left = container.dataset.originalLeft || "20px";
      container.style.top = container.dataset.originalTop || "20px";
      container.style.width = container.dataset.originalWidth || "400px";
      container.style.height = container.dataset.originalHeight || "300px";
      container.dataset.minimized = "false";
      // Show content and resizer.
      content.style.display = "block";
      if (resizer) resizer.style.display = "block";
      // Update button to show minimize option.
      minimizeButton.textContent = "−";
      minimizeButton.title = "Minimize summary";
      // Ensure the container is fully within the viewport
      ensureContainerOnScreen(container);
      // Save the restored state.
      saveSummaryBoxState(container);
    }
  });
  buttonContainer.appendChild(minimizeButton);

  header.appendChild(buttonContainer);
  container.appendChild(header);

  const content = document.createElement("div");
  content.id = "video-summary-content";
  content.style.padding = "15px";
  content.style.overflowY = "auto";
  content.style.flex = "1";
  container.appendChild(content);

  const resizer = document.createElement("div");
  resizer.style.width = "16px";
  resizer.style.height = "16px";
  resizer.style.backgroundColor = "rgba(255, 255, 255, 0.2)";
  resizer.style.position = "absolute";
  resizer.style.right = "0";
  resizer.style.bottom = "0";
  resizer.style.cursor = "se-resize";
  container.appendChild(resizer);

  document.body.appendChild(container);

  // Immediately ensure the container is within the viewport.
  ensureContainerOnScreen(container);
  saveSummaryBoxState(container);

  // Make the container draggable.
  header.addEventListener('mousedown', function(e) {
    e.preventDefault();
    const rect = container.getBoundingClientRect();
    const offsetX = e.clientX - rect.left;
    const offsetY = e.clientY - rect.top;
    
    function onMouseMove(e) {
      container.style.left = (e.clientX - offsetX) + 'px';
      container.style.top = (e.clientY - offsetY) + 'px';
    }
    
    function onMouseUp() {
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
      ensureContainerOnScreen(container);
      saveSummaryBoxState(container);
    }
    
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  });

  // Make the container resizable.
  resizer.addEventListener('mousedown', function(e) {
    e.preventDefault();
    const startX = e.clientX;
    const startY = e.clientY;
    const startWidth = parseInt(getComputedStyle(container).width, 10);
    const startHeight = parseInt(getComputedStyle(container).height, 10);
    
    function onMouseMove(e) {
      const newWidth = startWidth + (e.clientX - startX);
      const newHeight = startHeight + (e.clientY - startY);
      container.style.width = newWidth + 'px';
      container.style.height = newHeight + 'px';
    }
    
    function onMouseUp() {
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
      ensureContainerOnScreen(container);
      saveSummaryBoxState(container);
    }
    
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  });

  return container;
}

// Main function to handle summarization.
// Accepts an optional forceRefresh parameter; if true, bypass duplicate-check.
async function summarizeVideo(forceRefresh = false) {
  if (!forceRefresh && window.location.href === lastSummarizedUrl) {
    console.log("Already summarized this video. Skipping duplicate request.");
    return;
  }
  lastSummarizedUrl = window.location.href;

  const existingContainer = document.getElementById("video-summary-container");
  if (existingContainer) existingContainer.remove();
  const existingIndicator = document.getElementById("summary-loading-indicator");
  if (existingIndicator) existingIndicator.remove();

  const loadingIndicator = createLoadingIndicator();

  try {
    // Retrieve the API key and Open WebUI domain from storage.
    const stored = await browser.storage.sync.get(["apiKey", "openWebuiDomain"]);
    const apiKey = stored.apiKey;
    const openWebuiDomain = stored.openWebuiDomain;
    if (!apiKey) {
      loadingIndicator.innerHTML = "API key not set. Please set it in the options.";
      console.warn("API key not set. Please set it in the extension options.");
      return;
    }
    if (!openWebuiDomain) {
      loadingIndicator.innerHTML = "Open WebUI domain not set. Please set it in the options.";
      console.warn("Open WebUI domain not set.");
      return;
    }
    
    if (!window.location.href.includes("youtube.com/watch")) return;

    let transcriptText = "";
    if (!storedTranscript) {
      // Retrieve transcript only if not already stored.
      const transcriptButton = await waitForElement("yt-button-shape button[aria-label='Show transcript']");
      transcriptButton.click();
      console.log("Clicked 'Show transcript' button");
      
      await waitForElement("ytd-transcript-renderer");
      console.log("Transcript container appeared");
      
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      const segments = document.querySelectorAll("ytd-transcript-segment-renderer yt-formatted-string.segment-text");
      if (!segments.length) {
        loadingIndicator.innerHTML = "No transcript segments found.";
        console.warn("No transcript segments found.");
        return;
      }
      storedTranscript = Array.from(segments)
        .map(seg => seg.textContent.trim())
        .join(" ");
      console.log("Transcript extracted and stored:", storedTranscript);
      
      try {
        const closeTranscriptButton = await waitForElement("#visibility-button button[aria-label='Close transcript']");
        closeTranscriptButton.click();
        console.log("Transcript closed/hid.");
      } catch (e) {
        console.warn("Failed to close transcript:", e);
      }
      transcriptText = storedTranscript;
    } else {
      console.log("Using stored transcript.");
      transcriptText = storedTranscript;
    }
    
    // Build the API URL dynamically using the user-specified domain.
    const apiUrl = `${openWebuiDomain}/api/chat/completions`;
    const response = await fetch(apiUrl, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "summarizer",
        messages: [
          { role: "user", content: transcriptText }
        ]
      })
    });
    
    if (!response.ok) {
      throw new Error(`Summarization request failed with status ${response.status}`);
    }
    const data = await response.json();
    
    let content = data.choices[0].message.content;
    content = content.replace(/<think>[\s\S]*?<\/think>/, '').trim();
    const summaryMarkdown = content || "No summary returned";
    console.log("Summary (markdown) received:", summaryMarkdown);
    
    // Convert markdown to HTML using marked and sanitize the output with DOMPurify.
    const summaryHTML = marked.parse(summaryMarkdown);
    const safeHTML = DOMPurify.sanitize(summaryHTML);
    
    loadingIndicator.remove();
    const summaryContainer = await createSummaryContainer();
    const summaryContent = summaryContainer.querySelector("#video-summary-content");
    summaryContent.innerHTML = safeHTML;
  } catch (error) {
    console.error("YouTube Summarizer error:", error);
    loadingIndicator.innerHTML = "Error generating summary.";
    loadingIndicator.style.backgroundColor = "rgba(255,0,0,0.8)";
  }
}

// --- Handle YouTube's SPA navigation ---
document.addEventListener("yt-navigate-start", () => {
  const oldContainer = document.getElementById("video-summary-container");
  if (oldContainer) oldContainer.remove();
  const oldIndicator = document.getElementById("summary-loading-indicator");
  if (oldIndicator) oldIndicator.remove();
  // Reset the stored transcript when navigating to a new video.
  storedTranscript = "";
});
  
document.addEventListener("yt-navigate-finish", () => {
  if (window.location.href.includes("youtube.com/watch")) {
    summarizeVideo();
  }
});
  
if (window.location.href.includes("youtube.com/watch")) {
  summarizeVideo();
}

// Update container position on window resize.
// If minimized, adjust its position so it stays at the bottom right.
window.addEventListener("resize", () => {
  console.log("Window resized");
  const container = document.getElementById("video-summary-container");
  if (container) {
    if (container.dataset.minimized === "true") {
      const minWidth = 300;
      const minHeight = 30;
      container.style.left = (window.innerWidth - minWidth) + "px";
      container.style.top = (window.innerHeight - minHeight) + "px";
    } else {
      ensureContainerOnScreen(container);
      saveSummaryBoxState(container);
    }
    console.log("Container repositioned to:", container.style.left, container.style.top);
  }
});
