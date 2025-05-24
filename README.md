# Scraps.ai

Scraps.ai is an AI-powered note-taking extension for VSCode that helps you organize and structure your notes intelligently, and synchronize your notes to Notion with ease.

## Features

- 📝 Quick note-taking in VSCode sidebar
- 🤖 AI-powered note summarization and structuring
- 🔄 Seamless Notion integration
- 🎯 Multiple AI model support (GPT4, Gemini, Fireworks AI)
- 📱 Cross-device sync

## Directory Structure

```plaintext
.
├── resources  ... Static resources for VSCode extension
├── src        ... Source code for VSCode extension
└── webview-ui ... Webview UI source code
    ├── public ... Static resources for Webview UI
    └── src    ... Source code for Webview UI
```

## Development

### Requirements

- Node.js
- Visual Studio Code

### Setup

1. Fork this repository
2. Clone the forked repository
3. Install dependencies:
   ```
   npm install
   cd webview-ui
   npm install
   cd ..
   ```

### Building the Extension

```
npm run webview-ui:compile
npm run compile
```

### Running the Extension

There are multiple ways to run the extension:

#### Option 1: Using VSCode Debug Menu
1. Open the project in VSCode
2. Press `F5` or select `Run > Start Debugging` from the menu
3. A new VSCode window will open with the extension loaded
4. Find and click the `Scraps` icon in the activity bar (sidebar)

#### Option 2: Command Line
```
code --extensionDevelopmentPath="[path-to-project-directory]"
```
Replace `[path-to-project-directory]` with the actual path, or use `${PWD}` if running from the project root.

### Using the Extension

1. **Configure Settings First**
   - Open the Scraps.ai sidebar in VSCode.
   - Go to the **Settings** section.

2. **Set Up Notion Integration**
   - Enter your Notion **API Key** (get it from [Notion integrations](https://www.notion.so/my-integrations)).
   - Enter your Notion **Database ID** (find it in your Notion database URL).
   - Click **Save Settings**.

3. **Set Up AI Integration**
   - Enter your AI provider **API Key** (e.g., OpenAI, Google Gemini, Fireworks).
   - Select your preferred AI model from the dropdown.
   - Click **Save Settings**.

4. **Test Connections**
   - Use **Test Connection** to verify your Notion and AI settings.
   - Use **Test AI** to check if the AI summarization is working.

5. **Add and Manage Notes**
   - Click the **Add** button to create a new note.
   - Click on a note in the list to edit it in the editor panel.
   - Right-click a note to rename or delete it.

6. **Sync Notes**
   - Click **Sync Now** to manually synchronize your notes with Notion.
   - Notes will be formatted and summarized using your selected AI model before syncing.

## Configuration

### AI Settings
- Choose your preferred AI model
- Add your API key for the selected provider
- Customize summarization behavior

### Notion Integration
- Add your Notion API key
- Specify your target database ID
- Enable automatic sync

## Troubleshooting

If you're unable to edit notes:
- Ensure all dependencies are properly installed
- Make sure both the webview UI and extension are compiled
- Check that the editor panel is visible alongside the list panel


Or you can contact Frank (see contact information at the end)

## Contributing

Scraps.ai is open-source and welcomes contributions!
If you have ideas, suggestions, or want to help improve the extension, feel free to open issues or submit pull requests.

## License

[MIT License](LICENSE)

## Acknowledgments

This project is a fork of [scraps](https://github.com/original-scraps-repo).
Special thanks to:
- K@zuki
- corrupt952 (GitHub)

## Contact

- Email: zoli@ucsd.edu
- GitHub: [FrankLi123](https://github.com/FrankLi123)
- X (Twitter): [@FrankYouChill](https://x.com/FrankYouChill)
