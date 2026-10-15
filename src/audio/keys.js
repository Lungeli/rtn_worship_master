export const NOTES = [
  { id: 'C', file: 'C.mp3', label: 'C' },
  { id: 'D', file: 'D.mp3', label: 'D' },
  { id: 'E', file: 'E.mp3', label: 'E' },
  { id: 'F', file: 'F.mp3', label: 'F' },
  { id: 'G', file: 'G.mp3', label: 'G' },
  { id: 'A', file: 'A.mp3', label: 'A' },
  { id: 'B', file: 'B.mp3', label: 'B' },
]

export const MODES = ['major', 'minor']

// Fixed, non-configurable transition timings — no UI exposes these.
export const CROSSFADE_SECONDS = 2.0
export const FADE_OUT_SECONDS = 5.0
export const VOLUME_STEP = 0.05
export const AUDIO_CACHE = 'rtn-worship-pads-v1'

export function padUrl(mode, file) {
  return `/audio/${mode}/${file}`
}

export function padId(mode, noteId) {
  return `${mode}:${noteId}`
}

export function allPadUrls() {
  return MODES.flatMap((mode) => NOTES.map((note) => padUrl(mode, note.file)))
}
