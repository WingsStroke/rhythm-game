# Audio Files

Place your song file here as `song.mp3`.

The game automatically detects this file and uses it instead of the
procedural synthesizer. If the file is missing, the game falls back
to procedural audio.

Supported formats: MP3, WAV, OGG, M4A (anything the browser can decode).

The BPM is currently set to 128 in `src/game/createPrototypeLevel.ts`.
When you add a song with a different BPM, update that value so the
beatmap and beat detection stay in sync.
