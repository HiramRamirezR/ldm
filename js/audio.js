;(function() {
  const AudioFX = {
    _ctx: null,
    _muted: Store ? Store.get('soundMuted', false) : false,

    _getCtx() {
      if (!this._ctx) {
        try { this._ctx = new (window.AudioContext || window.webkitAudioContext)() }
        catch { return null }
      }
      if (this._ctx.state === 'suspended') this._ctx.resume()
      return this._ctx
    },

    _note(freq, duration, type, gainVal) {
      const ctx = this._getCtx()
      if (!ctx) return
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.type = type || 'sine'
      osc.frequency.value = freq
      gain.gain.setValueAtTime(gainVal || 0.15, ctx.currentTime)
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration)
      osc.connect(gain)
      gain.connect(ctx.destination)
      osc.start(ctx.currentTime)
      osc.stop(ctx.currentTime + duration)
    },

    badge() {
      if (this._muted) return
      const ctx = this._getCtx()
      if (!ctx) return
      const t = ctx.currentTime
      // C5 → E5 → G5 fanfare con armónico
      for (const [freq, time] of [[523, 0], [659, 0.12], [784, 0.24]]) {
        const osc = ctx.createOscillator()
        const gain = ctx.createGain()
        osc.type = 'sine'
        osc.frequency.value = freq
        gain.gain.setValueAtTime(0.12, t + time)
        gain.gain.exponentialRampToValueAtTime(0.001, t + time + 0.4)
        osc.connect(gain)
        gain.connect(ctx.destination)
        osc.start(t + time)
        osc.stop(t + time + 0.4)
        // Armónico suave
        const osc2 = ctx.createOscillator()
        const gain2 = ctx.createGain()
        osc2.type = 'triangle'
        osc2.frequency.value = freq * 2
        gain2.gain.setValueAtTime(0.04, t + time)
        gain2.gain.exponentialRampToValueAtTime(0.001, t + time + 0.3)
        osc2.connect(gain2)
        gain2.connect(ctx.destination)
        osc2.start(t + time)
        osc2.stop(t + time + 0.3)
      }
    },

    streak() {
      if (this._muted) return
      this._note(880, 0.15, 'sine', 0.1)
    },

    complete() {
      if (this._muted) return
      const ctx = this._getCtx()
      if (!ctx) return
      const t = ctx.currentTime
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.type = 'sine'
      osc.frequency.setValueAtTime(523, t)
      osc.frequency.exponentialRampToValueAtTime(1047, t + 0.3)
      gain.gain.setValueAtTime(0.1, t)
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.4)
      osc.connect(gain)
      gain.connect(ctx.destination)
      osc.start(t)
      osc.stop(t + 0.4)
    },

    toggle() {
      this._muted = !this._muted
      Store.set('soundMuted', this._muted)
      if (!this._muted) this.streak()
      return !this._muted
    },

    isMuted() { return this._muted }
  }

  window.AudioFX = AudioFX
})()
