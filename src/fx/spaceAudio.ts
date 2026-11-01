/** Lightweight procedural thruster / approach cues via Web Audio. */

export type SpaceAudio = {
  setThrust: (amount: number) => void
  readonly muted: boolean
  setMuted: (muted: boolean) => void
  toggleMuted: () => boolean
  /** Call from a click/key so browsers allow playback. */
  unlock: () => void
  dispose: () => void
}

function createNoiseBuffer(ctx: AudioContext, seconds = 2): AudioBuffer {
  const rate = ctx.sampleRate
  const length = Math.floor(rate * seconds)
  const buffer = ctx.createBuffer(1, length, rate)
  const data = buffer.getChannelData(0)
  // Pink-ish noise (audible rumble on laptop speakers; pure brown is too quiet/sub)
  let b0 = 0
  let b1 = 0
  let b2 = 0
  for (let i = 0; i < length; i++) {
    const white = Math.random() * 2 - 1
    b0 = 0.99765 * b0 + white * 0.099046
    b1 = 0.963 * b1 + white * 0.2965164
    b2 = 0.99 * b2 + white * 1.0526913
    data[i] = (b0 + b1 + b2 + white * 0.1848) * 0.35
  }
  return buffer
}

export function createSpaceAudio(): SpaceAudio {
  let ctx: AudioContext | null = null
  let thrustMaster: GainNode | null = null
  let rumbleFilter: BiquadFilterNode | null = null
  let noiseSource: AudioBufferSourceNode | null = null
  let subA: OscillatorNode | null = null
  let subB: OscillatorNode | null = null
  let mid: OscillatorNode | null = null
  let lfo: OscillatorNode | null = null
  let muted = false
  let lastThrust = 0

  const ensure = () => {
    if (ctx) return ctx
    const AC =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
    ctx = new AC()

    thrustMaster = ctx.createGain()
    thrustMaster.gain.value = 0
    // Soft clip / glue so we can push levels without harsh peaks
    const compressor = ctx.createDynamicsCompressor()
    compressor.threshold.value = -18
    compressor.knee.value = 12
    compressor.ratio.value = 3.5
    compressor.attack.value = 0.01
    compressor.release.value = 0.2
    thrustMaster.connect(compressor)
    compressor.connect(ctx.destination)

    const subMix = ctx.createGain()
    subMix.gain.value = 1
    subMix.connect(thrustMaster)

    // Keep fundamentals in the ~55–90 Hz band so small speakers still hear them
    subA = ctx.createOscillator()
    subA.type = 'sine'
    subA.frequency.value = 58
    const subAGain = ctx.createGain()
    subAGain.gain.value = 1.2
    subA.connect(subAGain)
    subAGain.connect(subMix)
    subA.start()

    subB = ctx.createOscillator()
    subB.type = 'triangle'
    subB.frequency.value = 87
    const subBGain = ctx.createGain()
    subBGain.gain.value = 0.75
    subB.connect(subBGain)
    subBGain.connect(subMix)
    subB.start()

    // Mid growl so it reads as an engine on laptop speakers
    mid = ctx.createOscillator()
    mid.type = 'sawtooth'
    mid.frequency.value = 116
    const midFilter = ctx.createBiquadFilter()
    midFilter.type = 'lowpass'
    midFilter.frequency.value = 320
    const midGain = ctx.createGain()
    midGain.gain.value = 0.35
    mid.connect(midFilter)
    midFilter.connect(midGain)
    midGain.connect(subMix)
    mid.start()

    rumbleFilter = ctx.createBiquadFilter()
    rumbleFilter.type = 'lowpass'
    rumbleFilter.frequency.value = 360
    rumbleFilter.Q.value = 0.85
    const rumbleGain = ctx.createGain()
    rumbleGain.gain.value = 1.8
    rumbleFilter.connect(rumbleGain)
    rumbleGain.connect(thrustMaster)

    noiseSource = ctx.createBufferSource()
    noiseSource.buffer = createNoiseBuffer(ctx)
    noiseSource.loop = true
    noiseSource.connect(rumbleFilter)
    noiseSource.start()

    lfo = ctx.createOscillator()
    lfo.type = 'sine'
    lfo.frequency.value = 0.4
    const lfoGain = ctx.createGain()
    lfoGain.gain.value = 40
    lfo.connect(lfoGain)
    lfoGain.connect(rumbleFilter.frequency)
    lfo.start()

    return ctx
  }

  const resume = () => {
    try {
      ensure()
      if (ctx?.state === 'suspended') void ctx.resume()
    } catch {
      /* ignore */
    }
  }

  const applyThrust = (amount: number) => {
    if (!thrustMaster || !ctx || !rumbleFilter || !subA || !subB || !mid) return
    const a = muted ? 0 : Math.min(1, Math.max(0, amount))
    thrustMaster.gain.setTargetAtTime(a * 0.28, ctx.currentTime, 0.05)
    rumbleFilter.frequency.setTargetAtTime(260 + a * 220, ctx.currentTime, 0.1)
    subA.frequency.setTargetAtTime(55 + a * 10, ctx.currentTime, 0.12)
    subB.frequency.setTargetAtTime(82 + a * 14, ctx.currentTime, 0.12)
    mid.frequency.setTargetAtTime(110 + a * 36, ctx.currentTime, 0.12)
  }

  return {
    unlock: resume,
    get muted() {
      return muted
    },
    setMuted(next: boolean) {
      muted = next
      applyThrust(lastThrust)
    },
    toggleMuted() {
      muted = !muted
      applyThrust(lastThrust)
      return muted
    },
    setThrust(amount: number) {
      resume()
      lastThrust = amount
      applyThrust(amount)
    },
    dispose() {
      try {
        noiseSource?.stop()
        subA?.stop()
        subB?.stop()
        mid?.stop()
        lfo?.stop()
        void ctx?.close()
      } catch {
        /* ignore */
      }
      ctx = null
      thrustMaster = null
      rumbleFilter = null
      noiseSource = null
      subA = null
      subB = null
      mid = null
      lfo = null
    },
  }
}
