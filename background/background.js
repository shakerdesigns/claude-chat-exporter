// Handle download requests from popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'downloadChat') {
    try {
      console.log('Download request received:', request.filename);
      console.log('Data length:', request.chatData.length);
      
      // Create data URL for download
      const dataUrl = 'data:text/markdown;charset=utf-8,' + encodeURIComponent(request.chatData);
      
      chrome.downloads.download({
        url: dataUrl,
        filename: request.filename,
        saveAs: true // Force save dialog so you can see where it goes
      }, (downloadId) => {
        if (chrome.runtime.lastError) {
          console.error('Download failed:', chrome.runtime.lastError);
          sendResponse({ success: false, error: chrome.runtime.lastError.message });
        } else {
          console.log('Download started with ID:', downloadId);
          sendResponse({ success: true });
        }
      });
      
      return true; // Keep message channel open for async response
    } catch (error) {
      console.error('Error creating download:', error);
      sendResponse({ success: false, error: error.message });
    }
  }
});