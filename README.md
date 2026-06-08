# Jellyfin Miner

Watch on any Jellyfin client (TV, mobile, web) and create media Anki cards on any Yomitan client (desktop, mobile) - finally making mining media from your couch a reality!

https://github.com/user-attachments/assets/53bc0616-00ec-4f39-9e75-83e54fddaeb1

## General Description

Jellyfin Miner is a plugin for the Jellyfin media server that extracts subtitle cues and their corresponding screenshots and audio clips from your media. It allows you to create Anki flashcards with this content using AnkiConnect.

Only watching locally with mpv? Check out [mpv-subtitleminer](https://github.com/friedrich-de/mpv-subtitleminer) instead.

## Installation

### Requirements

- Jellyfin server 10.11.9 or newer

### Plugin Repository

Add this repository URL in Jellyfin:

```text
https://friedrich-de.github.io/jellyfin-subtitleminer/manifest.json
```

Then install it from Jellyfin:

1. Open the Jellyfin dashboard.
2. Go to Plugins.
3. Open Repositories.
4. Add the repository URL above.
5. Open Catalog.
6. Install Jellyfin Miner.
7. Restart Jellyfin.

After the restart, open:

```text
https://your-jellyfin-server/Plugins/JellyfinMiner/
```

Use your normal Jellyfin username and password.

### Manual Install

Download the latest plugin zip from the GitHub Releases page.

Extract the `Jellyfin Miner/` folder into Jellyfin's plugins directory, then restart Jellyfin.

The installed folder should look like this:

```text
plugins/
  Jellyfin Miner/
    Jellyfin.Plugin.JellyfinMiner.dll
    meta.json
    wwwroot/
```

## Usage

1. Start playback in Jellyfin.
2. Open Jellyfin Miner:

   ```text
   https://your-jellyfin-server/Plugins/JellyfinMiner/
   ```

3. Sign in with your Jellyfin account.
4. Select the active stream from the sidebar.
5. Select the subtitle track if needed.
6. Click subtitle cues to select one cue or a contiguous range.
7. Use the action bar to preview screenshots/audio or add the selection to Anki.

Jellyfin Miner talks to AnkiConnect at:

```text
http://127.0.0.1:8765
```

Anki and AnkiConnect must be running on the same device as the browser. If the app is opened from a Jellyfin server URL, configure AnkiConnect to allow that browser origin.

### AnkiConnect Setup

On desktop Anki, add your Jellyfin server origin to `webCorsOriginList` in the AnkiConnect configuration.

Example:

```json
{
  "apiKey": null,
  "apiLogPath": null,
  "ignoreOriginList": [],
  "webBindAddress": "127.0.0.1",
  "webBindPort": 8765,
  "webCorsOriginList": [
    "http://localhost",
    "null",
    "https://your-jellyfin-server"
  ]
}
```

On AnkiConnect Android, add your Jellyfin server origin to **CORS Host**.

Use the exact origin you open Jellyfin Miner from, including protocol and port if present:

```text
https://your-jellyfin-server
http://your-jellyfin-server:8096
```

In the settings panel, configure:

- Anki note type and fields
- maximum latest-card age
- image format, quality, size, and animation
- audio format, quality, offsets, and filter preset

Jellyfin Miner updates the latest matching Anki note. It does not create new notes.

## Philosophy

A lot of great tools for language learning and media mining exist, but they place the learner in artificial learning environments that they would not use if they weren't actively engaged in language learning. In my opinion, this is an issue. Immersion should be performed in the same environment as leisure media consumption. This plugin fixes that gap - watch shows as you would normally. Only when you want to mine a subtitle do you need to open the plugin interface, and you can do that on any device. Watch on TV, mine on mobile. Watch on desktop, mine on desktop. The choice is yours.
