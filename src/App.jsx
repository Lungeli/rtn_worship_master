import { useEffect, useMemo, useState } from 'react'
import { padEngine } from './audio/PadEngine.js'
import { CROSSFADE_SECONDS, NOTES, allPadUrls, padId } from './audio/keys.js'
import { cachedPadCount, prefetchPads } from './lib/cachePads.js'
import { bindWakeLockResume, requestWakeLock } from './lib/wakeLock.js'
import './App.css'

const QUALITIES = ['Major', 'Minor']

export default function App() {
  const [engine, setEngine] = useState(() => padEngine.getState())
  const [wakeLock, setWakeLock] = useState(false)
  const [quality, setQuality] = useState('Major')
  const [installPrompt, setInstallPrompt] = useState(null)
  const [installed, setInstalled] = useState(false)
  const [cache, setCache] = useState({
    busy: false,
    cached: 0,
    total: allPadUrls().length,
    message: '',
  })

  useEffect(() => padEngine.subscribe(setEngine), [])

  useEffect(() => {
    cachedPadCount().then((cached) => setCache((c) => ({ ...c, cached })))
  }, [])

  useEffect(() => {
    if (!engine.ready) return undefined
    return bindWakeLockResume()
  }, [engine.ready])

  useEffect(() => {
    function onBeforeInstallPrompt(event) {
      event.preventDefault()
      setInstallPrompt(event)
    }
    function onInstalled() {
      setInstallPrompt(null)
      setInstalled(true)
    }
    window.addEventListener('beforeinstallprompt', onBeforeInstallPrompt)
    window.addEventListener('appinstalled', onInstalled)
    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstallPrompt)
      window.removeEventListener('appinstalled', onInstalled)
    }
  }, [])

  async function installApp() {
    if (!installPrompt) return
    installPrompt.prompt()
    await installPrompt.userChoice
    setInstallPrompt(null)
  }

  async function startRig() {
    await padEngine.unlock()
    const locked = await requestWakeLock()
    setWakeLock(locked)
  }

  async function cacheOffline() {
    setCache((c) => ({ ...c, busy: true, message: 'Caching pads…' }))
    try {
      const result = await prefetchPads(({ done, total }) => {
        setCache((c) => ({
          ...c,
          cached: done,
          total,
          message: `Caching ${done}/${total}`,
        }))
      })
      setCache({
        busy: false,
        cached: result.done,
        total: result.total,
        message: 'All 14 pads cached for offline use.',
      })
    } catch (error) {
      setCache((c) => ({
        ...c,
        busy: false,
        message: error.message || 'Cache failed.',
      }))
    }
  }

  const volumePct = Math.round(engine.volume * 100)
  const activeNote = useMemo(() => {
    if (!engine.currentKey) return null
    const [mode, noteId] = engine.currentKey.split(':')
    return { mode, note: NOTES.find((item) => item.id === noteId) }
  }, [engine.currentKey])

  const statusLabel = engine.fadingOut
    ? 'FADING OUT'
    : activeNote
      ? `${activeNote.mode.toUpperCase()} PAD SUSTAIN`
      : 'IDLE'

  const isLive = Boolean(activeNote) && !engine.fadingOut
  const readoutState = engine.fadingOut ? 'FADING OUT' : activeNote ? 'PLAYING' : engine.pendingKey ? 'LOADING' : 'STANDBY'
  const readoutKey = activeNote
    ? `${activeNote.note?.label ?? ''} ${activeNote.mode.toUpperCase()}`
    : 'NO KEY SELECTED'

  const marquee = `RTN WORSHIP MASTER // ACTIVE KEY: ${
    activeNote ? `${activeNote.note?.label ?? ''} ${activeNote.mode.toUpperCase()}` : 'NONE'
  } // CROSSFADE: ${CROSSFADE_SECONDS.toFixed(1)}S FIXED // MASTER VOLUME: ${volumePct}% // ${
    wakeLock ? 'WAKE LOCK ON' : 'WAKE LOCK OFF'
  } // ${cache.cached}/${cache.total} PADS CACHED // `

  return (
    <div className="app">
      {!engine.ready && (
        <div className="gate">
          <div className="gate-card brutalist-deck">
            <div className="gate-body">
              <img className="logo logo-gate" src="/rtn_logo.png" alt="RTN Worship Master" />
              <h1>RTN Worship Master</h1>
              <p className="gate-tagline">Pad Deck</p>
              <p className="lede">Continuous ambient sustain loops across 7 Major and 7 Minor keys.</p>
              <button
                type="button"
                className="transport-btn start-rig"
                onClick={startRig}
                disabled={engine.unlocking}
              >
                {engine.unlocking ? 'Starting…' : 'Start Rig'}
              </button>
              {engine.error && <p className="error">{engine.error}</p>}
            </div>
          </div>
          <footer className="credit">Made by Magical ❤️</footer>
        </div>
      )}

      <div className="brutalist-deck">
        <div className="marquee-wrapper">
          <div className="marquee-content">{marquee}{marquee}</div>
        </div>

        <div className="deck-header">
          <div className="brand-title">
            <img className="brand-logo" src="/rtn_logo.png" alt="" />
            RTN Worship <span className="brand-badge">PAD DECK</span>
          </div>

          <div className="controls-strip">
            {installPrompt && (
              <button type="button" className="install-btn" onClick={installApp}>
                Install App
              </button>
            )}

            <div className="key-controls">
              <div className="segmented-control">
                {QUALITIES.map((q) => (
                  <button
                    key={q}
                    type="button"
                    className={`segmented-btn ${quality === q ? 'active' : ''}`}
                    onClick={() => setQuality(q)}
                  >
                    {q.toUpperCase()}
                  </button>
                ))}
              </div>

              <div className="stepper-group">
                <button
                  type="button"
                  className="stepper-btn"
                  aria-label="Volume down"
                  onClick={() => padEngine.stepVolume(-1)}
                >
                  &minus;
                </button>
                <span className="stepper-label">VOL: {volumePct}%</span>
                <button
                  type="button"
                  className="stepper-btn"
                  aria-label="Volume up"
                  onClick={() => padEngine.stepVolume(1)}
                >
                  +
                </button>
              </div>
            </div>
          </div>
        </div>

        <div className="status-panel">
          <div className="status-row">
            <div className="active-key-display">
              <span className="key-big">{activeNote?.note?.label ?? '—'}</span>
              <span className="quality-sub">{statusLabel}</span>
            </div>
            <div className={`audio-bars ${isLive ? 'live' : ''}`}>
              <div className="bar" />
              <div className="bar" />
              <div className="bar" />
              <div className="bar" />
              <div className="bar" />
            </div>
          </div>

          <div className={`status-readout ${isLive ? 'live' : ''}`}>
            <span className="readout-dot" aria-hidden="true" />
            <span className="readout-text">
              {readoutKey} <em>{readoutState}</em>
            </span>
            {(isLive || engine.fadingOut || engine.pendingKey) && (
              <span className="readout-dots" aria-hidden="true">
                <span className="dot" />
                <span className="dot" />
                <span className="dot" />
              </span>
            )}
          </div>
        </div>

        <div className="pads-grid">
          {NOTES.map((note) => (
            <PadButton
              key={`${quality}-${note.id}`}
              note={note}
              mode={quality.toLowerCase()}
              engine={engine}
              onSelect={() => padEngine.selectKey(quality.toLowerCase(), note)}
            />
          ))}
        </div>

        <div className="transport">
          <button
            type="button"
            className="transport-btn fade-out"
            onClick={() => padEngine.fadeOut()}
            disabled={!engine.currentKey || engine.fadingOut}
          >
            Fade Out
          </button>
          <button
            type="button"
            className="transport-btn stop"
            onClick={() => padEngine.stop()}
            disabled={!engine.currentKey && !engine.pendingKey && !engine.fadingOut}
          >
            Stop
          </button>
        </div>

        <div className="deck-footer">
          <span>MODE: AMBIENT PAD SUSTAIN</span>
          <span>
            {installed ? 'APP INSTALLED' : wakeLock ? 'WAKE LOCK ON' : 'WAKE LOCK OFF'}
          </span>
        </div>
      </div>

      <section className="cache-section brutalist-deck">
        <button type="button" className="transport-btn cache-btn" onClick={cacheOffline} disabled={cache.busy}>
          {cache.busy ? cache.message : 'Cache 14 Pads Offline'}
        </button>
        {cache.message && !cache.busy && <p className="cache-note">{cache.message}</p>}
        {engine.error && <p className="error">{engine.error}</p>}
      </section>

      <footer className="credit">Made by Magical ❤️</footer>
    </div>
  )
}

function PadButton({ note, mode, engine, onSelect }) {
  const id = padId(mode, note.id)
  const active = engine.currentKey === id && !engine.fadingOut
  const pending = engine.pendingKey === id

  return (
    <button
      type="button"
      className={`pad-btn ${active ? 'active' : ''} ${pending ? 'pending' : ''}`}
      onClick={onSelect}
      disabled={!engine.ready}
    >
      <span className="pad-note">{note.label}</span>
      <span className="pad-tag">{mode.slice(0, 3)}</span>
    </button>
  )
}
