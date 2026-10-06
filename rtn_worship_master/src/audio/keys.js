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

export const CURVE_STEPS = 64
export const DEFAULT_CROSSFADE = 2
export const MIN_CROSSFADE = 1
export const MAX_CROSSFADE = 10
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

export function equalPowerCurves() {
  const fadeOut = new Float32Array(CURVE_STEPS)
  const fadeIn = new Float32Array(CURVE_STEPS)
  for (let i = 0; i < CURVE_STEPS; i += 1) {
    const t = i / (CURVE_STEPS - 1)
    fadeOut[i] = Math.cos((t * Math.PI) / 2)
    fadeIn[i] = Math.sin((t * Math.PI) / 2)
  }
  return { fadeOut, fadeIn }
}
