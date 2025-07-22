document.addEventListener('DOMContentLoaded', function() {
  const exportBtn = document.getElementById('exportBtn');
  const status = document.getElementById('status');

  exportBtn.addEventListener('click', async function() {
    try {
      exportBtn.disabled = true;
      status.textContent = 'Extracting chat...';
      status.className = 'status';

      // Get the active tab
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      
      if (!tab.url.includes('claude.ai')) {
        throw new Error('Please navigate to a Claude.ai chat first');
      }

      // Inject content script if needed, then send message
      try {
        await chrome.scripting.executeScript({
          target: { tabId: tab.id },
          files: ['content/content.js']
        });
      } catch (e) {
        // Script might already be injected, continue
      }

      // Wait a moment for script to initialize
      await new Promise(resolve => setTimeout(resolve, 100));

      // Send message to content script to extract chat
      const response = await chrome.tabs.sendMessage(tab.id, { action: 'extractChat' });
      
      if (!response.success) {
        throw new Error(response.error || 'Failed to extract chat');
      }

      // Send to background script to download
      await chrome.runtime.sendMessage({
        action: 'downloadChat',
        chatData: response.chatData,
        filename: response.filename
      });

      status.textContent = 'Chat exported successfully!';
      status.className = 'status success';
      
      setTimeout(() => {
        window.close();
      }, 1500);

    } catch (error) {
      status.textContent = error.message;
      status.className = 'status error';
    } finally {
      exportBtn.disabled = false;
    }
  });
});