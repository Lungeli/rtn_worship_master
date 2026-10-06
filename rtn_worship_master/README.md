# RTN Worship Master

Mobile-first PWA pad rig for stage musicians. Plays looping ambient sustain pads across 7 Major and 7 Minor keys (C, D, E, F, G, A, B).

## Run

```bash
npm install
npm run dev
```

## Audio

Place the 14 MP3 pads here:

- `public/audio/major/C.mp3` … `B.mp3`
- `public/audio/minor/C.mp3` … `B.mp3`

Each pad should be a ~5 minute file. The Web Audio engine loops it until Stop (fade out) or another key is selected.

## Build

```bash
npm run build
npm run preview
```
