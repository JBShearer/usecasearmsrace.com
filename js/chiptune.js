// ═══════════════════════════════════════════════════════════════
// EVIL BRAIN LABS - Procedural Chiptune Audio Engine
// Generates original 8-bit music that sounds like classic theme songs
// without being too close to anything copyrighted
// ═══════════════════════════════════════════════════════════════

class ChiptuneEngine {
  constructor() {
    this.audioCtx = null;
    this.masterGain = null;
    this.isPlaying = false;
    this.isMuted = localStorage.getItem('ucar_muted') === 'true';
    this.currentMood = 'menu';
    this.bpm = 120;
    this.stepIndex = 0;
    this.schedulerInterval = null;

    // Musical scales for different moods
    this.scales = {
      minor: [0, 2, 3, 5, 7, 8, 10],      // Natural minor - mysterious
      major: [0, 2, 4, 5, 7, 9, 11],      // Major - triumphant
      dorian: [0, 2, 3, 5, 7, 9, 10],     // Dorian - detective/noir
      phrygian: [0, 1, 3, 5, 7, 8, 10],   // Phrygian - tense/evil
      pentatonic: [0, 2, 4, 7, 9],         // Pentatonic - catchy
    };

    // Mood configurations
    this.moods = {
      menu: {
        scale: 'dorian',
        baseNote: 48,  // C3
        tempo: 110,
        energy: 0.4,
        pattern: 'arpeggio',
        drums: true
      },
      browse: {
        scale: 'pentatonic',
        baseNote: 48,
        tempo: 100,
        energy: 0.3,
        pattern: 'gentle',
        drums: false
      },
      extraction: {
        scale: 'minor',
        baseNote: 45,  // A2
        tempo: 130,
        energy: 0.6,
        pattern: 'pulse',
        drums: true
      },
      verdict: {
        scale: 'phrygian',
        baseNote: 43,  // G2
        tempo: 90,
        energy: 0.5,
        pattern: 'suspense',
        drums: true
      },
      heaven: {
        scale: 'major',
        baseNote: 52,  // E3
        tempo: 120,
        energy: 0.7,
        pattern: 'triumph',
        drums: true
      },
      hell: {
        scale: 'phrygian',
        baseNote: 41,  // F2
        tempo: 140,
        energy: 0.8,
        pattern: 'chaos',
        drums: true
      },
      mint: {
        scale: 'major',
        baseNote: 48,
        tempo: 135,
        energy: 0.9,
        pattern: 'fanfare',
        drums: true
      }
    };
  }

  // Initialize audio context (must be called after user interaction)
  init() {
    if (this.audioCtx) return;

    this.audioCtx = new (window.AudioContext || window.webkitAudioContext)();

    // Master gain for volume control
    this.masterGain = this.audioCtx.createGain();
    this.masterGain.gain.value = this.isMuted ? 0 : 0.3;
    this.masterGain.connect(this.audioCtx.destination);

    console.log('🎵 Chiptune engine initialized');
  }

  // Create a square wave oscillator (classic chiptune sound)
  createSquareOsc(freq, startTime, duration, gain = 0.15) {
    const osc = this.audioCtx.createOscillator();
    const gainNode = this.audioCtx.createGain();

    osc.type = 'square';
    osc.frequency.value = freq;

    // Quick attack, sustain, quick release (classic 8-bit envelope)
    gainNode.gain.setValueAtTime(0, startTime);
    gainNode.gain.linearRampToValueAtTime(gain, startTime + 0.01);
    gainNode.gain.setValueAtTime(gain, startTime + duration - 0.02);
    gainNode.gain.linearRampToValueAtTime(0, startTime + duration);

    osc.connect(gainNode);
    gainNode.connect(this.masterGain);

    osc.start(startTime);
    osc.stop(startTime + duration);

    return osc;
  }

  // Create a triangle wave (softer, bass-like)
  createTriangleOsc(freq, startTime, duration, gain = 0.2) {
    const osc = this.audioCtx.createOscillator();
    const gainNode = this.audioCtx.createGain();

    osc.type = 'triangle';
    osc.frequency.value = freq;

    gainNode.gain.setValueAtTime(0, startTime);
    gainNode.gain.linearRampToValueAtTime(gain, startTime + 0.02);
    gainNode.gain.setValueAtTime(gain * 0.7, startTime + duration - 0.05);
    gainNode.gain.linearRampToValueAtTime(0, startTime + duration);

    osc.connect(gainNode);
    gainNode.connect(this.masterGain);

    osc.start(startTime);
    osc.stop(startTime + duration);

    return osc;
  }

  // Create noise for drums
  createNoise(startTime, duration, gain = 0.1) {
    const bufferSize = this.audioCtx.sampleRate * duration;
    const buffer = this.audioCtx.createBuffer(1, bufferSize, this.audioCtx.sampleRate);
    const output = buffer.getChannelData(0);

    for (let i = 0; i < bufferSize; i++) {
      output[i] = Math.random() * 2 - 1;
    }

    const noise = this.audioCtx.createBufferSource();
    noise.buffer = buffer;

    const gainNode = this.audioCtx.createGain();
    const filter = this.audioCtx.createBiquadFilter();

    filter.type = 'highpass';
    filter.frequency.value = 1000;

    gainNode.gain.setValueAtTime(gain, startTime);
    gainNode.gain.exponentialRampToValueAtTime(0.001, startTime + duration);

    noise.connect(filter);
    filter.connect(gainNode);
    gainNode.connect(this.masterGain);

    noise.start(startTime);
    noise.stop(startTime + duration);
  }

  // MIDI note to frequency
  midiToFreq(midi) {
    return 440 * Math.pow(2, (midi - 69) / 12);
  }

  // Get note from scale
  getScaleNote(scale, baseNote, degree) {
    const scaleNotes = this.scales[scale];
    const octave = Math.floor(degree / scaleNotes.length);
    const noteInScale = scaleNotes[degree % scaleNotes.length];
    return baseNote + noteInScale + (octave * 12);
  }

  // Generate a melodic phrase
  generatePhrase(mood, length = 8) {
    const config = this.moods[mood];
    const phrase = [];

    for (let i = 0; i < length; i++) {
      // Weighted random - prefer chord tones (0, 2, 4)
      const weights = [3, 1, 2, 1, 2, 1, 1];
      const totalWeight = weights.reduce((a, b) => a + b, 0);
      let rand = Math.random() * totalWeight;
      let degree = 0;

      for (let w = 0; w < weights.length; w++) {
        rand -= weights[w];
        if (rand <= 0) {
          degree = w;
          break;
        }
      }

      // Add some octave variation
      if (Math.random() > 0.7) degree += 7;
      if (Math.random() > 0.9) degree -= 7;

      phrase.push({
        note: this.getScaleNote(config.scale, config.baseNote, degree),
        duration: Math.random() > 0.3 ? 0.5 : 0.25,  // Mix of quarter and eighth notes
        rest: Math.random() > 0.8  // Occasional rests
      });
    }

    return phrase;
  }

  // Play a pattern based on mood
  playPattern(mood) {
    if (!this.audioCtx || this.isMuted) return;

    const config = this.moods[mood];
    const now = this.audioCtx.currentTime;
    const beatDuration = 60 / config.tempo;

    // Generate melody phrase
    const phrase = this.generatePhrase(mood);
    let time = now;

    phrase.forEach((note, i) => {
      if (!note.rest) {
        const freq = this.midiToFreq(note.note);
        this.createSquareOsc(freq, time, note.duration * beatDuration * 0.9, 0.1 * config.energy);
      }
      time += note.duration * beatDuration;
    });

    // Bass line (root and fifth)
    const bassNotes = [0, 0, 4, 4];  // Simple I-I-V-V pattern
    bassNotes.forEach((degree, i) => {
      const bassNote = this.getScaleNote(config.scale, config.baseNote - 12, degree);
      const freq = this.midiToFreq(bassNote);
      this.createTriangleOsc(freq, now + i * beatDuration, beatDuration * 0.9, 0.15 * config.energy);
    });

    // Drums
    if (config.drums) {
      for (let i = 0; i < 4; i++) {
        // Kick on 1 and 3
        if (i === 0 || i === 2) {
          this.createTriangleOsc(60, now + i * beatDuration, 0.1, 0.2);
        }
        // Snare on 2 and 4
        if (i === 1 || i === 3) {
          this.createNoise(now + i * beatDuration, 0.1, 0.08 * config.energy);
        }
        // Hi-hat on every beat
        this.createNoise(now + i * beatDuration + beatDuration * 0.5, 0.05, 0.03);
      }
    }

    return time - now;  // Return duration of pattern
  }

  // Start continuous playback
  start(mood = 'menu') {
    if (!this.audioCtx) this.init();
    if (this.isPlaying) this.stop();

    this.currentMood = mood;
    this.isPlaying = true;

    const config = this.moods[mood];
    const patternDuration = (60 / config.tempo) * 4;  // 4 beats per pattern

    // Play first pattern immediately
    this.playPattern(mood);

    // Schedule subsequent patterns
    this.schedulerInterval = setInterval(() => {
      if (this.isPlaying && !this.isMuted) {
        this.playPattern(this.currentMood);
      }
    }, patternDuration * 1000);
  }

  // Change mood (crossfade)
  setMood(mood) {
    if (mood === this.currentMood) return;
    this.currentMood = mood;

    // If not playing, don't start
    if (!this.isPlaying) return;

    // Restart with new mood
    this.stop();
    this.start(mood);
  }

  // Stop playback
  stop() {
    this.isPlaying = false;
    if (this.schedulerInterval) {
      clearInterval(this.schedulerInterval);
      this.schedulerInterval = null;
    }
  }

  // Toggle mute
  toggleMute() {
    this.isMuted = !this.isMuted;
    localStorage.setItem('ucar_muted', this.isMuted);

    if (this.masterGain) {
      this.masterGain.gain.linearRampToValueAtTime(
        this.isMuted ? 0 : 0.3,
        this.audioCtx.currentTime + 0.1
      );
    }

    return this.isMuted;
  }

  // Set volume (0-1)
  setVolume(vol) {
    if (this.masterGain && !this.isMuted) {
      this.masterGain.gain.linearRampToValueAtTime(
        vol * 0.3,
        this.audioCtx.currentTime + 0.1
      );
    }
  }

  // Play a one-shot sound effect
  playSfx(type) {
    if (!this.audioCtx || this.isMuted) return;

    const now = this.audioCtx.currentTime;

    switch (type) {
      case 'select':
        // Quick rising arpeggio
        [0, 4, 7, 12].forEach((semitone, i) => {
          this.createSquareOsc(this.midiToFreq(60 + semitone), now + i * 0.05, 0.1, 0.1);
        });
        break;

      case 'confirm':
        // Two-note confirmation
        this.createSquareOsc(this.midiToFreq(72), now, 0.1, 0.12);
        this.createSquareOsc(this.midiToFreq(76), now + 0.1, 0.15, 0.12);
        break;

      case 'heaven':
        // Ascending angelic arpeggio
        [0, 4, 7, 12, 16].forEach((semitone, i) => {
          this.createSquareOsc(this.midiToFreq(60 + semitone), now + i * 0.08, 0.2, 0.08);
        });
        break;

      case 'hell':
        // Descending ominous
        [12, 8, 5, 0, -5].forEach((semitone, i) => {
          this.createSquareOsc(this.midiToFreq(48 + semitone), now + i * 0.1, 0.15, 0.1);
        });
        break;

      case 'mint':
        // Slot machine win fanfare
        const fanfare = [60, 64, 67, 72, 72, 72];
        fanfare.forEach((note, i) => {
          this.createSquareOsc(this.midiToFreq(note), now + i * 0.12, 0.2, 0.12);
        });
        // Triumphant bass
        this.createTriangleOsc(this.midiToFreq(36), now + 0.6, 0.4, 0.2);
        break;

      case 'coin':
        // Classic coin sound
        this.createSquareOsc(this.midiToFreq(83), now, 0.08, 0.1);
        this.createSquareOsc(this.midiToFreq(88), now + 0.08, 0.15, 0.1);
        break;

      case 'error':
        // Buzzer
        this.createSquareOsc(this.midiToFreq(40), now, 0.2, 0.15);
        break;
    }
  }
}

// Global instance
window.chiptuneEngine = new ChiptuneEngine();

// Auto-init on first user interaction
document.addEventListener('click', function initAudio() {
  window.chiptuneEngine.init();
  document.removeEventListener('click', initAudio);
}, { once: true });
