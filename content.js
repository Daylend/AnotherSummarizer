// Global variable to track the last summarized video URL.
let lastSummarizedUrl = "";

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
function saveSummaryBoxState(container) {
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
  // Remove any existing indicator.
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
  // Remove any existing container.
  const oldContainer = document.getElementById("video-summary-container");
  if (oldContainer) oldContainer.remove();

  const container = document.createElement("div");
  container.id = "video-summary-container";
  container.style.position = "fixed";

  // Restore saved state (position and size) if available.
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

  // Optional: set minimum dimensions to ensure usability.
  container.style.minWidth = "200px";
  container.style.minHeight = "100px";

  container.style.backgroundColor = "rgba(0, 0, 0, 0.95)";
  container.style.color = "#fff";
  container.style.borderRadius = "8px";
  container.style.zIndex = "99999";
  container.style.fontSize = "14px";
  container.style.lineHeight = "1.5";
  container.style.boxShadow = "0 0 10px rgba(0,0,0,0.5)";
  // Prevent the container itself from scrolling.
  container.style.overflow = "hidden";

  // Use flex layout so that the header and content are separated.
  container.style.display = "flex";
  container.style.flexDirection = "column";

  // Create header (drag handle + refresh button)
  const header = document.createElement("div");
  header.style.display = "flex";
  header.style.justifyContent = "space-between";
  header.style.alignItems = "center";
  header.style.cursor = "move";
  header.style.backgroundColor = "rgba(255, 255, 255, 0.1)";
  header.style.padding = "8px 10px";
  header.style.borderRadius = "8px 8px 0 0";
  header.style.userSelect = "none"; // Prevent text selection during dragging
  
  const title = document.createElement("span");
  title.textContent = "Video Summary (Drag me)";
  header.appendChild(title);

  const refreshButton = document.createElement("button");
  refreshButton.textContent = "⟳";
  refreshButton.title = "Refresh summary";
  refreshButton.style.border = "none";
  refreshButton.style.background = "transparent";
  refreshButton.style.color = "#fff";
  refreshButton.style.cursor = "pointer";
  refreshButton.style.fontSize = "14px";
  refreshButton.style.marginLeft = "10px";
  // When clicked, force a refresh of the summary.
  refreshButton.addEventListener("click", function(e) {
    e.stopPropagation(); // Prevent triggering drag events.
    summarizeVideo(true);
  });
  header.appendChild(refreshButton);
  
  // Add the header to the container.
  container.appendChild(header);

  // Create a scrollable content area for the summary text.
  const content = document.createElement("div");
  content.id = "video-summary-content";
  content.style.padding = "15px";
  content.style.overflowY = "auto";
  // Let the content area fill the remaining space.
  content.style.flex = "1";
  container.appendChild(content);

  // Create the resizer handle.
  const resizer = document.createElement("div");
  resizer.style.width = "16px";
  resizer.style.height = "16px";
  resizer.style.backgroundColor = "rgba(255, 255, 255, 0.2)";
  resizer.style.position = "absolute";
  resizer.style.right = "0";
  resizer.style.bottom = "0";
  resizer.style.cursor = "se-resize";
  container.appendChild(resizer);

  // Append the container to the document.
  document.body.appendChild(container);

  // Immediately ensure the container is within the viewport.
  ensureContainerOnScreen(container);
  saveSummaryBoxState(container);

  /* --- Draggable functionality --- */
  header.addEventListener('mousedown', function(e) {
    e.preventDefault(); // Prevent text selection
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
      // Ensure container remains within viewport after dragging.
      ensureContainerOnScreen(container);
      saveSummaryBoxState(container);
    }
    
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  });

  /* --- Resizable functionality --- */
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
      // Ensure container remains within viewport after resizing.
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
  // Prevent duplicate requests unless forced.
  if (!forceRefresh && window.location.href === lastSummarizedUrl) {
    console.log("Already summarized this video. Skipping duplicate request.");
    return;
  }
  lastSummarizedUrl = window.location.href;

  // Remove any existing summary container or loading indicator.
  const existingContainer = document.getElementById("video-summary-container");
  if (existingContainer) existingContainer.remove();
  const existingIndicator = document.getElementById("summary-loading-indicator");
  if (existingIndicator) existingIndicator.remove();

  // Create the sleek loading indicator.
  const loadingIndicator = createLoadingIndicator();

  try {
    // Retrieve the API key from storage.
    const stored = await browser.storage.sync.get("apiKey");
    const apiKey = stored.apiKey;
    if (!apiKey) {
      loadingIndicator.innerHTML = "API key not set. Please set it in the options.";
      console.warn("API key not set. Please set it in the extension options.");
      return;
    }
    
    // Ensure we are on a YouTube video page.
    if (!window.location.href.includes("youtube.com/watch")) return;

    // Wait for the "Show transcript" button and click it.
    const transcriptButton = await waitForElement("yt-button-shape button[aria-label='Show transcript']");
    transcriptButton.click();
    console.log("Clicked 'Show transcript' button");
    
    // Wait for the transcript container to appear.
    await waitForElement("ytd-transcript-renderer");
    console.log("Transcript container appeared");
    
    // Allow extra time for the transcript content to load.
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Extract transcript text from each segment.
    const segments = document.querySelectorAll("ytd-transcript-segment-renderer yt-formatted-string.segment-text");
    if (!segments.length) {
      loadingIndicator.innerHTML = "No transcript segments found.";
      console.warn("No transcript segments found.");
      return;
    }
    const transcriptText = Array.from(segments)
      .map(seg => seg.textContent.trim())
      .join(" ");
    console.log("Transcript extracted:", transcriptText);
    
    // Hide the transcript from the user.
    // Wait for the "Close transcript" button inside the element with id "visibility-button" and click it.
    try {
      const closeTranscriptButton = await waitForElement("#visibility-button button[aria-label='Close transcript']");
      closeTranscriptButton.click();
      console.log("Transcript closed/hid.");
    } catch (e) {
      console.warn("Failed to close transcript:", e);
    }
    
    // Send transcript to Open WebUI for summarization.
    const response = await fetch("https://localhost:3000/api/chat/completions", {
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
    
    // Extract the summary (removing any <think> tags).
    let content = data.choices[0].message.content;
    content = content.replace(/<think>[\s\S]*?<\/think>/, '').trim();
    const summaryMarkdown = content || "No summary returned";
    console.log("Summary (markdown) received:", summaryMarkdown);
    
    // Convert markdown to HTML using the local marked library.
    const summaryHTML = marked.parse(summaryMarkdown);
    
    // On success, remove the loading indicator and show the summary container.
    loadingIndicator.remove();
    const summaryContainer = await createSummaryContainer();
    const summaryContent = summaryContainer.querySelector("#video-summary-content");
    summaryContent.innerHTML = summaryHTML;
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
});
  
document.addEventListener("yt-navigate-finish", () => {
  if (window.location.href.includes("youtube.com/watch")) {
    summarizeVideo();
  }
});
  
// Initial run if we are on a YouTube video page.
if (window.location.href.includes("youtube.com/watch")) {
  summarizeVideo();
}

// Add an event listener to reposition the summary container when the browser window is resized.
window.addEventListener("resize", () => {
  console.log("Window resized");
  const container = document.getElementById("video-summary-container");
  if (container) {
    ensureContainerOnScreen(container);
    saveSummaryBoxState(container);
    console.log("Container repositioned to:", container.style.left, container.style.top);
  }
});
