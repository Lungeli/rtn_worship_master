import { useEffect, useMemo, useState } from 'react'
import { padEngine } from './audio/PadEngine.js'
import { NOTES, allPadUrls, padId } from './audio/keys.js'
import { cachedPadCount, prefetchPads } from './lib/cachePads.js'
import { bindWakeLockResume, requestWakeLock } from './lib/wakeLock.js'
import './App.css'

export default function App() {
  const [engine, setEngine] = useState(() => padEngine.getState())
  const [wakeLock, setWakeLock] = useState(false)
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
  const nowPlaying = useMemo(() => {
    if (!engine.currentKey) return 'Idle'
    const [mode, noteId] = engine.currentKey.split(':')
    const note = NOTES.find((item) => item.id === noteId)
    return `${note?.label ?? noteId} ${mode}`
  }, [engine.currentKey])

  return (
    <div className="app">
      {!engine.ready && (
        <div className="gate">
          <img className="logo logo-gate" src="/rtn_logo.png" alt="RTN Worship Master" />
          <h1>RTN Worship Master</h1>
          <p className="lede">
            Continuous ambient sustain loops across 7 Major and 7 Minor keys.
        
          </p>
          <button type="button" className="start-rig" onClick={startRig} disabled={engine.unlocking}>
            {engine.unlocking ? 'Starting…' : 'Start Rig'}
          </button>
          {engine.error && <p className="error">{engine.error}</p>}
          <footer className="credit">Made by Magical ❤️</footer>
        </div>
      )}

      <header className="top">
        <div className="brand">
          <img className="logo logo-header" src="/rtn_logo.png" alt="" />
          <div>
            <p className="eyebrow">RTN Worship Master</p>
            <h1>Pad Deck</h1>
          </div>
        </div>
        <div className="status-card">
          <span className={`led ${engine.currentKey && !engine.fadingOut ? 'on' : ''}`} />
          <div>
            <strong>{engine.fadingOut ? 'Fading out' : nowPlaying}</strong>
            <p>
              {wakeLock ? 'Wake lock on' : 'Wake lock off'} · {cache.cached}/{cache.total} cached
            </p>
          </div>
        </div>
      </header>

      <section className="bank">
        <h2>Major</h2>
        <div className="pads">
          {NOTES.map((note) => (
            <PadButton
              key={`major-${note.id}`}
              note={note}
              mode="major"
              engine={engine}
              onSelect={() => padEngine.selectKey('major', note)}
            />
          ))}
        </div>
      </section>

      <section className="bank">
        <h2>Minor</h2>
        <div className="pads">
          {NOTES.map((note) => (
            <PadButton
              key={`minor-${note.id}`}
              note={note}
              mode="minor"
              engine={engine}
              onSelect={() => padEngine.selectKey('minor', note)}
            />
          ))}
        </div>
      </section>

      <section className="mixer card">
        <div className="mixer-head">
          <h2>Master</h2>
          <span>{volumePct}%</span>
        </div>

        <div className="volume-row">
          <button
            type="button"
            className="step"
            aria-label="Volume down"
            onClick={() => padEngine.stepVolume(-1)}
          >
            −
          </button>
          <input
            className="slider"
            type="range"
            min="0"
            max="1"
            step="0.01"
            value={engine.volume}
            onChange={(event) => padEngine.setVolume(Number(event.target.value))}
            aria-label="Master volume"
          />
          <button
            type="button"
            className="step"
            aria-label="Volume up"
            onClick={() => padEngine.stepVolume(1)}
          >
            +
          </button>
        </div>

        <div className="actions">
          <div className="transport">
            <button
              type="button"
              className="fade-out"
              onClick={() => padEngine.fadeOut()}
              disabled={!engine.currentKey || engine.fadingOut}
            >
              Fade out
            </button>
            <button
              type="button"
              className="stop"
              onClick={() => padEngine.stop()}
              disabled={!engine.currentKey && !engine.pendingKey && !engine.fadingOut}
            >
              Stop
            </button>
          </div>
          <button type="button" className="cache-btn" onClick={cacheOffline} disabled={cache.busy}>
            {cache.busy ? cache.message : 'Cache 14 pads offline'}
          </button>
        </div>
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
      className={`pad ${active ? 'active' : ''} ${pending ? 'pending' : ''}`}
      onClick={onSelect}
      disabled={!engine.ready}
    >
      <span className="pad-led" />
      <span className="pad-note">{note.label}</span>
      <span className="pad-mode">{mode}</span>
    </button>
  )
}
