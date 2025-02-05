# YouTube Video Summarizer

![Logo](logo.png)

A Firefox extension that automatically fetches the transcript of any YouTube video, sends it to an LLM summarizer via Open WebUI, and displays a concise summary in a sleek, draggable, and resizable window. Perfect for quickly grasping the essence of long videos!

## Table of Contents

- [Features](#features)
- [Installation](#installation)
- [Usage](#usage)
- [Options](#options)
- [Development](#development)
- [License](#license)

## Features

- **Automatic Transcript Extraction:**  
  Detects YouTube video pages and automatically clicks the "Show transcript" button.

- **LLM-based Summarization:**  
  Sends the transcript to an LLM summarizer endpoint and displays the summary.

- **Sleek Summary Window:**  
  Draggable, resizable, and remembers your last position and size.

- **Refresh Summary:**  
  Includes a refresh button (⟳) to re-request a new summary if needed.

- **Customizable Domain:**  
  (Optional) Specify your own Open WebUI domain via the options page.

- **SPA Navigation Handling:**  
  Automatically re-summarizes when navigating to a new video without a full page reload.

## Installation

1. **Clone or Download the Repository**
   ```bash
   git clone https://github.com/Daylend/AnotherSummarizer.git
   ```

2. **Load the Extension in Firefox**
   - Open Firefox and go to `about:debugging`.
   - Click **"This Firefox"**.
   - Click **"Load Temporary Add-on…"** and select the `manifest.json` file from your repository folder.

3. The extension should now be active. Visit any YouTube video page (URLs containing `/watch`) to see it in action.

## Usage

- **Automatic Summarization:**  
  When you open a YouTube video page, the extension automatically fetches the transcript, summarizes it using the LLM endpoint, and displays the summary in a floating window.
  
- **Refresh Summary:**  
  If you feel the summary isn’t accurate, click the refresh button (⟳) in the summary window's header to request a new summary.
  
- **Moving and Resizing:**  
  Drag the header to move the window. Use the resize handle at the bottom-right to adjust its size.
  
- **Hiding the Transcript:**  
  Once the transcript is grabbed, the extension automatically hides the transcript panel so you only see the summary.

## Options

Access the extension options to configure:
- **API Key:** Your API key for the Open WebUI summarizer endpoint.
- **Open WebUI Domain:** The base URL for your local Open WebUI instance.

To open the options page, either right-click the extension icon and select **Options** or find it in the Firefox Add-ons manager.

## Development

- **Manifest Version:** Uses Manifest V3.
- **Content Scripts:** Injected on all YouTube pages; listens for SPA navigation events.
- **Drag & Resize:** Implements custom functionality for a draggable and resizable summary window.
- **State Persistence:** Remembers the last window position and size using browser storage.

### Building and Testing

1. Make changes to the source code.
2. Reload the extension in Firefox via `about:debugging` to see your changes.
3. Check the browser console for any debugging output.

## License

This project is licensed under the [MIT License](LICENSE).

---