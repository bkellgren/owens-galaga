/**
 * Procedural Audio System for Owen's Galaga
 *
 * All sounds synthesized via Web Audio API — no external audio files.
 * Provides SFX and a dynamic layered chiptune soundtrack.
 *
 * Usage:
 *   const audio = new AudioManager();
 *   audio.play('shoot');
 *   audio.startMusic('game');
 *   audio.setMusicIntensity(2); // layer up for boss fights
 */

export class AudioManager {
    constructor() {
        this.ctx = null;       // AudioContext — created on first user interaction
        this.masterGain = null;
        this.sfxGain = null;
        this.musicGain = null;
        this.enabled = true;
        this.musicEnabled = true;
        this.musicPlaying = false;
        this.currentTrack = null;
        this.intensity = 1;    // Music intensity layer (1=calm, 2=action, 3=boss)
        this.musicNodes = [];  // Active oscillators/intervals for cleanup

        this.sfxVolume = 0.35;
        this.musicVolume = 0.18;
    }

    /** Initialize AudioContext on first user gesture */
    init() {
        if (this.ctx) return;
        try {
            this.ctx = new (window.AudioContext || window.webkitAudioContext)();
            this.masterGain = this.ctx.createGain();
            this.masterGain.connect(this.ctx.destination);

            this.sfxGain = this.ctx.createGain();
            this.sfxGain.gain.value = this.sfxVolume;
            this.sfxGain.connect(this.masterGain);

            this.musicGain = this.ctx.createGain();
            this.musicGain.gain.value = this.musicVolume;
            this.musicGain.connect(this.masterGain);
        } catch (e) {
            console.warn('Web Audio not available:', e);
            this.enabled = false;
        }
    }

    /** Ensure context is running (browsers suspend until user gesture) */
    resume() {
        if (this.ctx && this.ctx.state === 'suspended') {
            this.ctx.resume();
        }
    }

    // ─── SFX ──────────────────────────────────────────────────────

    play(name) {
        if (!this.enabled || !this.ctx) return;
        this.resume();

        const t = this.ctx.currentTime;
        switch (name) {
            case 'shoot':       this._shoot(t); break;
            case 'charged_shot': this._chargedShot(t); break;
            case 'enemy_hit':   this._enemyHit(t); break;
            case 'enemy_kill':  this._enemyKill(t); break;
            case 'player_hit':  this._playerHit(t); break;
            case 'explosion':   this._explosion(t); break;
            case 'powerup':     this._powerup(t); break;
            case 'bomb':        this._bomb(t); break;
            case 'boss_warning': this._bossWarning(t); break;
            case 'boss_kill':   this._bossKill(t); break;
            case 'extra_life':  this._extraLife(t); break;
            case 'menu_select': this._menuSelect(t); break;
            case 'menu_move':   this._menuMove(t); break;
            case 'combo':       this._combo(t); break;
            case 'wave_start':  this._waveStart(t); break;
            case 'game_over':   this._gameOver(t); break;
            case 'tractor_beam': this._tractorBeam(t); break;
            case 'rescue':      this._rescue(t); break;
            case 'pause':       this._pause(t); break;
            case 'pokeball_throw': this._pokeballThrow(t); break;
            case 'pokemon_summon': this._pokemonSummon(t); break;
            case 'pokemon_fire':  this._pokemonFire(t); break;
            case 'pokemon_leaf':  this._pokemonLeaf(t); break;
            case 'pokemon_water': this._pokemonWater(t); break;
        }
    }

    _shoot(t) {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'square';
        osc.frequency.setValueAtTime(880, t);
        osc.frequency.exponentialRampToValueAtTime(440, t + 0.06);
        gain.gain.setValueAtTime(0.15, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.08);
        osc.connect(gain).connect(this.sfxGain);
        osc.start(t);
        osc.stop(t + 0.08);
    }

    _chargedShot(t) {
        // Beefy layered beam sound
        [660, 880, 1320].forEach((freq, i) => {
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();
            osc.type = i === 0 ? 'sawtooth' : 'square';
            osc.frequency.setValueAtTime(freq, t);
            osc.frequency.exponentialRampToValueAtTime(freq * 0.5, t + 0.25);
            gain.gain.setValueAtTime(0.1, t);
            gain.gain.exponentialRampToValueAtTime(0.001, t + 0.3);
            osc.connect(gain).connect(this.sfxGain);
            osc.start(t);
            osc.stop(t + 0.3);
        });
    }

    _enemyHit(t) {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'square';
        osc.frequency.setValueAtTime(200, t);
        osc.frequency.exponentialRampToValueAtTime(100, t + 0.04);
        gain.gain.setValueAtTime(0.12, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.05);
        osc.connect(gain).connect(this.sfxGain);
        osc.start(t);
        osc.stop(t + 0.05);
    }

    _enemyKill(t) {
        // Quick burst noise
        const noise = this._createNoise(0.12);
        const gain = this.ctx.createGain();
        const filter = this.ctx.createBiquadFilter();
        filter.type = 'bandpass';
        filter.frequency.setValueAtTime(2000, t);
        filter.frequency.exponentialRampToValueAtTime(200, t + 0.12);
        filter.Q.value = 2;
        gain.gain.setValueAtTime(0.18, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.15);
        noise.connect(filter).connect(gain).connect(this.sfxGain);
        noise.start(t);
        noise.stop(t + 0.15);
    }

    _playerHit(t) {
        // Harsh descending buzz
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(400, t);
        osc.frequency.exponentialRampToValueAtTime(80, t + 0.3);
        gain.gain.setValueAtTime(0.25, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.35);
        osc.connect(gain).connect(this.sfxGain);
        osc.start(t);
        osc.stop(t + 0.35);

        // Noise layer
        const noise = this._createNoise(0.2);
        const nGain = this.ctx.createGain();
        nGain.gain.setValueAtTime(0.12, t);
        nGain.gain.exponentialRampToValueAtTime(0.001, t + 0.25);
        noise.connect(nGain).connect(this.sfxGain);
        noise.start(t);
        noise.stop(t + 0.25);
    }

    _explosion(t) {
        const noise = this._createNoise(0.4);
        const gain = this.ctx.createGain();
        const filter = this.ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(3000, t);
        filter.frequency.exponentialRampToValueAtTime(100, t + 0.4);
        gain.gain.setValueAtTime(0.2, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.5);
        noise.connect(filter).connect(gain).connect(this.sfxGain);
        noise.start(t);
        noise.stop(t + 0.5);
    }

    _powerup(t) {
        // Ascending arpeggio
        const notes = [523, 659, 784, 1047]; // C5 E5 G5 C6
        notes.forEach((freq, i) => {
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();
            osc.type = 'square';
            osc.frequency.value = freq;
            const start = t + i * 0.06;
            gain.gain.setValueAtTime(0, start);
            gain.gain.linearRampToValueAtTime(0.12, start + 0.02);
            gain.gain.exponentialRampToValueAtTime(0.001, start + 0.12);
            osc.connect(gain).connect(this.sfxGain);
            osc.start(start);
            osc.stop(start + 0.12);
        });
    }

    _bomb(t) {
        // Deep boom + noise
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(120, t);
        osc.frequency.exponentialRampToValueAtTime(30, t + 0.6);
        gain.gain.setValueAtTime(0.3, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.7);
        osc.connect(gain).connect(this.sfxGain);
        osc.start(t);
        osc.stop(t + 0.7);

        const noise = this._createNoise(0.5);
        const nGain = this.ctx.createGain();
        const filter = this.ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(1500, t);
        filter.frequency.exponentialRampToValueAtTime(60, t + 0.5);
        nGain.gain.setValueAtTime(0.2, t);
        nGain.gain.exponentialRampToValueAtTime(0.001, t + 0.6);
        noise.connect(filter).connect(nGain).connect(this.sfxGain);
        noise.start(t);
        noise.stop(t + 0.6);
    }

    _bossWarning(t) {
        // Ominous descending alarm — two alternating tones
        for (let i = 0; i < 4; i++) {
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();
            osc.type = 'square';
            const freq = i % 2 === 0 ? 440 : 330;
            osc.frequency.value = freq;
            const start = t + i * 0.25;
            gain.gain.setValueAtTime(0.15, start);
            gain.gain.setValueAtTime(0.001, start + 0.2);
            osc.connect(gain).connect(this.sfxGain);
            osc.start(start);
            osc.stop(start + 0.2);
        }
    }

    _bossKill(t) {
        // Big cascading explosion
        for (let i = 0; i < 5; i++) {
            const start = t + i * 0.3;
            const noise = this._createNoise(0.4);
            const gain = this.ctx.createGain();
            const filter = this.ctx.createBiquadFilter();
            filter.type = 'lowpass';
            filter.frequency.setValueAtTime(4000 - i * 600, start);
            filter.frequency.exponentialRampToValueAtTime(80, start + 0.4);
            gain.gain.setValueAtTime(0.15 + i * 0.02, start);
            gain.gain.exponentialRampToValueAtTime(0.001, start + 0.5);
            noise.connect(filter).connect(gain).connect(this.sfxGain);
            noise.start(start);
            noise.stop(start + 0.5);
        }
        // Final deep boom
        const osc = this.ctx.createOscillator();
        const g = this.ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(80, t + 1.2);
        osc.frequency.exponentialRampToValueAtTime(20, t + 2);
        g.gain.setValueAtTime(0.3, t + 1.2);
        g.gain.exponentialRampToValueAtTime(0.001, t + 2.2);
        osc.connect(g).connect(this.sfxGain);
        osc.start(t + 1.2);
        osc.stop(t + 2.2);
    }

    _extraLife(t) {
        // Triumphant ascending arpeggio
        const notes = [392, 494, 587, 784, 988]; // G4 B4 D5 G5 B5
        notes.forEach((freq, i) => {
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();
            osc.type = 'triangle';
            osc.frequency.value = freq;
            const start = t + i * 0.08;
            gain.gain.setValueAtTime(0.15, start);
            gain.gain.exponentialRampToValueAtTime(0.001, start + 0.2);
            osc.connect(gain).connect(this.sfxGain);
            osc.start(start);
            osc.stop(start + 0.2);
        });
    }

    _menuSelect(t) {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'square';
        osc.frequency.setValueAtTime(660, t);
        osc.frequency.setValueAtTime(880, t + 0.06);
        gain.gain.setValueAtTime(0.1, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.12);
        osc.connect(gain).connect(this.sfxGain);
        osc.start(t);
        osc.stop(t + 0.12);
    }

    _menuMove(t) {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'square';
        osc.frequency.value = 440;
        gain.gain.setValueAtTime(0.06, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.04);
        osc.connect(gain).connect(this.sfxGain);
        osc.start(t);
        osc.stop(t + 0.04);
    }

    _combo(t) {
        // Quick pitch-up blip
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'square';
        osc.frequency.setValueAtTime(600, t);
        osc.frequency.exponentialRampToValueAtTime(1200, t + 0.05);
        gain.gain.setValueAtTime(0.08, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.06);
        osc.connect(gain).connect(this.sfxGain);
        osc.start(t);
        osc.stop(t + 0.06);
    }

    _waveStart(t) {
        // Short ascending sweep
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(220, t);
        osc.frequency.exponentialRampToValueAtTime(880, t + 0.2);
        gain.gain.setValueAtTime(0.12, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.3);
        osc.connect(gain).connect(this.sfxGain);
        osc.start(t);
        osc.stop(t + 0.3);
    }

    _gameOver(t) {
        // Sad descending notes
        const notes = [440, 392, 330, 262, 196];
        notes.forEach((freq, i) => {
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();
            osc.type = 'triangle';
            osc.frequency.value = freq;
            const start = t + i * 0.3;
            gain.gain.setValueAtTime(0.15, start);
            gain.gain.exponentialRampToValueAtTime(0.001, start + 0.35);
            osc.connect(gain).connect(this.sfxGain);
            osc.start(start);
            osc.stop(start + 0.35);
        });
    }

    _tractorBeam(t) {
        // Eerie wobbling tone
        const osc = this.ctx.createOscillator();
        const lfo = this.ctx.createOscillator();
        const lfoGain = this.ctx.createGain();
        const gain = this.ctx.createGain();
        osc.type = 'sine';
        osc.frequency.value = 300;
        lfo.type = 'sine';
        lfo.frequency.value = 8;
        lfoGain.gain.value = 50;
        lfo.connect(lfoGain).connect(osc.frequency);
        gain.gain.setValueAtTime(0.12, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.8);
        osc.connect(gain).connect(this.sfxGain);
        osc.start(t);
        lfo.start(t);
        osc.stop(t + 0.8);
        lfo.stop(t + 0.8);
    }

    _rescue(t) {
        // Triumphant little jingle
        const notes = [523, 659, 784]; // C E G
        notes.forEach((freq, i) => {
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();
            osc.type = 'triangle';
            osc.frequency.value = freq;
            const start = t + i * 0.1;
            gain.gain.setValueAtTime(0.12, start);
            gain.gain.exponentialRampToValueAtTime(0.001, start + 0.2);
            osc.connect(gain).connect(this.sfxGain);
            osc.start(start);
            osc.stop(start + 0.2);
        });
    }

    _pause(t) {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'square';
        osc.frequency.value = 220;
        gain.gain.setValueAtTime(0.08, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.1);
        osc.connect(gain).connect(this.sfxGain);
        osc.start(t);
        osc.stop(t + 0.1);
    }

    _pokeballThrow(t) {
        // Whoosh sound
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(300, t);
        osc.frequency.exponentialRampToValueAtTime(800, t + 0.15);
        osc.frequency.exponentialRampToValueAtTime(200, t + 0.3);
        gain.gain.setValueAtTime(0.12, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.35);
        osc.connect(gain).connect(this.sfxGain);
        osc.start(t);
        osc.stop(t + 0.35);
    }

    _pokemonSummon(t) {
        // Magical ascending sparkle
        const notes = [392, 523, 659, 784, 1047]; // G C E G C
        notes.forEach((freq, i) => {
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();
            osc.type = 'triangle';
            osc.frequency.value = freq;
            const start = t + i * 0.07;
            gain.gain.setValueAtTime(0.1, start);
            gain.gain.exponentialRampToValueAtTime(0.001, start + 0.15);
            osc.connect(gain).connect(this.sfxGain);
            osc.start(start);
            osc.stop(start + 0.15);
        });
    }

    _pokemonFire(t) {
        // Crackling fire burst
        const noise = this._createNoise(0.12);
        const gain = this.ctx.createGain();
        const filter = this.ctx.createBiquadFilter();
        filter.type = 'bandpass';
        filter.frequency.setValueAtTime(3000, t);
        filter.frequency.exponentialRampToValueAtTime(500, t + 0.12);
        filter.Q.value = 1;
        gain.gain.setValueAtTime(0.1, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.15);
        noise.connect(filter).connect(gain).connect(this.sfxGain);
        noise.start(t);
        noise.stop(t + 0.15);
    }

    _pokemonLeaf(t) {
        // Quick swish
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(1200, t);
        osc.frequency.exponentialRampToValueAtTime(600, t + 0.08);
        gain.gain.setValueAtTime(0.08, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.1);
        osc.connect(gain).connect(this.sfxGain);
        osc.start(t);
        osc.stop(t + 0.1);
    }

    _pokemonWater(t) {
        // Splashy bubble
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(600, t);
        osc.frequency.exponentialRampToValueAtTime(900, t + 0.06);
        osc.frequency.exponentialRampToValueAtTime(400, t + 0.12);
        gain.gain.setValueAtTime(0.1, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.15);
        osc.connect(gain).connect(this.sfxGain);
        osc.start(t);
        osc.stop(t + 0.15);
    }

    // ─── Noise Helper ─────────────────────────────────────────────

    _createNoise(duration) {
        const sampleRate = this.ctx.sampleRate;
        const length = sampleRate * duration;
        const buffer = this.ctx.createBuffer(1, length, sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < length; i++) {
            data[i] = Math.random() * 2 - 1;
        }
        const source = this.ctx.createBufferSource();
        source.buffer = buffer;
        return source;
    }

    // ─── Music ────────────────────────────────────────────────────

    /**
     * Start a looping background track.
     * @param {'menu'|'game'|'boss'|'bonus'|'gameover'} track
     */
    startMusic(track) {
        if (!this.enabled || !this.ctx || !this.musicEnabled) return;
        this.stopMusic();
        this.resume();
        this.currentTrack = track;
        this.musicPlaying = true;

        switch (track) {
            case 'menu':    this._musicMenu(); break;
            case 'game':    this._musicGame(); break;
            case 'boss':    this._musicBoss(); break;
            case 'bonus':   this._musicBonus(); break;
            case 'gameover': this._musicGameOver(); break;
        }
    }

    stopMusic() {
        this.musicPlaying = false;
        this.currentTrack = null;
        // Clear all music intervals/timeouts
        this.musicNodes.forEach(n => {
            if (n.stop) try { n.stop(); } catch (e) {}
            if (n.clear) clearInterval(n.clear);
        });
        this.musicNodes = [];
    }

    /** Adjust music intensity for dynamic layering (1=normal, 2=intense, 3=boss) */
    setMusicIntensity(level) {
        this.intensity = level;
    }

    // ── Menu Music — gentle arpeggiated loop ──

    _musicMenu() {
        const notes = [262, 330, 392, 523, 392, 330]; // C4 E4 G4 C5 G4 E4
        let idx = 0;
        const playNote = () => {
            if (!this.musicPlaying || this.currentTrack !== 'menu') return;
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();
            osc.type = 'triangle';
            osc.frequency.value = notes[idx % notes.length];
            const t = this.ctx.currentTime;
            gain.gain.setValueAtTime(0.06, t);
            gain.gain.exponentialRampToValueAtTime(0.001, t + 0.4);
            osc.connect(gain).connect(this.musicGain);
            osc.start(t);
            osc.stop(t + 0.4);
            idx++;
        };
        playNote();
        const iv = setInterval(playNote, 400);
        this.musicNodes.push({ clear: iv });
    }

    // ── Game Music — driving bassline + melody layers ──

    _musicGame() {
        // Bassline — looping pattern
        const bassNotes = [131, 131, 165, 165, 175, 175, 147, 147]; // C3 C3 E3 E3 F3 F3 D3 D3
        let bassIdx = 0;

        const playBass = () => {
            if (!this.musicPlaying || this.currentTrack !== 'game') return;
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();
            osc.type = 'square';
            osc.frequency.value = bassNotes[bassIdx % bassNotes.length];
            const t = this.ctx.currentTime;
            gain.gain.setValueAtTime(0.07, t);
            gain.gain.setValueAtTime(0.07, t + 0.15);
            gain.gain.exponentialRampToValueAtTime(0.001, t + 0.22);
            osc.connect(gain).connect(this.musicGain);
            osc.start(t);
            osc.stop(t + 0.22);
            bassIdx++;
        };
        playBass();
        const bassIv = setInterval(playBass, 250);
        this.musicNodes.push({ clear: bassIv });

        // Hi-hat pulse — gives energy
        const playHat = () => {
            if (!this.musicPlaying || this.currentTrack !== 'game') return;
            const noise = this._createNoise(0.03);
            const gain = this.ctx.createGain();
            const filter = this.ctx.createBiquadFilter();
            filter.type = 'highpass';
            filter.frequency.value = 8000;
            const t = this.ctx.currentTime;
            gain.gain.setValueAtTime(0.04, t);
            gain.gain.exponentialRampToValueAtTime(0.001, t + 0.03);
            noise.connect(filter).connect(gain).connect(this.musicGain);
            noise.start(t);
            noise.stop(t + 0.03);
        };
        const hatIv = setInterval(playHat, 125);
        this.musicNodes.push({ clear: hatIv });

        // Melody layer — simple repeating motif
        const melodyNotes = [523, 0, 587, 523, 0, 440, 392, 0, 523, 0, 587, 659, 0, 587, 523, 0]; // C5 rest D5 C5 rest A4 G4 rest...
        let melIdx = 0;

        const playMelody = () => {
            if (!this.musicPlaying || this.currentTrack !== 'game') return;
            const note = melodyNotes[melIdx % melodyNotes.length];
            melIdx++;
            if (note === 0) return; // rest
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();
            osc.type = 'square';
            osc.frequency.value = note;
            const t = this.ctx.currentTime;
            gain.gain.setValueAtTime(0.04, t);
            gain.gain.exponentialRampToValueAtTime(0.001, t + 0.2);
            osc.connect(gain).connect(this.musicGain);
            osc.start(t);
            osc.stop(t + 0.2);
        };
        const melIv = setInterval(playMelody, 250);
        this.musicNodes.push({ clear: melIv });
    }

    // ── Boss Music — urgent, heavier ──

    _musicBoss() {
        const bassNotes = [110, 110, 131, 131, 117, 117, 98, 98]; // A2 A2 C3 C3 Bb2 Bb2 G2 G2
        let bassIdx = 0;

        const playBass = () => {
            if (!this.musicPlaying || this.currentTrack !== 'boss') return;
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();
            osc.type = 'sawtooth';
            osc.frequency.value = bassNotes[bassIdx % bassNotes.length];
            const t = this.ctx.currentTime;
            gain.gain.setValueAtTime(0.09, t);
            gain.gain.exponentialRampToValueAtTime(0.001, t + 0.18);
            osc.connect(gain).connect(this.musicGain);
            osc.start(t);
            osc.stop(t + 0.18);
            bassIdx++;
        };
        playBass();
        const bassIv = setInterval(playBass, 200);
        this.musicNodes.push({ clear: bassIv });

        // Fast hi-hat
        const playHat = () => {
            if (!this.musicPlaying || this.currentTrack !== 'boss') return;
            const noise = this._createNoise(0.02);
            const gain = this.ctx.createGain();
            const filter = this.ctx.createBiquadFilter();
            filter.type = 'highpass';
            filter.frequency.value = 9000;
            const t = this.ctx.currentTime;
            gain.gain.setValueAtTime(0.05, t);
            gain.gain.exponentialRampToValueAtTime(0.001, t + 0.02);
            noise.connect(filter).connect(gain).connect(this.musicGain);
            noise.start(t);
            noise.stop(t + 0.02);
        };
        const hatIv = setInterval(playHat, 100);
        this.musicNodes.push({ clear: hatIv });

        // Tense melody
        const melNotes = [440, 466, 440, 392, 0, 440, 466, 523, 0, 466, 440, 392, 0, 349, 392, 0];
        let melIdx = 0;
        const playMel = () => {
            if (!this.musicPlaying || this.currentTrack !== 'boss') return;
            const note = melNotes[melIdx % melNotes.length];
            melIdx++;
            if (note === 0) return;
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();
            osc.type = 'square';
            osc.frequency.value = note;
            const t = this.ctx.currentTime;
            gain.gain.setValueAtTime(0.05, t);
            gain.gain.exponentialRampToValueAtTime(0.001, t + 0.16);
            osc.connect(gain).connect(this.musicGain);
            osc.start(t);
            osc.stop(t + 0.16);
        };
        const melIv = setInterval(playMel, 200);
        this.musicNodes.push({ clear: melIv });
    }

    // ── Bonus Round Music — upbeat, lighter ──

    _musicBonus() {
        const notes = [523, 587, 659, 784, 659, 587, 523, 440]; // C D E G E D C A
        let idx = 0;
        const play = () => {
            if (!this.musicPlaying || this.currentTrack !== 'bonus') return;
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();
            osc.type = 'triangle';
            osc.frequency.value = notes[idx % notes.length];
            const t = this.ctx.currentTime;
            gain.gain.setValueAtTime(0.06, t);
            gain.gain.exponentialRampToValueAtTime(0.001, t + 0.18);
            osc.connect(gain).connect(this.musicGain);
            osc.start(t);
            osc.stop(t + 0.18);
            idx++;
        };
        play();
        const iv = setInterval(play, 200);
        this.musicNodes.push({ clear: iv });
    }

    // ── Game Over Music — just the SFX jingle, no loop ──

    _musicGameOver() {
        // No looping music — the game_over SFX handles it
    }

    // ─── Volume Controls ──────────────────────────────────────────

    setSfxVolume(v) {
        this.sfxVolume = v;
        if (this.sfxGain) this.sfxGain.gain.value = v;
    }

    setMusicVolume(v) {
        this.musicVolume = v;
        if (this.musicGain) this.musicGain.gain.value = v;
    }

    toggleSfx() {
        this.enabled = !this.enabled;
        return this.enabled;
    }

    toggleMusic() {
        this.musicEnabled = !this.musicEnabled;
        if (!this.musicEnabled) {
            this.stopMusic();
        }
        return this.musicEnabled;
    }

    toggleAll() {
        if (this.enabled || this.musicEnabled) {
            this.enabled = false;
            this.musicEnabled = false;
            this.stopMusic();
        } else {
            this.enabled = true;
            this.musicEnabled = true;
        }
    }
}

// Singleton — shared across all scenes
export const audio = new AudioManager();
