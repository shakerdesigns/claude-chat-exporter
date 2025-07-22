// Listen for messages from popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'extractChat') {
    try {
      const chatData = extractChatMessages();
      const filename = generateFilename();
      
      sendResponse({
        success: true,
        chatData: chatData,
        filename: filename
      });
    } catch (error) {
      sendResponse({
        success: false,
        error: error.message
      });
    }
  }
});

function extractChatMessages() {
  // Target Claude's chat message containers
  const messageContainers = document.querySelectorAll('[data-testid^="conversation-turn"]');
  
  if (messageContainers.length === 0) {
    // Fallback: try alternative selectors
    const alternativeContainers = document.querySelectorAll('.font-claude-message, .prose, [class*="message"]');
    if (alternativeContainers.length === 0) {
      throw new Error('No chat messages found. Make sure you are on a Claude chat page.');
    }
    return extractFromAlternativeContainers(alternativeContainers);
  }

  let markdown = `# Claude Chat Export\n\n*Exported on ${new Date().toLocaleString()}*\n\n---\n\n`;
  
  messageContainers.forEach((container, index) => {
    // Determine if this is a user message or Claude's response
    const isUser = container.querySelector('[data-testid="human-turn"]') || 
                   container.innerHTML.includes('Human:') ||
                   container.querySelector('.bg-human') ||
                   !container.querySelector('[data-testid="ai-turn"]');
    
    const messageContent = extractMessageContent(container);
    const canvasContent = extractCanvasContent(container);
    
    if (messageContent.trim() || canvasContent.trim()) {
      if (isUser) {
        markdown += `## 👤 User\n\n${messageContent}`;
        if (canvasContent) {
          markdown += `\n\n${canvasContent}`;
        }
        markdown += `\n\n---\n\n`;
      } else {
        markdown += `## 🤖 Claude\n\n${messageContent}`;
        if (canvasContent) {
          markdown += `\n\n${canvasContent}`;
        }
        markdown += `\n\n---\n\n`;
      }
    }
  });
  
  return markdown;
}

function extractFromAlternativeContainers(containers) {
  let markdown = `# Claude Chat Export\n\n*Exported on ${new Date().toLocaleString()}*\n\n---\n\n`;
  
  containers.forEach((container, index) => {
    const content = extractMessageContent(container);
    if (content.trim()) {
      const isUser = index % 2 === 0; // Simple alternating pattern fallback
      if (isUser) {
        markdown += `## 👤 User\n\n${content}\n\n---\n\n`;
      } else {
        markdown += `## 🤖 Claude\n\n${content}\n\n---\n\n`;
      }
    }
  });
  
  return markdown;
}

function extractMessageContent(container) {
  // Clone the container to avoid modifying the original
  const clone = container.cloneNode(true);
  
  // Remove unwanted elements
  const unwantedSelectors = [
    '[data-testid="copy-button"]',
    '[data-testid="regenerate-button"]', 
    '.copy-button',
    '.regenerate-button',
    'button',
    '.sr-only',
    '[aria-hidden="true"]'
  ];
  
  unwantedSelectors.forEach(selector => {
    clone.querySelectorAll(selector).forEach(el => el.remove());
  });
  
  // Handle code blocks specially - preserve in sequence
  const codeBlocks = clone.querySelectorAll('pre code, .hljs, [class*="code"]:not([class*="inline"])');
  codeBlocks.forEach((block, index) => {
    const language = block.className.match(/language-(\w+)/)?.[1] || '';
    const code = block.textContent;
    // Mark the position for later replacement to maintain sequence
    block.innerHTML = `__CODE_BLOCK_${index}__`;
    block.setAttribute('data-code', code);
    block.setAttribute('data-language', language);
  });
  
  // Handle inline code
  const inlineCode = clone.querySelectorAll('code:not(pre code)');
  inlineCode.forEach(code => {
    code.innerHTML = `\`${code.textContent}\``;
  });
  
  // Convert HTML to markdown-like formatting
  let content = clone.innerHTML
    .replace(/<h([1-6]).*?>(.*?)<\/h[1-6]>/gi, (match, level, text) => {
      return '#'.repeat(parseInt(level)) + ' ' + text.trim() + '\n\n';
    })
    .replace(/<p.*?>(.*?)<\/p>/gi, '$1\n\n')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<strong.*?>(.*?)<\/strong>/gi, '**$1**')
    .replace(/<em.*?>(.*?)<\/em>/gi, '*$1*')
    .replace(/<li.*?>(.*?)<\/li>/gi, '- $1\n')
    .replace(/<ul.*?>(.*?)<\/ul>/gi, '$1\n')
    .replace(/<ol.*?>(.*?)<\/ol>/gi, '$1\n')
    .replace(/<a.*?href="(.*?)".*?>(.*?)<\/a>/gi, '[$2]($1)')
    .replace(/<[^>]*>/g, '') // Remove remaining HTML tags
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"');
  
  // Restore code blocks in their original sequence
  const codeBlockElements = clone.querySelectorAll('[data-code]');
  codeBlockElements.forEach((block, index) => {
    const code = block.getAttribute('data-code');
    const language = block.getAttribute('data-language');
    content = content.replace(`__CODE_BLOCK_${index}__`, `\n\`\`\`${language}\n${code}\n\`\`\`\n`);
  });
  
  content = content
    .replace(/\n\s*\n\s*\n/g, '\n\n') // Normalize multiple newlines
    .trim();
  
  return content;
}

function extractCanvasContent(container) {
  let canvasMarkdown = '';
  
  // Look for Claude's canvas/artifact containers
  const canvasSelectors = [
    '[data-testid="artifact"]',
    '[data-testid="canvas"]',
    '.artifact-container',
    '[class*="artifact"]',
    '[class*="canvas"]',
    'iframe[src*="artifacts"]'
  ];
  
  canvasSelectors.forEach(selector => {
    const canvases = container.querySelectorAll(selector);
    canvases.forEach((canvas, index) => {
      // Try to get artifact title or type
      let title = '';
      const titleElement = canvas.querySelector('[data-testid="artifact-title"], .artifact-title, h3, h4');
      if (titleElement) {
        title = titleElement.textContent.trim();
      }
      
      // Try to get artifact content
      let content = '';
      
      // Check if it's an iframe (common for artifacts)
      if (canvas.tagName === 'IFRAME') {
        try {
          const iframeDoc = canvas.contentDocument || canvas.contentWindow.document;
          if (iframeDoc) {
            content = iframeDoc.body.innerText || iframeDoc.body.textContent || '[Canvas content - iframe not accessible]';
          } else {
            content = '[Canvas content - iframe not accessible]';
          }
        } catch (e) {
          content = '[Canvas content - iframe not accessible due to security restrictions]';
        }
      } else {
        // Try to extract code or text content
        const codeElement = canvas.querySelector('pre code, code, .hljs');
        if (codeElement) {
          const language = codeElement.className.match(/language-(\w+)/)?.[1] || '';
          content = `\`\`\`${language}\n${codeElement.textContent}\n\`\`\``;
        } else {
          content = canvas.textContent.trim() || '[Canvas content not extractable]';
        }
      }
      
      if (content) {
        canvasMarkdown += `\n### 🎨 Canvas${title ? `: ${title}` : ` ${index + 1}`}\n\n${content}\n\n`;
      }
    });
  });
  
  // Also look for code blocks that might not be in canvas containers
  const standaloneCodeBlocks = container.querySelectorAll('pre:not([class*="artifact"]) code');
  standaloneCodeBlocks.forEach((block, index) => {
    if (!block.closest('[data-testid="artifact"]') && !block.closest('.artifact-container')) {
      const language = block.className.match(/language-(\w+)/)?.[1] || '';
      const code = block.textContent;
      if (code.trim()) {
        canvasMarkdown += `\n### 💻 Code Block ${index + 1}\n\n\`\`\`${language}\n${code}\n\`\`\`\n\n`;
      }
    }
  });
  
  return canvasMarkdown;
}

function generateFilename() {
  // Try to get the chat title from Claude's interface
  let chatTitle = '';
  
  // Look for the chat title in various locations - updated selectors for Claude's naming
  const titleSelectors = [
    // Chat title in the main conversation area
    '[data-testid="conversation-title"]',
    '.conversation-title',
    
    // Chat name in the sidebar (active/selected chat)
    '[data-state="selected"] [class*="truncate"]',
    '[aria-selected="true"] [class*="truncate"]',
    '.bg-accent [class*="truncate"]',
    '.bg-selected [class*="truncate"]',
    
    // General chat title selectors
    '.font-medium.truncate',
    '[class*="conversation"] [class*="title"]',
    
    // Header area titles
    'header h1',
    'header [class*="title"]',
    
    // Main content area titles
    'main h1',
    '.text-lg.font-medium',
    
    // Sidebar active item (broader search)
    '[data-state="selected"]',
    '[aria-selected="true"]',
    '.bg-accent',
    
    // Fallback to any button with truncate (often chat names)
    '[role="button"] .truncate'
  ];
  
  for (const selector of titleSelectors) {
    const titleElement = document.querySelector(selector);
    if (titleElement && titleElement.textContent.trim()) {
      const text = titleElement.textContent.trim();
      // Filter out generic/system text
      if (!text.includes('New chat') && 
          !text.includes('Claude') && 
          !text.includes('Menu') &&
          !text.includes('Settings') &&
          text.length > 2) {
        chatTitle = text;
        console.log(`Found chat title using selector "${selector}":`, chatTitle);
        break;
      }
    }
  }
  
  // More aggressive fallback: look in sidebar for any text that could be a chat name
  if (!chatTitle) {
    const sidebarButtons = document.querySelectorAll('[role="button"]');
    for (const button of sidebarButtons) {
      const text = button.textContent.trim();
      if (text && 
          text.length > 3 && 
          text.length < 100 &&
          !text.includes('New chat') && 
          !text.includes('Claude') &&
          !text.includes('Menu') &&
          !text.includes('Settings') &&
          !text.includes('Export') &&
          button.closest('[data-state="selected"], [aria-selected="true"], .bg-accent')) {
        chatTitle = text;
        console.log('Found chat title from active sidebar button:', chatTitle);
        break;
      }
    }
  }
  
  // Debug: log all potential title elements for troubleshooting
  if (!chatTitle) {
    console.log('Chat title not found. Debugging selectors:');
    titleSelectors.forEach(selector => {
      const elements = document.querySelectorAll(selector);
      elements.forEach((el, index) => {
        console.log(`${selector}[${index}]:`, el.textContent.trim());
      });
    });
  }
  
  // Clean up the title for filename
  if (chatTitle) {
    chatTitle = chatTitle
      .replace(/[<>:"/\\|?*]/g, '') // Remove invalid filename characters
      .replace(/\s+/g, '-') // Replace spaces with dashes
      .substring(0, 50) // Limit length
      .toLowerCase();
  }
  
  // Generate timestamp
  const now = new Date();
  const dateStr = now.toISOString().split('T')[0]; // YYYY-MM-DD
  
  // Create filename
  if (chatTitle) {
    return `${chatTitle}-${dateStr}.md`;
  } else {
    const timeStr = now.toTimeString().split(' ')[0].replace(/:/g, '-'); // HH-MM-SS
    return `claude-chat-${dateStr}-${timeStr}.md`;
  }
}