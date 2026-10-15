import { CROSSFADE_SECONDS, FADE_OUT_SECONDS, VOLUME_STEP, padId, padUrl } from './keys.js'

function powerCurve(from, to) {
  const curve = new Float32Array(64)
  const start = Math.acos(clamp(from, 0, 1))
  const end = Math.acos(clamp(to, 0, 1))
  for (let i = 0; i < curve.length; i += 1) {
    const t = i / (curve.length - 1)
    curve[i] = Math.cos(start + (end - start) * t)
  }
  curve[curve.length - 1] = to
  return curve
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value))
}

class PadEngine {
  constructor() {
    this.ctx = null
    this.master = null
    this.fadeGain = null
    this.slots = [this.#emptySlot(), this.#emptySlot()]
    this.activeSlot = 0
    this.buffers = new Map()
    this.loads = new Map()
    this.transitionId = 0
    this.listeners = new Set()
    this.connected = false
    this.interruptBound = false
    this.state = {
      ready: false,
      unlocking: false,
      currentKey: null,
      pendingKey: null,
      volume: 0.85,
      fadingOut: false,
      error: '',
    }
  }

  subscribe(listener) {
    this.listeners.add(listener)
    listener(this.state)
    return () => this.listeners.delete(listener)
  }

  getState() {
    return this.state
  }

  async unlock() {
    if (this.state.ready || this.state.unlocking) return
    this.#patch({ unlocking: true, error: '' })
    try {
      const Ctx = window.AudioContext || window.webkitAudioContext
      this.ctx = this.ctx || new Ctx()
      this.master = this.master || this.ctx.createGain()
      this.fadeGain = this.fadeGain || this.ctx.createGain()
      this.master.gain.setValueAtTime(this.state.volume, this.ctx.currentTime)
      this.fadeGain.gain.setValueAtTime(1, this.ctx.currentTime)
      if (!this.connected) {
        this.master.connect(this.fadeGain)
        this.fadeGain.connect(this.ctx.destination)
        this.connected = true
      }
      if (this.ctx.state === 'suspended') await this.ctx.resume()
      this.#bindAudioResume()
      this.#patch({ ready: true, unlocking: false })
    } catch (error) {
      this.#patch({
        unlocking: false,
        error: error.message || 'Could not start audio.',
      })
    }
  }

  setVolume(value) {
    const volume = clamp(value, 0, 1)
    if (this.master && this.ctx) {
      this.master.gain.cancelScheduledValues(this.ctx.currentTime)
      this.master.gain.setTargetAtTime(volume, this.ctx.currentTime, 0.03)
    }
    this.#patch({ volume })
  }

  stepVolume(direction) {
    this.setVolume(this.state.volume + direction * VOLUME_STEP)
  }

  async selectKey(mode, note) {
    if (!this.state.ready) return
    const key = padId(mode, note.id)
    if (this.state.currentKey === key && !this.state.fadingOut) return
    if (this.state.pendingKey === key) return

    const id = ++this.transitionId
    this.#patch({ pendingKey: key, fadingOut: false, error: '' })

    try {
      if (this.ctx.state === 'suspended') await this.ctx.resume()
      const buffer = await this.#load(padUrl(mode, note.file))
      if (id !== this.transitionId) return

      this.fadeGain.gain.cancelScheduledValues(this.ctx.currentTime)
      this.fadeGain.gain.setValueAtTime(
        Math.max(this.fadeGain.gain.value, 0.0001),
        this.ctx.currentTime,
      )
      this.fadeGain.gain.linearRampToValueAtTime(1, this.ctx.currentTime + 0.05)

      const nextIndex = 1 - this.activeSlot
      this.#stopSlot(nextIndex)
      this.#startSlot(nextIndex, buffer, key)

      const now = this.ctx.currentTime
      const duration = CROSSFADE_SECONDS
      const current = this.slots[this.activeSlot]
      const next = this.slots[nextIndex]

      if (!current.source) {
        next.gain.gain.setValueAtTime(1, now)
      } else {
        current.gain.gain.cancelScheduledValues(now)
        next.gain.gain.cancelScheduledValues(now)
        const fromOut = clamp(current.gain.gain.value, 0.0001, 1)
        const fromIn = clamp(next.gain.gain.value, 0.0001, 1)
        current.gain.gain.setValueAtTime(fromOut, now)
        next.gain.gain.setValueAtTime(fromIn, now)
        current.gain.gain.setValueCurveAtTime(powerCurve(fromOut, 0), now, duration)
        next.gain.gain.setValueCurveAtTime(powerCurve(fromIn, 1), now, duration)
        const stopAt = now + duration
        const oldSource = current.source
        oldSource.stop(stopAt + 0.05)
        window.setTimeout(() => {
          if (current.source === oldSource) current.source = null
        }, (duration + 0.08) * 1000)
      }

      this.activeSlot = nextIndex
      this.#patch({ currentKey: key, pendingKey: null })
    } catch (error) {
      if (id !== this.transitionId) return
      this.#patch({
        pendingKey: null,
        error: error.message || 'Failed to load pad.',
      })
    }
  }

  async fadeOut() {
    if (!this.state.ready || this.state.fadingOut) return
    const playing = this.slots.some((slot) => slot.source)
    if (!playing && !this.state.currentKey && !this.state.pendingKey) return

    const id = ++this.transitionId
    this.#patch({ fadingOut: playing, pendingKey: null, error: '' })

    if (!playing) {
      this.#patch({ fadingOut: false, currentKey: null, pendingKey: null })
      return
    }

    const duration = FADE_OUT_SECONDS
    const now = this.ctx.currentTime
    this.fadeGain.gain.cancelScheduledValues(now)
    this.fadeGain.gain.setValueAtTime(this.fadeGain.gain.value, now)
    this.fadeGain.gain.linearRampToValueAtTime(0, now + duration)

    await new Promise((resolve) => window.setTimeout(resolve, duration * 1000))
    if (id !== this.transitionId) return

    this.slots.forEach((_, index) => this.#stopSlot(index))
    this.fadeGain.gain.cancelScheduledValues(this.ctx.currentTime)
    this.fadeGain.gain.setValueAtTime(1, this.ctx.currentTime)
    this.#patch({ fadingOut: false, currentKey: null, pendingKey: null })
  }

  stop() {
    if (!this.state.ready) return
    this.transitionId += 1
    this.slots.forEach((_, index) => this.#stopSlot(index))
    if (this.fadeGain && this.ctx) {
      this.fadeGain.gain.cancelScheduledValues(this.ctx.currentTime)
      this.fadeGain.gain.setValueAtTime(1, this.ctx.currentTime)
    }
    this.#patch({ fadingOut: false, currentKey: null, pendingKey: null, error: '' })
  }

  async #load(url) {
    if (this.buffers.has(url)) return this.buffers.get(url)
    if (this.loads.has(url)) return this.loads.get(url)

    const job = fetch(url)
      .then((response) => {
        if (!response.ok) throw new Error(`Missing pad: ${url}`)
        return response.arrayBuffer()
      })
      .then((data) => this.ctx.decodeAudioData(data.slice(0)))
      .then((buffer) => {
        this.buffers.set(url, buffer)
        this.loads.delete(url)
        return buffer
      })
      .catch((error) => {
        this.loads.delete(url)
        throw error
      })

    this.loads.set(url, job)
    return job
  }

  #emptySlot() {
    return { source: null, gain: null, key: null }
  }

  #startSlot(index, buffer, key) {
    const gain = this.ctx.createGain()
    gain.gain.setValueAtTime(0.0001, this.ctx.currentTime)
    gain.connect(this.master)
    this.slots[index] = { source: null, gain, key }
    this.#spawnLoopingSource(index, buffer, key)
  }

  #spawnLoopingSource(index, buffer, key) {
    const slot = this.slots[index]
    if (!slot?.gain || slot.key !== key) return

    const source = this.ctx.createBufferSource()
    source.buffer = buffer
    source.loop = true
    if (Number.isFinite(buffer.duration) && buffer.duration > 0) {
      source.loopStart = 0
      source.loopEnd = buffer.duration
    }
    source.connect(slot.gain)
    source.onended = () => {
      if (this.slots[index].source !== source) return
      if (this.slots[index].key !== key) return
      this.#spawnLoopingSource(index, buffer, key)
    }
    source.start()
    slot.source = source
  }

  #stopSlot(index) {
    const slot = this.slots[index]
    const source = slot.source
    slot.source = null
    slot.key = null
    if (source) {
      source.onended = null
      try {
        source.stop()
      } catch {
        /* already stopped */
      }
      source.disconnect()
    }
    if (slot.gain) slot.gain.disconnect()
    this.slots[index] = this.#emptySlot()
  }

  #bindAudioResume() {
    if (this.interruptBound) return
    this.interruptBound = true
    const resume = () => {
      if (this.ctx?.state === 'suspended') this.ctx.resume()
    }
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') resume()
    })
    window.addEventListener('focus', resume)
  }

  #patch(partial) {
    this.state = { ...this.state, ...partial }
    this.listeners.forEach((listener) => listener(this.state))
  }
}

export const padEngine = new PadEngine()
