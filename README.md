# Scraps

Scraps is a simple tool that allows you to make notes in the sidebar of VSCode.

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

1. Click the `Scraps` icon in the sidebar to open the extension
2. Click the `+` button to add a new note
3. Click on a note in the list to edit it in the editor panel
4. Right-click on a note to rename or delete it

## Troubleshooting

If you're unable to edit notes:
- Ensure all dependencies are properly installed
- Make sure both the webview UI and extension are compiled
- Check that the editor panel is visible alongside the list panel

## License

[MIT License](LICENSE)
