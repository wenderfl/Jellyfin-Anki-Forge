<div align="center">
  <img src="logo.png" alt="Jellyfin Anki Forge Logo" width="150" />

  # Jellyfin Anki Forge

  **Mine vocabulary from your couch. Sync directly to Anki.**

  [![Jellyfin](https://img.shields.io/badge/Jellyfin-10.11.9+-8A2BE2?logo=jellyfin&logoColor=white)](#)
  [![AnkiConnect](https://img.shields.io/badge/AnkiConnect-Ready-blue?logo=anki&logoColor=white)](#)
  [![Fork](https://img.shields.io/badge/Forked_from-friedrich--de-lightgrey)](#)
</div>

<br />

> **Note**: This is a modified fork of the original [jellyfin-subtitleminer](https://github.com/friedrich-de/jellyfin-subtitleminer) project by `friedrich-de` (originally named Jellyfin Miner). This fork alters the AnkiConnect behavior to **always create new notes** instead of modifying the most recent one.

Watch on any Jellyfin client (TV, mobile, web) and create media Anki cards on any Yomitan client (desktop, mobile) - finally making mining media from your couch a reality!

https://github.com/user-attachments/assets/53bc0616-00ec-4f39-9e75-83e54fddaeb1

---

## <img src="https://img.icons8.com/color/48/sparkling.png" width="24" height="24" align="center" /> Features

- **Seamless Integration:** Extracts subtitle cues and their corresponding screenshots and audio clips from your media directly within Jellyfin.
- **1-Click Anki Cards:** Automatically maps sentence, audio, image, and the media source title to your Anki fields.
- **Always Fresh:** Creates a *brand new note* in Anki for each mining action, perfect for batch mining vocabulary.
---

## <img src="https://img.icons8.com/color/48/download--v1.png" width="24" height="24" align="center" /> Installation

### Prerequisites
- **Jellyfin server** `10.11.9` or newer
- **Anki** with the **AnkiConnect** add-on installed

### Manual Install
1. Download the latest plugin `.zip` from the GitHub Releases page of this fork.
2. Extract the `Jellyfin Miner/` folder into your Jellyfin `plugins/` directory.
3. Restart Jellyfin.

**Folder Structure Expected:**
```text
plugins/
  └── Jellyfin Miner/
      ├── Jellyfin.Plugin.JellyfinMiner.dll
      ├── meta.json
      └── wwwroot/
```

---

## <img src="https://img.icons8.com/color/48/monitor--v1.png" width="24" height="24" align="center" /> Usage

1. Start playing any media in Jellyfin.
2. Open the **Jellyfin Anki Forge** UI (`https://your-jellyfin-server/Plugins/JellyfinMiner/`).
3. Sign in with your Jellyfin account.
4. Select the active stream from the sidebar and pick your subtitle track.
5. Click on subtitle cues to select a single cue or a contiguous range.
6. Use the action bar to preview screenshots/audio, or hit **Add to Anki** to instantly forge a flashcard!

> **Note:** The plugin communicates with AnkiConnect at `http://127.0.0.1:8765`. Anki must be running on the same device as the browser you are using to mine.

---

## <img src="https://img.icons8.com/color/48/settings--v1.png" width="24" height="24" align="center" /> AnkiConnect Setup

If you access the plugin from a Jellyfin server URL, you must configure AnkiConnect to allow that browser origin.

### Desktop Anki
Add your Jellyfin server origin to the `webCorsOriginList` in the AnkiConnect configuration.

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
    "https://your-jellyfin-server.com"
  ]
}
```

### AnkiConnect Android
Add your Jellyfin server origin to the **CORS Host** setting. Make sure to use the exact origin, including protocol and port (e.g., `http://your-jellyfin-server:8096`).

### Plugin Configuration
Inside the Jellyfin Anki Forge settings panel, you can configure:
- **Anki Deck, Note Type, and Field Mappings** (Sentence, Audio, Image, Source).
- **Image Settings:** format, quality, size, and animation.
- **Audio Settings:** format, quality, offsets, and filter presets.


