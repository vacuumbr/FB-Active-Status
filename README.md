# FB Active Status

English | [Tiếng Việt](README.vi.md)

![FB Active Status popup in English](docs/images/popup-en.png)

This Chrome extension uses Manifest V3. It makes Facebook and Messenger show the last active time instead of "Active now".

## Why not just turn off Facebook's Active Status?

Turning off Facebook's Active Status also hides the last active time. This extension blocks three WebSocket endpoints that carry active status data so Facebook still shows that time.

## Before and after

Before, the status reads "Active now".

![Facebook showing Active now before using the extension](docs/images/dang-hoat-dong.png)

After, it shows the time since last active.

![Facebook showing Active 41 minutes ago after using the extension](docs/images/hoat-dong-truoc-do.png)

## Installation

1. Download [the extension ZIP](https://github.com/vacuumbr/FB-Active-Status/releases/download/v1.0.0/fb-active-status-v1.0.0.zip) and extract it to a folder.
2. Open `chrome://extensions` in Chrome.
3. Turn on Developer mode, then choose Load unpacked.
4. Select the extracted folder that contains `manifest.json`, not the ZIP file itself.
5. Open Facebook or Messenger and reload the tab. Reload open tabs after turning blocking on or off.

## Development

Install Node.js 20 or later, then build from source:

```powershell
npm install
npm run build
```

The build writes the extension to `dist/`. Load this folder with Load unpacked to test it in Chrome.

Run `npm run typecheck` to check TypeScript without generating files. Run `npm test` to test reload counts, message validation, and error handling.

## Project structure

- `src/`: TypeScript and CSS sources.
- `public/`: manifest, popup, rules, and local resources. The build generates `popup.css` and the files in `fonts/`. Do not edit these generated files.
- `dist/`: the built extension. Do not edit its files directly.
- `release/`: ZIP files for GitHub Releases.

## What it does

- Blocks the realtime WebSocket endpoints at `gateway.facebook.com/ws/realtime`, `gateway.facebook.com/ws/streamcontroller`, and `mqtt-mini.facebook.com`. The rules live in `public/rules/facebook-realtime.json`.
- Turns blocking on or off from the popup.
- Reloads open Facebook and Messenger tabs.
- Switches the popup between Vietnamese and English.
- Uses the system theme or a selected light or dark theme.

## Known effects

The blocked endpoints carry data other than active status. The extension also blocks that data. Test with your own accounts before relying on it.

Chrome shows a warning for extensions installed through Developer mode.

## License

[MIT](LICENSE) © wakupparalyzed
