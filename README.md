# Claude Chat Exporter

Export your Claude.ai conversations to markdown files with one click. Includes all messages, code blocks, and canvas/artifact content in proper sequence.

## Features

- 📝 Export entire Claude chat conversations to markdown
- 🎨 Includes text-based canvas/artifact content only (NOT HTML)
- 🏷️ Uses your custom chat names as filenames
- ⚡ One-click export from any Claude.ai chat
- 🔒 Completely local - no data leaves your browser

## Installation

### Method 1: Download ZIP (Recommended for most users)

1. **Download the extension**
   - Click the green "Code" button above
   - Select "Download ZIP"
   - Extract the ZIP file to a folder (e.g., `claude-chat-exporter`)

2. **Install in Chrome**
   - Open Chrome and go to `chrome://extensions/`
   - Toggle "Developer mode" ON (top right corner)
   - Click "Load unpacked"
   - Select the extracted `claude-chat-exporter` folder
   - The extension icon should appear in your toolbar

### Method 2: Git Clone (For developers)

```bash
git clone https://github.com/yourusername/claude-chat-exporter.git
cd claude-chat-exporter
```

Then follow step 2 from Method 1.

## Usage

1. **Navigate to any Claude.ai chat**
2. **Click the extension icon** in your Chrome toolbar
3. **Click "Export Chat to Markdown"**
4. **Choose where to save** the file
5. **Done!** Your chat is exported as a markdown file

## File Naming

Files are automatically named using:
- **Your custom chat name** (e.g., `solo-analytics-2025-07-22.md`)
- **Generic timestamp** if no custom name (e.g., `claude-chat-2025-07-22-14-30-25.md`)

## What Gets Exported

- ✅ All user messages and Claude responses
- ✅ Code blocks with syntax highlighting
- ✅ Canvas/artifact content
- ✅ Proper markdown formatting
- ✅ Timestamps and chat metadata

## Example Output

```markdown
# Claude Chat Export

*Exported on 7/22/2025, 2:30:25 PM*

---

## 👤 User

Can you create a React component for a todo list?

---

## 🤖 Claude

I'll create a React todo list component for you.

### 🎨 Canvas: React Todo Component

```jsx
function TodoList() {
  const [todos, setTodos] = useState([]);
  // ... rest of component
}
```

Here's how to use it...
```

## Troubleshooting

### Extension not loading
- Make sure you selected the folder containing `manifest.json`
- Check that "Developer mode" is enabled in `chrome://extensions/`

### "No chat messages found" error
- Make sure you're on a Claude.ai chat page (not the homepage)
- Try refreshing the page and waiting for it to fully load

### Downloads not working
- Check Chrome's download settings
- Extension will show a save dialog to pick location

## Privacy & Security

- **All processing happens locally** in your browser
- **No data is sent to external servers**
- **No tracking or analytics**
- Extension only accesses claude.ai pages

## Contributing

Found a bug or want to add a feature? 

1. Fork this repository
2. Create a feature branch
3. Make your changes
4. Submit a pull request

## License

MIT License - feel free to modify and distribute.

---

**Built for rapid prototyping and internal tools** - ship fast, iterate based on real usage.
