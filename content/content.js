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
  
  // Look for Claude's artifact containers - same as working version
  const artifactContainers = container.querySelectorAll(
    '#markdown-artifact, [id*="artifact"], .font-claude-message, [class*="artifact"]'
  );
  
  artifactContainers.forEach((artifactContainer, index) => {
    // Skip HTML artifacts that contain iframes - THIS IS THE ONLY NEW ADDITION
    if (artifactContainer.querySelector('iframe')) {
      console.log('Skipping HTML artifact with iframe');
      return;
    }
    
    // Get the artifact title from h1 or other heading elements
    let title = '';
    const titleElement = artifactContainer.querySelector('h1, h2, h3, h4, .text-2xl, .text-xl, .text-lg');
    if (titleElement && titleElement.textContent.trim()) {
      title = titleElement.textContent.trim();
    }
    
    // Get the full content of the artifact
    let content = '';
    
    // Clone to avoid modifying original
    const clone = artifactContainer.cloneNode(true);
    
    // Remove any UI controls/buttons that aren't part of the content
    const controlElements = clone.querySelectorAll('button, [role="button"], .sr-only, [aria-hidden="true"]');
    controlElements.forEach(el => el.remove());
    
    // Convert the HTML content to markdown
    content = convertHtmlToMarkdown(clone);
    
    if (content && content.trim().length > 50) { // Only include substantial content
      const artifactTitle = title || `Artifact ${index + 1}`;
      canvasMarkdown += `\n### 🎨 ${artifactTitle}\n\n${content}\n\n`;
    }
  });
  
  // Also look for any standalone code blocks not in artifacts
  const standaloneCodeBlocks = container.querySelectorAll('pre code');
  standaloneCodeBlocks.forEach((block, index) => {
    // Skip if already inside an artifact
    if (!block.closest('#markdown-artifact, [id*="artifact"]')) {
      const language = block.className.match(/language-(\w+)/)?.[1] || '';
      const code = block.textContent.trim();
      if (code && code.length > 10) {
        canvasMarkdown += `\n### 💻 Code Block ${index + 1}\n\n\`\`\`${language}\n${code}\n\`\`\`\n\n`;
      }
    }
  });
  
  return canvasMarkdown;
}

function convertHtmlToMarkdown(element) {
  // Get the innerHTML and convert to markdown
  let html = element.innerHTML;
  
  // Convert HTML elements to markdown
  html = html
    // Headers
    .replace(/<h1[^>]*>(.*?)<\/h1>/gi, '# $1\n\n')
    .replace(/<h2[^>]*>(.*?)<\/h2>/gi, '## $1\n\n')
    .replace(/<h3[^>]*>(.*?)<\/h3>/gi, '### $1\n\n')
    .replace(/<h4[^>]*>(.*?)<\/h4>/gi, '#### $1\n\n')
    .replace(/<h5[^>]*>(.*?)<\/h5>/gi, '##### $1\n\n')
    .replace(/<h6[^>]*>(.*?)<\/h6>/gi, '###### $1\n\n')
    
    // Paragraphs
    .replace(/<p[^>]*>(.*?)<\/p>/gi, '$1\n\n')
    
    // Line breaks
    .replace(/<br\s*\/?>/gi, '\n')
    
    // Strong/Bold
    .replace(/<strong[^>]*>(.*?)<\/strong>/gi, '**$1**')
    .replace(/<b[^>]*>(.*?)<\/b>/gi, '**$1**')
    
    // Emphasis/Italic
    .replace(/<em[^>]*>(.*?)<\/em>/gi, '*$1*')
    .replace(/<i[^>]*>(.*?)<\/i>/gi, '*$1*')
    
    // Task lists (checkboxes) - handle these before regular lists
    .replace(/<input[^>]*type="checkbox"[^>]*checked[^>]*>/gi, '- [x] ')
    .replace(/<input[^>]*type="checkbox"[^>]*>/gi, '- [ ] ')
    
    // Lists
    .replace(/<li[^>]*>(.*?)<\/li>/gi, '- $1\n')
    .replace(/<ul[^>]*>(.*?)<\/ul>/gi, '$1\n')
    .replace(/<ol[^>]*>(.*?)<\/ol>/gi, '$1\n')
    
    // Links
    .replace(/<a[^>]*href="([^"]*)"[^>]*>(.*?)<\/a>/gi, '[$2]($1)')
    
    // Code blocks (preserve these)
    .replace(/<pre[^>]*><code[^>]*>(.*?)<\/code><\/pre>/gi, '```\n$1\n```\n')
    
    // Inline code
    .replace(/<code[^>]*>(.*?)<\/code>/gi, '`$1`')
    
    // Horizontal rules
    .replace(/<hr[^>]*>/gi, '\n---\n')
    
    // Remove all other HTML tags
    .replace(/<[^>]*>/g, '')
    
    // Clean up HTML entities
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#x27;/g, "'")
    
    // Clean up multiple newlines
    .replace(/\n\s*\n\s*\n/g, '\n\n')
    .trim();
  
  return html;
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
