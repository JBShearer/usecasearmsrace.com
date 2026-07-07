// ═══════════════════════════════════════════════════════════════
// EVIL BRAIN LABS - Pre-Composed Chiptune Audio Engine
// Memorable 8-bit melodies with seamless looping
// NES-era inspired game music
// ═══════════════════════════════════════════════════════════════

class ChiptuneEngine {
  constructor() {
    this.audioCtx = null;
    this.masterGain = null;
    this.isPlaying = false;
    this.isMuted = localStorage.getItem('ucar_muted') === 'true';
    this.currentMood = 'menu';
    this.schedulerInterval = null;
    this.patternIndex = 0;

    // Pre-composed melodic loops for each mood
    // Note format: [midiNote, durationInBeats] or [0, duration] for rest
    // Melodies are 16 beats (4 bars) for seamless looping

    this.melodies = {
      // MENU: Mysterious detective theme (Phoenix Wright style)
      // Key: D minor, 110 BPM, 4/4
      menu: {
        tempo: 110,
        lead: [
          // Bar 1: Mysterious opening motif
          [62, 0.5], [65, 0.5], [69, 1], [67, 0.5], [65, 0.5], [62, 1],
          // Bar 2: Continuation
          [64, 0.5], [67, 0.5], [71, 1], [69, 0.5], [67, 0.5], [64, 1],
          // Bar 3: Rising tension
          [65, 0.5], [69, 0.5], [72, 1], [71, 0.5], [69, 0.5], [65, 1],
          // Bar 4: Resolution back down
          [67, 0.5], [64, 0.5], [62, 1.5], [0, 0.5], [62, 0.5], [64, 0.5]
        ],
        bass: [
          // Root movement D-F-Bb-A (i-III-VI-V in D minor)
          [38, 2], [38, 2], [41, 2], [41, 2],
          [46, 2], [46, 2], [45, 2], [45, 2]
        ],
        harmony: [
          // Sustained chord tones
          [57, 4], [60, 4], [58, 4], [57, 4]
        ],
        drums: true
      },

      // EXTRACTION: Tense investigation (building suspense)
      // Key: A minor, 130 BPM, driving pulse
      extraction: {
        tempo: 130,
        lead: [
          // Bar 1-2: Urgent staccato motif
          [69, 0.25], [0, 0.25], [69, 0.25], [0, 0.25], [72, 0.5], [71, 0.5], [69, 0.5], [67, 0.5],
          [69, 0.25], [0, 0.25], [69, 0.25], [0, 0.25], [74, 0.5], [72, 0.5], [71, 0.5], [69, 0.5],
          // Bar 3-4: Escalating phrase
          [72, 0.5], [74, 0.5], [76, 0.5], [74, 0.5], [72, 0.5], [71, 0.5], [69, 1],
          [67, 0.5], [69, 0.5], [71, 0.5], [72, 0.5], [74, 1], [72, 0.5], [71, 0.5]
        ],
        bass: [
          // Driving bass pulse
          [45, 0.5], [45, 0.5], [45, 0.5], [45, 0.5], [45, 0.5], [45, 0.5], [45, 0.5], [45, 0.5],
          [43, 0.5], [43, 0.5], [43, 0.5], [43, 0.5], [43, 0.5], [43, 0.5], [43, 0.5], [43, 0.5],
          [41, 0.5], [41, 0.5], [41, 0.5], [41, 0.5], [41, 0.5], [41, 0.5], [41, 0.5], [41, 0.5],
          [40, 0.5], [40, 0.5], [40, 0.5], [40, 0.5], [40, 0.5], [40, 0.5], [40, 0.5], [40, 0.5]
        ],
        harmony: [
          [57, 2], [55, 2], [53, 2], [52, 2],
          [57, 2], [55, 2], [53, 2], [52, 2]
        ],
        drums: true,
        fastDrums: true
      },

      // VERDICT: Dramatic reveal moment
      // Key: E Phrygian, 90 BPM, dramatic pauses
      verdict: {
        tempo: 90,
        lead: [
          // Bar 1: Dramatic statement
          [64, 1], [0, 0.5], [67, 0.5], [71, 1], [72, 1],
          // Bar 2: Tension hold
          [71, 1.5], [0, 0.5], [69, 0.5], [67, 0.5], [64, 1],
          // Bar 3: Rising drama
          [65, 0.5], [67, 0.5], [69, 1], [71, 0.5], [72, 0.5], [74, 1],
          // Bar 4: Resolution with weight
          [76, 1.5], [74, 0.5], [72, 1], [71, 1]
        ],
        bass: [
          // Heavy, deliberate bass
          [40, 2], [0, 2], [41, 2], [0, 2],
          [43, 2], [0, 2], [40, 2], [40, 2]
        ],
        harmony: [
          // Dramatic sustained chords
          [52, 4], [53, 4], [55, 4], [52, 4]
        ],
        drums: true,
        slowDrums: true
      },

      // HEAVEN: Triumphant angelic (major key resolution)
      // Key: C major, 120 BPM, uplifting
      heaven: {
        tempo: 120,
        lead: [
          // Bar 1: Triumphant fanfare
          [72, 0.5], [74, 0.5], [76, 1], [79, 1], [0, 0.5], [79, 0.25], [81, 0.25],
          // Bar 2: Angelic melody
          [84, 1], [83, 0.5], [81, 0.5], [79, 1], [76, 1],
          // Bar 3: Soaring phrase
          [79, 0.5], [81, 0.5], [83, 1], [84, 0.5], [83, 0.5], [81, 0.5], [79, 0.5],
          // Bar 4: Glorious resolution
          [76, 0.5], [79, 0.5], [84, 1.5], [83, 0.5], [84, 1]
        ],
        bass: [
          // Majestic bass movement C-G-Am-F (I-V-vi-IV)
          [48, 2], [48, 2], [55, 2], [55, 2],
          [57, 2], [57, 2], [53, 2], [53, 2]
        ],
        harmony: [
          // Heavenly sustained notes
          [64, 4], [67, 4], [69, 4], [65, 4]
        ],
        drums: true,
        brightArp: true
      },

      // HELL: Ominous doom (minor key, descending)
      // Key: F# diminished/Phrygian, 140 BPM, relentless
      hell: {
        tempo: 140,
        lead: [
          // Bar 1-2: Descending doom motif
          [78, 0.5], [77, 0.5], [75, 0.5], [73, 0.5], [72, 0.5], [70, 0.5], [68, 0.5], [66, 0.5],
          [78, 0.5], [76, 0.5], [73, 0.5], [70, 0.5], [68, 0.5], [66, 0.5], [63, 0.5], [61, 0.5],
          // Bar 3-4: Chaotic ascending then crash
          [61, 0.5], [63, 0.5], [66, 0.5], [68, 0.5], [70, 0.5], [73, 0.5], [76, 0.5], [78, 0.5],
          [78, 0.25], [77, 0.25], [78, 0.25], [77, 0.25], [75, 0.5], [73, 0.5], [70, 1], [66, 1]
        ],
        bass: [
          // Menacing chromatic descent
          [42, 0.5], [41, 0.5], [40, 0.5], [39, 0.5], [38, 0.5], [37, 0.5], [36, 0.5], [35, 0.5],
          [42, 0.5], [41, 0.5], [40, 0.5], [39, 0.5], [38, 0.5], [37, 0.5], [36, 0.5], [35, 0.5],
          [35, 0.5], [36, 0.5], [37, 0.5], [38, 0.5], [39, 0.5], [40, 0.5], [41, 0.5], [42, 0.5],
          [42, 1], [42, 1], [38, 1], [35, 1]
        ],
        harmony: [
          // Dissonant sustained drones
          [54, 2], [53, 2], [51, 2], [49, 2],
          [49, 2], [51, 2], [53, 2], [54, 2]
        ],
        drums: true,
        fastDrums: true,
        chaotic: true
      },

      // MINT: Victory fanfare (slot machine win)
      // Key: G major, 135 BPM, celebratory
      mint: {
        tempo: 135,
        lead: [
          // Bar 1: Classic victory fanfare opening
          [67, 0.5], [67, 0.25], [67, 0.25], [67, 0.5], [71, 0.5], [74, 1],
          // Bar 2: Celebration continues
          [76, 0.5], [74, 0.5], [71, 0.5], [74, 0.5], [79, 1], [0, 0.5], [79, 0.5],
          // Bar 3: Triumphant repeat
          [79, 0.5], [79, 0.25], [79, 0.25], [79, 0.5], [81, 0.5], [83, 0.5], [81, 0.5], [79, 0.5], [76, 0.5],
          // Bar 4: Grand finale phrase
          [74, 0.5], [76, 0.5], [79, 1], [83, 1], [79, 0.5], [0, 0.5]
        ],
        bass: [
          // Bouncy victory bass G-D-C-D
          [43, 1], [43, 0.5], [47, 0.5], [50, 1], [50, 0.5], [47, 0.5],
          [48, 1], [48, 0.5], [52, 0.5], [50, 1], [50, 0.5], [47, 0.5],
          [43, 1], [43, 0.5], [47, 0.5], [50, 1], [50, 0.5], [47, 0.5],
          [48, 1], [48, 0.5], [50, 0.5], [43, 1], [43, 1]
        ],
        harmony: [
          // Bright chord hits
          [59, 1], [62, 1], [64, 1], [62, 1],
          [60, 1], [64, 1], [62, 1], [59, 1],
          [59, 1], [62, 1], [64, 1], [62, 1],
          [60, 1], [62, 1], [59, 2]
        ],
        drums: true,
        coins: true
      },

      // BROWSE: Relaxed exploration theme
      browse: {
        tempo: 100,
        lead: [
          // Gentle, curious melody
          [64, 1], [67, 0.5], [69, 0.5], [71, 1], [69, 1],
          [67, 0.5], [64, 0.5], [62, 1], [64, 1], [0, 1],
          [67, 1], [69, 0.5], [71, 0.5], [72, 1], [71, 0.5], [69, 0.5],
          [67, 1], [64, 1], [62, 1], [0, 1]
        ],
        bass: [
          [52, 4], [50, 4], [48, 4], [50, 4]
        ],
        harmony: [
          [59, 4], [57, 4], [55, 4], [57, 4]
        ],
        drums: false
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

  // MIDI note to frequency
  midiToFreq(midi) {
    return 440 * Math.pow(2, (midi - 69) / 12);
  }

  // Create a square wave oscillator (classic chiptune sound)
  createSquareOsc(freq, startTime, duration, gain = 0.15, detune = 0) {
    const osc = this.audioCtx.createOscillator();
    const gainNode = this.audioCtx.createGain();

    osc.type = 'square';
    osc.frequency.value = freq;
    osc.detune.value = detune;

    // Quick attack, sustain, quick release (classic 8-bit envelope)
    gainNode.gain.setValueAtTime(0, startTime);
    gainNode.gain.linearRampToValueAtTime(gain, startTime + 0.01);
    gainNode.gain.setValueAtTime(gain * 0.8, startTime + duration * 0.7);
    gainNode.gain.linearRampToValueAtTime(0, startTime + duration);

    osc.connect(gainNode);
    gainNode.connect(this.masterGain);

    osc.start(startTime);
    osc.stop(startTime + duration);

    return osc;
  }

  // Create a pulse wave (50% duty cycle variant)
  createPulseOsc(freq, startTime, duration, gain = 0.12) {
    // Create two square waves slightly detuned for thicker sound
    this.createSquareOsc(freq, startTime, duration, gain * 0.6, 3);
    this.createSquareOsc(freq, startTime, duration, gain * 0.6, -3);
  }

  // Create a triangle wave (softer, bass-like)
  createTriangleOsc(freq, startTime, duration, gain = 0.2) {
    const osc = this.audioCtx.createOscillator();
    const gainNode = this.audioCtx.createGain();

    osc.type = 'triangle';
    osc.frequency.value = freq;

    gainNode.gain.setValueAtTime(0, startTime);
    gainNode.gain.linearRampToValueAtTime(gain, startTime + 0.02);
    gainNode.gain.setValueAtTime(gain * 0.7, startTime + duration * 0.8);
    gainNode.gain.linearRampToValueAtTime(0, startTime + duration);

    osc.connect(gainNode);
    gainNode.connect(this.masterGain);

    osc.start(startTime);
    osc.stop(startTime + duration);

    return osc;
  }

  // Create noise for drums
  createNoise(startTime, duration, gain = 0.1, filterFreq = 1000) {
    const bufferSize = Math.floor(this.audioCtx.sampleRate * duration);
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
    filter.frequency.value = filterFreq;

    gainNode.gain.setValueAtTime(gain, startTime);
    gainNode.gain.exponentialRampToValueAtTime(0.001, startTime + duration);

    noise.connect(filter);
    filter.connect(gainNode);
    gainNode.connect(this.masterGain);

    noise.start(startTime);
    noise.stop(startTime + duration);
  }

  // Play the pre-composed melodic loop
  playLoop(mood) {
    if (!this.audioCtx || this.isMuted) return 0;

    const config = this.melodies[mood];
    if (!config) return 0;

    const now = this.audioCtx.currentTime;
    const beatDuration = 60 / config.tempo;
    let time = now;

    // Calculate total loop duration
    let leadDuration = 0;
    config.lead.forEach(note => leadDuration += note[1]);
    const loopDuration = leadDuration * beatDuration;

    // --- LEAD MELODY ---
    time = now;
    config.lead.forEach(note => {
      const [midiNote, beats] = note;
      const noteDuration = beats * beatDuration;

      if (midiNote > 0) {
        const freq = this.midiToFreq(midiNote);
        // Slight vibrato for expression
        if (beats >= 1) {
          this.createPulseOsc(freq, time, noteDuration * 0.95, 0.1);
        } else {
          this.createSquareOsc(freq, time, noteDuration * 0.9, 0.08);
        }
      }
      time += noteDuration;
    });

    // --- BASS LINE ---
    time = now;
    config.bass.forEach(note => {
      const [midiNote, beats] = note;
      const noteDuration = beats * beatDuration;

      if (midiNote > 0) {
        const freq = this.midiToFreq(midiNote);
        this.createTriangleOsc(freq, time, noteDuration * 0.95, 0.18);
      }
      time += noteDuration;
    });

    // --- HARMONY/PAD ---
    time = now;
    config.harmony.forEach(note => {
      const [midiNote, beats] = note;
      const noteDuration = beats * beatDuration;

      if (midiNote > 0) {
        const freq = this.midiToFreq(midiNote);
        // Softer, sustained harmony
        this.createSquareOsc(freq, time, noteDuration * 0.98, 0.04, 5);
        this.createSquareOsc(freq * 1.005, time, noteDuration * 0.98, 0.03, -5);
      }
      time += noteDuration;
    });

    // --- DRUMS ---
    if (config.drums) {
      const numBeats = Math.floor(leadDuration);
      const isFast = config.fastDrums;
      const isSlow = config.slowDrums;

      for (let i = 0; i < numBeats; i++) {
        const beatTime = now + i * beatDuration;

        if (isSlow) {
          // Dramatic, sparse drums
          if (i % 4 === 0) {
            // Heavy kick
            this.createTriangleOsc(50, beatTime, 0.2, 0.25);
            this.createTriangleOsc(40, beatTime + 0.05, 0.15, 0.15);
          }
          if (i % 4 === 2) {
            // Dramatic snare
            this.createNoise(beatTime, 0.2, 0.12, 800);
          }
        } else if (isFast) {
          // Driving drums
          if (i % 2 === 0) {
            // Kick on every other beat
            this.createTriangleOsc(55, beatTime, 0.1, 0.22);
          }
          if (i % 2 === 1) {
            // Snare
            this.createNoise(beatTime, 0.08, 0.1, 1200);
          }
          // Hi-hat on every 8th note
          this.createNoise(beatTime, 0.03, 0.04, 8000);
          this.createNoise(beatTime + beatDuration * 0.5, 0.03, 0.03, 8000);
        } else {
          // Standard beat
          if (i % 4 === 0 || i % 4 === 2) {
            // Kick
            this.createTriangleOsc(60, beatTime, 0.1, 0.2);
          }
          if (i % 4 === 1 || i % 4 === 3) {
            // Snare
            this.createNoise(beatTime, 0.1, 0.08, 1500);
          }
          // Hi-hat on offbeats
          this.createNoise(beatTime + beatDuration * 0.5, 0.04, 0.03, 6000);
        }
      }

      // Chaotic drum fills for hell
      if (config.chaotic) {
        for (let i = 0; i < numBeats; i += 4) {
          // Random tom fills
          if (i > 0 && i % 8 === 0) {
            for (let j = 0; j < 4; j++) {
              this.createTriangleOsc(80 - j * 10, now + (i - 1 + j * 0.25) * beatDuration, 0.1, 0.1);
            }
          }
        }
      }

      // Coin sounds for mint/victory
      if (config.coins) {
        // Scatter coin sounds
        [0, 3.5, 7, 11, 14.5].forEach(beat => {
          const coinTime = now + beat * beatDuration;
          this.createSquareOsc(this.midiToFreq(83), coinTime, 0.06, 0.05);
          this.createSquareOsc(this.midiToFreq(88), coinTime + 0.06, 0.1, 0.05);
        });
      }
    }

    // Bright arpeggio background for heaven
    if (config.brightArp) {
      const arpNotes = [72, 76, 79, 84, 79, 76];
      let arpTime = now;
      const arpBeat = beatDuration * 0.25;

      while (arpTime < now + loopDuration) {
        arpNotes.forEach(note => {
          this.createSquareOsc(this.midiToFreq(note), arpTime, arpBeat * 0.8, 0.025);
          arpTime += arpBeat;
          if (arpTime >= now + loopDuration) return;
        });
      }
    }

    return loopDuration;
  }

  // Start continuous playback
  start(mood = 'menu') {
    if (!this.audioCtx) this.init();
    if (this.isPlaying) this.stop();

    this.currentMood = mood;
    this.isPlaying = true;

    // Play first loop immediately
    const loopDuration = this.playLoop(mood);

    if (loopDuration > 0) {
      // Schedule subsequent loops
      this.schedulerInterval = setInterval(() => {
        if (this.isPlaying && !this.isMuted) {
          this.playLoop(this.currentMood);
        }
      }, loopDuration * 1000);
    }
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

      case 'reveal':
        // Dramatic reveal sting
        [52, 55, 59, 64].forEach((note, i) => {
          this.createSquareOsc(this.midiToFreq(note), now + i * 0.15, 0.3, 0.1);
          this.createTriangleOsc(this.midiToFreq(note - 12), now + i * 0.15, 0.3, 0.12);
        });
        break;

      case 'tension':
        // Rising tension
        for (let i = 0; i < 8; i++) {
          this.createSquareOsc(this.midiToFreq(48 + i * 2), now + i * 0.1, 0.12, 0.06);
        }
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
