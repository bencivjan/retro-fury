// =============================================================================
// audio.js - Procedural audio system for RETRO FURY
// =============================================================================
// Generates ALL sound effects procedurally using the Web Audio API.
// Sounds are synthesised from oscillators, noise buffers, and frequency sweeps
// to produce classic 90s FPS audio.  Every sound is pre-rendered to an
// AudioBuffer during init() so that playback is instantaneous with zero
// synthesis latency.
// =============================================================================

/**
 * @typedef {Object} PlayOptions
 * @property {number} [volume=1]  - Playback volume (0..1).
 * @property {number} [pan=0]     - Stereo pan (-1 = full left, 1 = full right).
 */

export class AudioManager {
    constructor() {
        /** @type {AudioContext|null} */
        this._ctx = null;

        /**
         * Pre-rendered sound buffers keyed by name.
         * @type {Map<string, AudioBuffer>}
         */
        this._buffers = new Map();

        /** @type {GainNode|null} */
        this._masterGain = null;

        /** @type {number} */
        this._masterVolume = 1.0;

        /** @type {boolean} */
        this._muted = false;

        /** @type {boolean} */
        this._initialized = false;
    }

    // -------------------------------------------------------------------------
    // Public API
    // -------------------------------------------------------------------------

    /**
     * Initialise the audio system.  Must be called after a user gesture
     * (click / keydown) to satisfy browser autoplay policies.  Safe to call
     * multiple times; subsequent calls are no-ops.
     */
    async init() {
        if (this._initialized) return;

        try {
            this._ctx = new (window.AudioContext || window.webkitAudioContext)();
        } catch (e) {
            console.warn('[AudioManager] Web Audio API not available:', e);
            return;
        }

        // Resume in case the context was created in a suspended state.
        if (this._ctx.state === 'suspended') {
            await this._ctx.resume();
        }

        this._masterGain = this._ctx.createGain();
        this._masterGain.gain.value = this._masterVolume;
        this._masterGain.connect(this._ctx.destination);

        this._generateAllSounds();
        this._initialized = true;
    }

    /**
     * Play a named sound effect.
     *
     * @param {string} name    - Sound name (e.g. "pistol_fire").
     * @param {PlayOptions} [options]
     */
    play(name, options = {}) {
        if (!this._initialized || !this._ctx || this._muted) return;

        const buffer = this._buffers.get(name);
        if (!buffer) {
            console.warn(`[AudioManager] Unknown sound: "${name}"`);
            return;
        }

        const volume = options.volume !== undefined ? options.volume : 1.0;
        const pan    = options.pan    !== undefined ? options.pan    : 0.0;

        const source = this._ctx.createBufferSource();
        source.buffer = buffer;

        // Per-sound gain
        const gain = this._ctx.createGain();
        gain.gain.value = volume;

        // Stereo panner
        if (pan !== 0 && typeof StereoPannerNode !== 'undefined') {
            const panner = this._ctx.createStereoPanner();
            panner.pan.value = pan;
            source.connect(gain);
            gain.connect(panner);
            panner.connect(this._masterGain);
        } else {
            source.connect(gain);
            gain.connect(this._masterGain);
        }

        source.start(0);
    }

    /**
     * Set the master volume.
     * @param {number} v - 0..1
     */
    setMasterVolume(v) {
        this._masterVolume = Math.max(0, Math.min(1, v));
        if (this._masterGain) {
            this._masterGain.gain.value = this._masterVolume;
        }
    }

    /** Mute all audio output. */
    mute() {
        this._muted = true;
        if (this._masterGain) this._masterGain.gain.value = 0;
    }

    /** Unmute audio output, restoring the previous master volume. */
    unmute() {
        this._muted = false;
        if (this._masterGain) this._masterGain.gain.value = this._masterVolume;
    }

    /**
     * Whether the audio system has been initialised.
     * @returns {boolean}
     */
    get initialized() {
        return this._initialized;
    }

    // -------------------------------------------------------------------------
    // Internal - Sound Generation
    // -------------------------------------------------------------------------

    /** @private */
    _generateAllSounds() {
        const ctx = this._ctx;
        const sr = ctx.sampleRate;

        // -- Weapon sounds --
        this._buffers.set('pistol_fire',     this._genPistolFire(sr));
        this._buffers.set('shotgun_fire',    this._genShotgunFire(sr));
        this._buffers.set('machinegun_fire', this._genMachinegunFire(sr));
        this._buffers.set('rocket_fire',     this._genRocketFire(sr));
        this._buffers.set('plasma_fire',     this._genPlasmaFire(sr));
        this._buffers.set('sniper_fire',     this._genSniperFire(sr));
        this._buffers.set('knife_swing',     this._genKnifeSwing(sr));

        // -- Impacts / explosions --
        this._buffers.set('explosion',       this._genExplosion(sr));

        // -- Enemy sounds --
        this._buffers.set('enemy_alert',     this._genEnemyAlert(sr));
        this._buffers.set('enemy_pain',      this._genEnemyPain(sr));
        this._buffers.set('enemy_death',     this._genEnemyDeath(sr));

        // -- Environment --
        this._buffers.set('door_open',       this._genDoorOpen(sr));

        // -- Pickups --
        this._buffers.set('item_pickup',     this._genItemPickup(sr));
        this._buffers.set('weapon_pickup',   this._genWeaponPickup(sr));
        this._buffers.set('keycard_pickup',  this._genKeycardPickup(sr));

        // -- Objectives --
        this._buffers.set('objective_complete', this._genObjectiveComplete(sr));

        // -- Player feedback --
        this._buffers.set('player_hurt',     this._genPlayerHurt(sr));
        this._buffers.set('player_death',    this._genPlayerDeath(sr));
        this._buffers.set('low_health',      this._genLowHealth(sr));

        // -- Level --
        this._buffers.set('level_complete',  this._genLevelComplete(sr));
    }

    // -------------------------------------------------------------------------
    // Buffer creation helper
    // -------------------------------------------------------------------------

    /**
     * Create a mono AudioBuffer with the given duration in seconds.
     * @private
     */
    _createBuffer(sr, duration) {
        const length = Math.ceil(sr * duration);
        return this._ctx.createBuffer(1, length, sr);
    }

    // -------------------------------------------------------------------------
    // Synthesis building blocks
    // -------------------------------------------------------------------------

    /**
     * Generate white noise into a Float32Array.
     * @private
     */
    _whiteNoise(data, start, end, amplitude) {
        for (let i = start; i < end && i < data.length; i++) {
            data[i] += (Math.random() * 2 - 1) * amplitude;
        }
    }

    /**
     * Write a sine wave into a Float32Array.
     * @private
     */
    _sine(data, sr, start, end, freq, amplitude) {
        const twoPi = Math.PI * 2;
        for (let i = start; i < end && i < data.length; i++) {
            const t = (i - start) / sr;
            data[i] += Math.sin(twoPi * freq * t) * amplitude;
        }
    }

    /**
     * Write a square wave into a Float32Array.
     * @private
     */
    _square(data, sr, start, end, freq, amplitude) {
        const twoPi = Math.PI * 2;
        for (let i = start; i < end && i < data.length; i++) {
            const t = (i - start) / sr;
            data[i] += (Math.sin(twoPi * freq * t) >= 0 ? 1 : -1) * amplitude;
        }
    }

    /**
     * Write a sawtooth wave into a Float32Array.
     * @private
     */
    _sawtooth(data, sr, start, end, freq, amplitude) {
        for (let i = start; i < end && i < data.length; i++) {
            const t = (i - start) / sr;
            const phase = (t * freq) % 1;
            data[i] += (phase * 2 - 1) * amplitude;
        }
    }

    /**
     * Apply an exponential decay envelope starting at a sample index.
     * @private
     */
    _applyDecay(data, start, end, decayRate) {
        for (let i = start; i < end && i < data.length; i++) {
            const t = (i - start) / (end - start);
            data[i] *= Math.exp(-t * decayRate);
        }
    }

    /**
     * Apply a linear fade-out.
     * @private
     */
    _applyFadeOut(data, start, end) {
        const len = end - start;
        for (let i = start; i < end && i < data.length; i++) {
            data[i] *= 1.0 - (i - start) / len;
        }
    }

    /**
     * Apply a linear fade-in.
     * @private
     */
    _applyFadeIn(data, start, end) {
        const len = end - start;
        for (let i = start; i < end && i < data.length; i++) {
            data[i] *= (i - start) / len;
        }
    }

    /**
     * Write a frequency sweep (sine) into a Float32Array.
     * @private
     */
    _freqSweep(data, sr, start, end, freqStart, freqEnd, amplitude) {
        const twoPi = Math.PI * 2;
        const len = end - start;
        let phase = 0;
        for (let i = start; i < end && i < data.length; i++) {
            const t = (i - start) / len;
            const freq = freqStart + (freqEnd - freqStart) * t;
            phase += twoPi * freq / sr;
            data[i] += Math.sin(phase) * amplitude;
        }
    }

    /**
     * Clamp all samples to [-1, 1].
     * @private
     */
    _clampBuffer(data) {
        for (let i = 0; i < data.length; i++) {
            if (data[i] > 1) data[i] = 1;
            else if (data[i] < -1) data[i] = -1;
        }
    }

    // -------------------------------------------------------------------------
    // Individual Sound Generators
    // -------------------------------------------------------------------------

    /**
     * Pistol fire - short sharp pop (square wave, quick decay).
     * @private
     */
    _genPistolFire(sr) {
        const dur = 0.15;
        const buf = this._createBuffer(sr, dur);
        const data = buf.getChannelData(0);
        const len = data.length;

        // Sharp square wave pop
        this._square(data, sr, 0, Math.floor(len * 0.3), 440, 0.5);
        // Noise transient at the start
        this._whiteNoise(data, 0, Math.floor(len * 0.15), 0.6);
        // Quick decay
        this._applyDecay(data, 0, len, 8);
        this._clampBuffer(data);

        return buf;
    }

    /**
     * Shotgun fire - loud blast (noise burst + low sine, longer decay).
     * @private
     */
    _genShotgunFire(sr) {
        const dur = 0.4;
        const buf = this._createBuffer(sr, dur);
        const data = buf.getChannelData(0);
        const len = data.length;

        // Heavy noise burst
        this._whiteNoise(data, 0, Math.floor(len * 0.5), 0.8);
        // Low-end boom
        this._sine(data, sr, 0, Math.floor(len * 0.6), 80, 0.5);
        this._sine(data, sr, 0, Math.floor(len * 0.3), 160, 0.3);
        // Mid crack
        this._square(data, sr, 0, Math.floor(len * 0.1), 300, 0.4);
        // Decay
        this._applyDecay(data, 0, len, 5);
        this._clampBuffer(data);

        return buf;
    }

    /**
     * Machine gun fire - rapid tap (short noise burst, very quick).
     * @private
     */
    _genMachinegunFire(sr) {
        const dur = 0.08;
        const buf = this._createBuffer(sr, dur);
        const data = buf.getChannelData(0);
        const len = data.length;

        // Very short noise
        this._whiteNoise(data, 0, Math.floor(len * 0.4), 0.7);
        // Sharp click
        this._square(data, sr, 0, Math.floor(len * 0.2), 600, 0.4);
        // Very fast decay
        this._applyDecay(data, 0, len, 12);
        this._clampBuffer(data);

        return buf;
    }

    /**
     * Rocket fire - whoosh (rising then falling frequency sweep).
     * @private
     */
    _genRocketFire(sr) {
        const dur = 0.5;
        const buf = this._createBuffer(sr, dur);
        const data = buf.getChannelData(0);
        const len = data.length;
        const mid = Math.floor(len * 0.3);

        // Rising whoosh
        this._freqSweep(data, sr, 0, mid, 100, 600, 0.4);
        // Falling tail
        this._freqSweep(data, sr, mid, len, 600, 80, 0.3);
        // Noise for texture
        this._whiteNoise(data, 0, Math.floor(len * 0.4), 0.25);
        // Low thump at start
        this._sine(data, sr, 0, Math.floor(len * 0.15), 60, 0.5);
        // Overall decay
        this._applyFadeIn(data, 0, Math.floor(len * 0.05));
        this._applyDecay(data, Math.floor(len * 0.3), len, 3);
        this._clampBuffer(data);

        return buf;
    }

    /**
     * Plasma fire - electric zap (high frequency buzz, short).
     * @private
     */
    _genPlasmaFire(sr) {
        const dur = 0.2;
        const buf = this._createBuffer(sr, dur);
        const data = buf.getChannelData(0);
        const len = data.length;

        // High-pitched buzz
        this._sawtooth(data, sr, 0, Math.floor(len * 0.6), 1200, 0.3);
        this._square(data, sr, 0, Math.floor(len * 0.4), 800, 0.2);
        // Electric crackle (modulated noise)
        for (let i = 0; i < Math.floor(len * 0.5); i++) {
            const t = i / sr;
            const mod = Math.sin(Math.PI * 2 * 60 * t); // 60hz modulation
            data[i] += (Math.random() * 2 - 1) * 0.2 * Math.abs(mod);
        }
        // Fast sweep down
        this._freqSweep(data, sr, 0, Math.floor(len * 0.3), 2000, 400, 0.2);
        // Decay
        this._applyDecay(data, 0, len, 6);
        this._clampBuffer(data);

        return buf;
    }

    /**
     * Sniper fire - loud sharp crack with reverb tail.
     * @private
     */
    _genSniperFire(sr) {
        const dur = 0.4;
        const buf = this._createBuffer(sr, dur);
        const data = buf.getChannelData(0);
        const len = data.length;

        // Very sharp noise transient at start
        this._whiteNoise(data, 0, Math.floor(sr * 0.05), 0.9);
        // High frequency square wave pop
        this._square(data, sr, 0, Math.floor(len * 0.2), 800, 0.5);
        // Low boom
        this._sine(data, sr, 0, Math.floor(len * 0.6), 100, 0.4);
        // Long exponential decay (reverb tail)
        this._applyDecay(data, 0, len, 4);
        this._clampBuffer(data);

        return buf;
    }

    /**
     * Knife swing - fast whoosh.
     * @private
     */
    _genKnifeSwing(sr) {
        const dur = 0.12;
        const buf = this._createBuffer(sr, dur);
        const data = buf.getChannelData(0);
        const len = data.length;

        // Frequency sweep from 800 down to 200
        this._freqSweep(data, sr, 0, len, 800, 200, 0.5);
        // Short noise burst
        this._whiteNoise(data, 0, Math.floor(len * 0.4), 0.3);
        // Fast decay
        this._applyDecay(data, 0, len, 10);
        this._clampBuffer(data);

        return buf;
    }

    /**
     * Explosion - low boom (noise + low sine, long decay).
     * @private
     */
    _genExplosion(sr) {
        const dur = 1.0;
        const buf = this._createBuffer(sr, dur);
        const data = buf.getChannelData(0);
        const len = data.length;

        // Heavy noise
        this._whiteNoise(data, 0, Math.floor(len * 0.6), 0.7);
        // Deep bass boom
        this._sine(data, sr, 0, Math.floor(len * 0.8), 40, 0.6);
        this._sine(data, sr, 0, Math.floor(len * 0.5), 80, 0.4);
        // Sub-bass rumble
        this._sine(data, sr, 0, Math.floor(len * 0.7), 25, 0.3);
        // Mid-range crack at start
        this._whiteNoise(data, 0, Math.floor(len * 0.05), 0.9);
        // Long decay
        this._applyDecay(data, 0, len, 3);
        // Gentle fade-in to avoid click
        this._applyFadeIn(data, 0, Math.floor(len * 0.005));
        this._clampBuffer(data);

        return buf;
    }

    /**
     * Enemy alert - grunt sound (low frequency blip).
     * @private
     */
    _genEnemyAlert(sr) {
        const dur = 0.2;
        const buf = this._createBuffer(sr, dur);
        const data = buf.getChannelData(0);
        const len = data.length;

        // Low pitched grunt
        this._sine(data, sr, 0, len, 120, 0.4);
        this._sine(data, sr, 0, Math.floor(len * 0.5), 180, 0.2);
        // Slight noise for "gravel"
        this._whiteNoise(data, 0, Math.floor(len * 0.3), 0.15);
        // Shape
        this._applyFadeIn(data, 0, Math.floor(len * 0.1));
        this._applyDecay(data, 0, len, 4);
        this._clampBuffer(data);

        return buf;
    }

    /**
     * Enemy pain - yelp (quick rising pitch).
     * @private
     */
    _genEnemyPain(sr) {
        const dur = 0.18;
        const buf = this._createBuffer(sr, dur);
        const data = buf.getChannelData(0);
        const len = data.length;

        // Rising frequency yelp
        this._freqSweep(data, sr, 0, len, 200, 800, 0.5);
        // Some noise
        this._whiteNoise(data, 0, Math.floor(len * 0.3), 0.15);
        // Quick decay
        this._applyDecay(data, 0, len, 6);
        this._clampBuffer(data);

        return buf;
    }

    /**
     * Enemy death - descending pitch with noise.
     * @private
     */
    _genEnemyDeath(sr) {
        const dur = 0.6;
        const buf = this._createBuffer(sr, dur);
        const data = buf.getChannelData(0);
        const len = data.length;

        // Descending frequency
        this._freqSweep(data, sr, 0, len, 400, 60, 0.4);
        // Noise throughout
        this._whiteNoise(data, 0, Math.floor(len * 0.7), 0.3);
        // Low groan
        this._sine(data, sr, Math.floor(len * 0.2), len, 80, 0.2);
        // Decay
        this._applyDecay(data, 0, len, 3);
        this._clampBuffer(data);

        return buf;
    }

    /**
     * Door open - mechanical slide (ascending noise sweep).
     * @private
     */
    _genDoorOpen(sr) {
        const dur = 0.6;
        const buf = this._createBuffer(sr, dur);
        const data = buf.getChannelData(0);
        const len = data.length;

        // Ascending frequency sweep for mechanical slide
        this._freqSweep(data, sr, 0, len, 100, 500, 0.3);
        // Metallic noise
        this._whiteNoise(data, 0, Math.floor(len * 0.8), 0.15);
        // Mechanical click at start
        this._square(data, sr, 0, Math.floor(sr * 0.02), 800, 0.5);
        // Thud at end (door hitting stop)
        this._sine(data, sr, Math.floor(len * 0.85), len, 60, 0.3);
        // Shape
        this._applyFadeIn(data, 0, Math.floor(len * 0.05));
        this._applyFadeOut(data, Math.floor(len * 0.7), len);
        this._clampBuffer(data);

        return buf;
    }

    /**
     * Item pickup - positive chime (ascending two notes).
     * @private
     */
    _genItemPickup(sr) {
        const dur = 0.25;
        const buf = this._createBuffer(sr, dur);
        const data = buf.getChannelData(0);
        const len = data.length;
        const half = Math.floor(len * 0.5);

        // Note 1: C5
        this._sine(data, sr, 0, half, 523, 0.3);
        this._sine(data, sr, 0, half, 1046, 0.1); // octave harmonic
        // Note 2: E5
        this._sine(data, sr, half, len, 659, 0.3);
        this._sine(data, sr, half, len, 1318, 0.1);
        // Envelope
        this._applyDecay(data, 0, half, 4);
        this._applyDecay(data, half, len, 4);
        this._clampBuffer(data);

        return buf;
    }

    /**
     * Weapon pickup - special chime (three ascending notes).
     * @private
     */
    _genWeaponPickup(sr) {
        const dur = 0.4;
        const buf = this._createBuffer(sr, dur);
        const data = buf.getChannelData(0);
        const len = data.length;
        const third = Math.floor(len / 3);

        // C5 -> E5 -> G5
        this._sine(data, sr, 0, third, 523, 0.3);
        this._sine(data, sr, 0, third, 1046, 0.1);

        this._sine(data, sr, third, third * 2, 659, 0.3);
        this._sine(data, sr, third, third * 2, 1318, 0.1);

        this._sine(data, sr, third * 2, len, 784, 0.35);
        this._sine(data, sr, third * 2, len, 1568, 0.12);

        // Envelope per note
        this._applyDecay(data, 0, third, 3);
        this._applyDecay(data, third, third * 2, 3);
        this._applyDecay(data, third * 2, len, 3);
        this._clampBuffer(data);

        return buf;
    }

    /**
     * Keycard pickup - sparkle chime (high oscillating notes).
     * @private
     */
    _genKeycardPickup(sr) {
        const dur = 0.5;
        const buf = this._createBuffer(sr, dur);
        const data = buf.getChannelData(0);
        const len = data.length;

        // Rapid alternating high notes for sparkle effect
        const noteLen = Math.floor(len / 6);
        const freqs = [1047, 1319, 1568, 1319, 1568, 2093]; // C6, E6, G6, E6, G6, C7

        for (let n = 0; n < 6; n++) {
            const start = n * noteLen;
            const end = Math.min(start + noteLen, len);
            this._sine(data, sr, start, end, freqs[n], 0.25);
            this._sine(data, sr, start, end, freqs[n] * 2, 0.08); // shimmer harmonic
            this._applyDecay(data, start, end, 5);
        }

        // Overall fade-out
        this._applyFadeOut(data, Math.floor(len * 0.6), len);
        this._clampBuffer(data);

        return buf;
    }

    /**
     * Objective complete - fanfare (triumphant chord).
     * @private
     */
    _genObjectiveComplete(sr) {
        const dur = 0.8;
        const buf = this._createBuffer(sr, dur);
        const data = buf.getChannelData(0);
        const len = data.length;

        // Major chord: C4, E4, G4 played together
        this._sine(data, sr, 0, len, 262, 0.2);
        this._sine(data, sr, 0, len, 330, 0.2);
        this._sine(data, sr, 0, len, 392, 0.2);
        // Octave reinforcement
        this._sine(data, sr, 0, len, 524, 0.1);
        // Bright attack
        this._square(data, sr, 0, Math.floor(len * 0.05), 524, 0.15);
        // Shape
        this._applyFadeIn(data, 0, Math.floor(len * 0.02));
        this._applyDecay(data, 0, len, 2);
        this._clampBuffer(data);

        return buf;
    }

    /**
     * Player hurt - dull thud.
     * @private
     */
    _genPlayerHurt(sr) {
        const dur = 0.2;
        const buf = this._createBuffer(sr, dur);
        const data = buf.getChannelData(0);
        const len = data.length;

        // Low thud
        this._sine(data, sr, 0, len, 80, 0.5);
        this._sine(data, sr, 0, Math.floor(len * 0.3), 150, 0.3);
        // Impact noise
        this._whiteNoise(data, 0, Math.floor(len * 0.15), 0.4);
        // Fast decay
        this._applyDecay(data, 0, len, 6);
        this._clampBuffer(data);

        return buf;
    }

    /**
     * Player death - long descending buzz.
     * @private
     */
    _genPlayerDeath(sr) {
        const dur = 1.5;
        const buf = this._createBuffer(sr, dur);
        const data = buf.getChannelData(0);
        const len = data.length;

        // Long descending frequency
        this._freqSweep(data, sr, 0, len, 500, 30, 0.3);
        // Buzzing sawtooth layer
        this._sawtooth(data, sr, 0, Math.floor(len * 0.7), 200, 0.15);
        // Noise
        this._whiteNoise(data, 0, Math.floor(len * 0.5), 0.2);
        // Low drone
        this._sine(data, sr, Math.floor(len * 0.3), len, 40, 0.2);
        // Long decay
        this._applyDecay(data, 0, len, 1.5);
        this._clampBuffer(data);

        return buf;
    }

    /**
     * Low health - beep (short sine beep).
     * @private
     */
    _genLowHealth(sr) {
        const dur = 0.12;
        const buf = this._createBuffer(sr, dur);
        const data = buf.getChannelData(0);
        const len = data.length;

        // Clean sine beep
        this._sine(data, sr, 0, len, 880, 0.35);
        // Envelope: quick attack, quick release
        this._applyFadeIn(data, 0, Math.floor(len * 0.05));
        this._applyFadeOut(data, Math.floor(len * 0.7), len);
        this._clampBuffer(data);

        return buf;
    }

    /**
     * Level complete - victory fanfare.
     * @private
     */
    _genLevelComplete(sr) {
        const dur = 1.5;
        const buf = this._createBuffer(sr, dur);
        const data = buf.getChannelData(0);
        const len = data.length;

        // Four-note ascending fanfare: C4, E4, G4, C5
        const noteLen = Math.floor(len / 5);
        const notes = [
            { freq: 262, start: 0 },
            { freq: 330, start: noteLen },
            { freq: 392, start: noteLen * 2 },
            { freq: 523, start: noteLen * 3 },
        ];

        for (const note of notes) {
            const end = Math.min(note.start + noteLen * 2, len);
            this._sine(data, sr, note.start, end, note.freq, 0.2);
            this._sine(data, sr, note.start, end, note.freq * 2, 0.08);
            // Bright square attack
            this._square(data, sr, note.start, Math.min(note.start + Math.floor(noteLen * 0.1), len), note.freq, 0.1);
            this._applyDecay(data, note.start, end, 2);
        }

        // Final sustained major chord
        const chordStart = noteLen * 3;
        this._sine(data, sr, chordStart, len, 262, 0.12);
        this._sine(data, sr, chordStart, len, 330, 0.12);
        this._sine(data, sr, chordStart, len, 392, 0.12);
        this._sine(data, sr, chordStart, len, 523, 0.15);

        // Overall fade-out at the end
        this._applyFadeOut(data, Math.floor(len * 0.75), len);
        this._clampBuffer(data);

        return buf;
    }
}
