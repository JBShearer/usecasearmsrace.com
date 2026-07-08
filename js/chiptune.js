// ═══════════════════════════════════════════════════════════════
// EVIL BRAIN LABS - Pre-Composed Chiptune Audio Engine
// Memorable 8-bit melodies with seamless looping
// NES-era inspired game music
// ADAPTIVE VOLUME: fades for video, rises on inactivity,
// goes soft when attentive, builds near narrative climax
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

    // Adaptive volume system
    this.baseVolume = 0.3;        // Normal max volume
    this.currentVolume = 0.1;     // Start soft
    this.targetVolume = 0.15;     // Where we're heading
    this.volumeFadeInterval = null;
    this.lastInteraction = Date.now();
    this.inactivityCheckInterval = null;
    this.videoPlaying = false;
    this.narrativePhase = 'idle';  // idle, discovery, extraction, complication, verdict, mint

    // Volume levels for different states
    this.volumeLevels = {
      videoPlaying: 0.05,          // Very quiet when video is playing
      attentive: 0.12,             // Soft when user is actively engaged
      idle: 0.2,                   // Medium when browsing
      inactive: 0.25,              // Louder when user seems away
      climax: 0.3,                 // Full volume for dramatic moments
      muted: 0
    };

    // Narrative arc volume curve
    this.narrativeVolumes = {
      idle: 0.15,
      discovery: 0.18,             // Slight rise for intro
      extraction: 0.12,            // Soft during choices (thinking)
      complication: 0.22,          // Building tension
      verdict: 0.28,               // Near climax
      mint: 0.3                    // Celebration/climax
    };

    // Pre-composed melodic loops for each mood
    // Note format: [midiNote, durationInBeats] or [0, duration] for rest
    // Each melody is 16 beats (4 bars of 4/4) for seamless looping
    // Uses proper chord progressions and memorable melodic hooks

    this.melodies = {
      // ═══════════════════════════════════════════════════════════════
      // MENU: Mysterious spy theme (James Bond meets Phoenix Wright)
      // Key: E minor, 115 BPM - Iconic minor 2nd motif
      // Chord progression: Em - C - Am - B7 (i - VI - iv - V7)
      // ═══════════════════════════════════════════════════════════════
      menu: {
        tempo: 115,
        lead: [
          // Bar 1: Iconic spy motif (E-F-E, the minor 2nd tension)
          [64, 0.75], [65, 0.25], [64, 0.5], [0, 0.5], [67, 0.5], [71, 0.5], [67, 0.5], [64, 0.5],
          // Bar 2: Answer phrase
          [63, 0.5], [64, 0.5], [67, 1], [64, 0.5], [63, 0.5], [60, 1],
          // Bar 3: Rising sequence
          [64, 0.5], [65, 0.25], [64, 0.25], [67, 0.5], [69, 0.5], [71, 0.5], [72, 0.5], [71, 0.5], [69, 0.5],
          // Bar 4: Resolution with hook repeat
          [67, 0.5], [64, 0.5], [65, 0.25], [64, 0.75], [0, 0.5], [59, 0.5], [64, 1]
        ],
        bass: [
          // Em - C - Am - B7 (classic minor progression)
          [40, 1], [40, 0.5], [47, 0.5], [40, 1], [40, 0.5], [47, 0.5],
          [48, 1], [48, 0.5], [55, 0.5], [45, 1], [45, 0.5], [52, 0.5],
          [40, 1], [40, 0.5], [47, 0.5], [40, 1], [40, 0.5], [47, 0.5],
          [47, 1], [47, 0.5], [54, 0.5], [47, 1.5], [0, 0.5]
        ],
        harmony: [
          // Sustained chord pads following progression
          [55, 2], [59, 2], [55, 2], [57, 2],
          [55, 2], [59, 2], [54, 2], [56, 2]
        ],
        drums: true
      },

      // ═══════════════════════════════════════════════════════════════
      // EXTRACTION: Tense investigation (Ace Attorney cross-examination)
      // Key: D minor, 138 BPM - Driving, urgent, thinking music
      // Progression: Dm - Gm - A7 - Dm (i - iv - V7 - i)
      // ═══════════════════════════════════════════════════════════════
      extraction: {
        tempo: 138,
        lead: [
          // Bar 1: Urgent repeating motif
          [62, 0.25], [65, 0.25], [69, 0.25], [65, 0.25], [62, 0.25], [65, 0.25], [69, 0.25], [72, 0.25],
          // Bar 2: Variation
          [74, 0.25], [72, 0.25], [69, 0.25], [72, 0.25], [74, 0.5], [72, 0.5], [69, 0.5], [67, 0.5],
          // Bar 3: Building tension
          [65, 0.25], [67, 0.25], [69, 0.25], [67, 0.25], [65, 0.25], [67, 0.25], [69, 0.25], [71, 0.25],
          // Bar 4: Climax and reset
          [73, 0.5], [71, 0.5], [69, 0.5], [67, 0.5], [65, 0.5], [62, 0.5], [0, 0.5], [60, 0.5]
        ],
        bass: [
          // Driving eighth-note pulse
          [38, 0.5], [38, 0.5], [38, 0.5], [38, 0.5], [38, 0.5], [45, 0.5], [38, 0.5], [45, 0.5],
          [43, 0.5], [43, 0.5], [43, 0.5], [43, 0.5], [43, 0.5], [50, 0.5], [43, 0.5], [50, 0.5],
          [45, 0.5], [45, 0.5], [45, 0.5], [45, 0.5], [45, 0.5], [52, 0.5], [45, 0.5], [52, 0.5],
          [38, 0.5], [38, 0.5], [38, 0.5], [45, 0.5], [38, 1], [0, 0.5], [36, 0.5]
        ],
        harmony: [
          [57, 2], [60, 2], [58, 2], [57, 2],
          [57, 2], [60, 2], [61, 2], [57, 2]
        ],
        drums: true,
        fastDrums: true
      },

      // ═══════════════════════════════════════════════════════════════
      // VERDICT: Dramatic courtroom moment
      // Key: A Phrygian, 85 BPM - Heavy, dramatic pauses
      // Progression: Am - Bb - Am - E (i - bII - i - V)
      // ═══════════════════════════════════════════════════════════════
      verdict: {
        tempo: 85,
        lead: [
          // Bar 1: Dramatic opening statement
          [69, 1.5], [0, 0.5], [72, 0.5], [74, 0.5], [76, 1],
          // Bar 2: Tension hold
          [77, 1], [76, 0.5], [74, 0.5], [72, 1], [0, 1],
          // Bar 3: Rising to judgment
          [69, 0.5], [72, 0.5], [74, 0.5], [76, 0.5], [77, 1], [76, 0.5], [74, 0.5],
          // Bar 4: The verdict drops
          [76, 2], [74, 1], [72, 1]
        ],
        bass: [
          // Heavy, deliberate bass with dramatic rests
          [45, 1.5], [0, 0.5], [45, 1], [0, 1],
          [46, 1.5], [0, 0.5], [46, 1], [0, 1],
          [45, 1.5], [0, 0.5], [45, 1], [0, 1],
          [40, 2], [40, 1], [40, 1]
        ],
        harmony: [
          [60, 2], [64, 2], [61, 2], [64, 2],
          [60, 2], [64, 2], [56, 2], [64, 2]
        ],
        drums: true,
        slowDrums: true
      },

      // ═══════════════════════════════════════════════════════════════
      // HEAVEN: Triumphant angel choir
      // Key: G major, 125 BPM - Soaring, uplifting
      // Progression: G - D - Em - C (I - V - vi - IV) - The "Axis of Awesome"
      // ═══════════════════════════════════════════════════════════════
      heaven: {
        tempo: 125,
        lead: [
          // Bar 1: Triumphant fanfare hook
          [67, 0.5], [71, 0.5], [74, 1], [79, 1], [78, 0.5], [79, 0.5],
          // Bar 2: Angelic soar
          [83, 1], [81, 0.5], [79, 0.5], [78, 0.5], [79, 0.5], [74, 1],
          // Bar 3: Call and response
          [76, 0.5], [78, 0.5], [79, 1], [76, 0.5], [74, 0.5], [71, 0.5], [74, 0.5],
          // Bar 4: Glorious resolution
          [76, 0.5], [74, 0.5], [71, 0.5], [67, 0.5], [74, 1], [79, 1]
        ],
        bass: [
          // G - D - Em - C (I - V - vi - IV)
          [43, 1], [43, 0.5], [47, 0.5], [43, 1], [47, 1],
          [50, 1], [50, 0.5], [54, 0.5], [52, 1], [52, 0.5], [55, 0.5],
          [40, 1], [40, 0.5], [44, 0.5], [40, 1], [44, 1],
          [48, 1], [48, 0.5], [52, 0.5], [48, 1], [48, 1]
        ],
        harmony: [
          [59, 2], [62, 2], [59, 2], [64, 2],
          [55, 2], [59, 2], [55, 2], [60, 2]
        ],
        drums: true,
        brightArp: true
      },

      // ═══════════════════════════════════════════════════════════════
      // HELL: Doom and dread (Castlevania style)
      // Key: E Phrygian dominant, 145 BPM - Relentless descent
      // Progression: Em - F - G - F - Em (chromatic doom)
      // ═══════════════════════════════════════════════════════════════
      hell: {
        tempo: 145,
        lead: [
          // Bar 1-2: Descending chromatic doom
          [76, 0.5], [75, 0.5], [76, 0.5], [72, 0.5], [71, 0.5], [72, 0.5], [68, 0.5], [67, 0.5],
          [68, 0.5], [64, 0.5], [63, 0.5], [64, 0.5], [60, 1], [0, 0.5], [60, 0.5],
          // Bar 3-4: Ascending fury then crash
          [64, 0.5], [67, 0.5], [68, 0.5], [71, 0.5], [72, 0.5], [75, 0.5], [76, 0.5], [79, 0.5],
          [76, 0.25], [75, 0.25], [76, 0.25], [75, 0.25], [72, 0.5], [68, 0.5], [64, 1]
        ],
        bass: [
          // Menacing chromatic movement
          [40, 0.5], [40, 0.5], [47, 0.5], [40, 0.5], [41, 0.5], [41, 0.5], [48, 0.5], [41, 0.5],
          [43, 0.5], [43, 0.5], [50, 0.5], [43, 0.5], [41, 0.5], [41, 0.5], [48, 0.5], [41, 0.5],
          [40, 0.5], [40, 0.5], [47, 0.5], [40, 0.5], [41, 0.5], [41, 0.5], [43, 0.5], [44, 0.5],
          [40, 1], [40, 0.5], [0, 0.5], [40, 0.5], [40, 0.5], [40, 1]
        ],
        harmony: [
          [55, 2], [56, 2], [59, 2], [56, 2],
          [55, 2], [56, 2], [59, 2], [55, 2]
        ],
        drums: true,
        fastDrums: true,
        chaotic: true
      },

      // ═══════════════════════════════════════════════════════════════
      // MINT: Victory fanfare (Zelda chest + Mario level clear)
      // Key: C major, 140 BPM - Celebratory, memorable
      // Progression: C - G - Am - F (I - V - vi - IV)
      // ═══════════════════════════════════════════════════════════════
      mint: {
        tempo: 140,
        lead: [
          // Bar 1: Classic victory fanfare (da-da-da-DAAA!)
          [72, 0.5], [72, 0.25], [72, 0.25], [72, 0.5], [76, 0.5], [79, 1], [84, 1],
          // Bar 2: Cascading celebration
          [83, 0.5], [81, 0.5], [79, 0.5], [76, 0.5], [79, 0.5], [81, 0.5], [84, 1],
          // Bar 3: Echo the hook
          [84, 0.5], [84, 0.25], [84, 0.25], [84, 0.5], [83, 0.5], [81, 0.5], [79, 0.5], [76, 1],
          // Bar 4: Grand finale
          [79, 0.5], [76, 0.5], [72, 1], [76, 0.5], [79, 0.5], [84, 1]
        ],
        bass: [
          // Bouncy victory bass
          [48, 0.5], [48, 0.5], [55, 0.5], [48, 0.5], [55, 0.5], [55, 0.5], [62, 0.5], [55, 0.5],
          [57, 0.5], [57, 0.5], [64, 0.5], [57, 0.5], [53, 0.5], [53, 0.5], [60, 0.5], [53, 0.5],
          [48, 0.5], [48, 0.5], [55, 0.5], [48, 0.5], [55, 0.5], [55, 0.5], [62, 0.5], [55, 0.5],
          [53, 0.5], [53, 0.5], [55, 0.5], [55, 0.5], [48, 1], [48, 1]
        ],
        harmony: [
          [64, 2], [67, 2], [64, 2], [65, 2],
          [64, 2], [67, 2], [65, 2], [64, 2]
        ],
        drums: true,
        coins: true
      },

      // ═══════════════════════════════════════════════════════════════
      // BROWSE: Chill exploration (Animal Crossing / Stardew vibe)
      // Key: F major, 95 BPM - Gentle, curious, cozy
      // Progression: F - Dm - Bb - C (I - vi - IV - V)
      // ═══════════════════════════════════════════════════════════════
      browse: {
        tempo: 95,
        lead: [
          // Bar 1: Gentle opening
          [65, 1], [69, 0.5], [72, 0.5], [74, 1], [72, 0.5], [69, 0.5],
          // Bar 2: Curious wandering
          [70, 1], [69, 0.5], [65, 0.5], [67, 1], [0, 1],
          // Bar 3: Pleasant discovery
          [70, 0.5], [72, 0.5], [74, 1], [72, 0.5], [70, 0.5], [69, 1],
          // Bar 4: Settling back
          [67, 0.5], [65, 0.5], [64, 0.5], [65, 0.5], [69, 1], [0, 1]
        ],
        bass: [
          // Gentle walking bass
          [41, 2], [41, 1], [45, 1],
          [38, 2], [38, 1], [41, 1],
          [46, 2], [46, 1], [50, 1],
          [48, 2], [48, 1], [41, 1]
        ],
        harmony: [
          [57, 4], [53, 4], [58, 4], [55, 4]
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

  // Start continuous playback with proper scheduling
  start(mood = 'menu') {
    if (!this.audioCtx) this.init();
    if (this.isPlaying) this.stop();

    this.currentMood = mood;
    this.isPlaying = true;
    this.nextLoopTime = this.audioCtx.currentTime;

    // Schedule first loop
    this.scheduleLoop();

    // Use requestAnimationFrame-based scheduler for precise timing
    this.scheduleAhead();
  }

  // Schedule loops ahead of time (look-ahead scheduling)
  scheduleAhead() {
    if (!this.isPlaying) return;

    const lookAhead = 0.5; // Schedule 500ms ahead
    const now = this.audioCtx.currentTime;

    // Schedule any loops that need to start within the look-ahead window
    while (this.nextLoopTime < now + lookAhead) {
      this.scheduleLoop();
    }

    // Check again soon
    this.schedulerTimeout = setTimeout(() => this.scheduleAhead(), 200);
  }

  // Schedule a single loop at the precise time
  scheduleLoop() {
    if (!this.isPlaying || this.isMuted) return;

    const config = this.melodies[this.currentMood];
    if (!config) return;

    const beatDuration = 60 / config.tempo;

    // Calculate loop duration from lead melody
    let leadDuration = 0;
    config.lead.forEach(note => leadDuration += note[1]);
    const loopDuration = leadDuration * beatDuration;

    // Play the loop at nextLoopTime
    this.playLoopAt(this.currentMood, this.nextLoopTime);

    // Schedule next loop
    this.nextLoopTime += loopDuration;
  }

  // Play a loop at a specific time (not 'now')
  playLoopAt(mood, startTime) {
    if (!this.audioCtx || this.isMuted) return;

    const config = this.melodies[mood];
    if (!config) return;

    const beatDuration = 60 / config.tempo;
    let time = startTime;

    // Calculate total loop duration
    let leadDuration = 0;
    config.lead.forEach(note => leadDuration += note[1]);

    // --- LEAD MELODY ---
    time = startTime;
    config.lead.forEach(note => {
      const [midiNote, beats] = note;
      const noteDuration = beats * beatDuration;

      if (midiNote > 0) {
        const freq = this.midiToFreq(midiNote);
        if (beats >= 1) {
          this.createPulseOsc(freq, time, noteDuration * 0.95, 0.1);
        } else {
          this.createSquareOsc(freq, time, noteDuration * 0.9, 0.08);
        }
      }
      time += noteDuration;
    });

    // --- BASS LINE ---
    time = startTime;
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
    time = startTime;
    config.harmony.forEach(note => {
      const [midiNote, beats] = note;
      const noteDuration = beats * beatDuration;

      if (midiNote > 0) {
        const freq = this.midiToFreq(midiNote);
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
        const beatTime = startTime + i * beatDuration;

        if (isSlow) {
          if (i % 4 === 0) {
            this.createTriangleOsc(50, beatTime, 0.2, 0.25);
            this.createTriangleOsc(40, beatTime + 0.05, 0.15, 0.15);
          }
          if (i % 4 === 2) {
            this.createNoise(beatTime, 0.2, 0.12, 800);
          }
        } else if (isFast) {
          if (i % 2 === 0) {
            this.createTriangleOsc(55, beatTime, 0.1, 0.22);
          }
          if (i % 2 === 1) {
            this.createNoise(beatTime, 0.08, 0.1, 1200);
          }
          this.createNoise(beatTime, 0.03, 0.04, 8000);
          this.createNoise(beatTime + beatDuration * 0.5, 0.03, 0.03, 8000);
        } else {
          if (i % 4 === 0 || i % 4 === 2) {
            this.createTriangleOsc(60, beatTime, 0.1, 0.2);
          }
          if (i % 4 === 1 || i % 4 === 3) {
            this.createNoise(beatTime, 0.1, 0.08, 1500);
          }
          this.createNoise(beatTime + beatDuration * 0.5, 0.04, 0.03, 6000);
        }
      }

      if (config.chaotic) {
        for (let i = 0; i < numBeats; i += 4) {
          if (i > 0 && i % 8 === 0) {
            for (let j = 0; j < 4; j++) {
              this.createTriangleOsc(80 - j * 10, startTime + (i - 1 + j * 0.25) * beatDuration, 0.1, 0.1);
            }
          }
        }
      }

      if (config.coins) {
        [0, 3.5, 7, 11, 14.5].forEach(beat => {
          const coinTime = startTime + beat * beatDuration;
          this.createSquareOsc(this.midiToFreq(83), coinTime, 0.06, 0.05);
          this.createSquareOsc(this.midiToFreq(88), coinTime + 0.06, 0.1, 0.05);
        });
      }
    }

    // Bright arpeggio for heaven
    if (config.brightArp) {
      const loopDur = leadDuration * beatDuration;
      const arpNotes = [72, 76, 79, 84, 79, 76];
      let arpTime = startTime;
      const arpBeat = beatDuration * 0.25;

      while (arpTime < startTime + loopDur) {
        arpNotes.forEach((note, i) => {
          this.createSquareOsc(this.midiToFreq(note), arpTime + i * arpBeat, arpBeat * 0.8, 0.03);
        });
        arpTime += arpNotes.length * arpBeat;
      }
    }
  }

  // Change mood (crossfade)
  setMood(mood) {
    if (mood === this.currentMood) return;
    this.currentMood = mood;

    if (!this.isPlaying) return;

    // Let current loop finish, new mood starts next loop
    // (the scheduleLoop will pick up the new mood)
  }

  // Stop playback
  stop() {
    this.isPlaying = false;
    if (this.schedulerTimeout) {
      clearTimeout(this.schedulerTimeout);
      this.schedulerTimeout = null;
    }
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

  // ═══════════════════════════════════════════════════════════════
  // ADAPTIVE VOLUME SYSTEM
  // ═══════════════════════════════════════════════════════════════

  // Start the adaptive volume system
  startAdaptiveVolume() {
    // Smooth volume fading (runs every 100ms)
    this.volumeFadeInterval = setInterval(() => {
      this.smoothVolumeTransition();
    }, 100);

    // Check for inactivity (runs every 5 seconds)
    this.inactivityCheckInterval = setInterval(() => {
      this.checkInactivity();
    }, 5000);

    // Listen for user interactions
    ['click', 'keydown', 'mousemove', 'touchstart', 'scroll'].forEach(event => {
      document.addEventListener(event, () => this.onUserInteraction(), { passive: true });
    });

    // Watch for video play/pause
    this.watchVideos();
  }

  // Smoothly transition to target volume
  smoothVolumeTransition() {
    if (!this.masterGain || this.isMuted) return;

    const diff = this.targetVolume - this.currentVolume;
    if (Math.abs(diff) < 0.005) {
      this.currentVolume = this.targetVolume;
    } else {
      // Ease toward target (faster fade down, slower fade up)
      const rate = diff < 0 ? 0.15 : 0.08;
      this.currentVolume += diff * rate;
    }

    this.masterGain.gain.setValueAtTime(this.currentVolume, this.audioCtx.currentTime);
  }

  // Set target volume with optional immediate flag
  setTargetVolume(level, immediate = false) {
    this.targetVolume = Math.max(0, Math.min(this.baseVolume, level));

    if (immediate && this.masterGain) {
      this.currentVolume = this.targetVolume;
      this.masterGain.gain.setValueAtTime(this.currentVolume, this.audioCtx.currentTime);
    }
  }

  // Called when user interacts
  onUserInteraction() {
    this.lastInteraction = Date.now();

    // If video isn't playing, set to attentive level
    if (!this.videoPlaying) {
      this.setTargetVolume(this.narrativeVolumes[this.narrativePhase] || this.volumeLevels.attentive);
    }
  }

  // Check if user has been inactive
  checkInactivity() {
    if (this.videoPlaying) return;

    const inactiveTime = Date.now() - this.lastInteraction;

    if (inactiveTime > 60000) {
      // Over 1 minute inactive - rise to full idle volume
      this.setTargetVolume(this.volumeLevels.inactive);
    } else if (inactiveTime > 30000) {
      // Over 30 seconds - medium volume
      this.setTargetVolume(this.volumeLevels.idle);
    }
  }

  // Watch for video elements playing
  watchVideos() {
    // Check for iframes (YouTube embeds) and video elements
    const checkVideoState = () => {
      const iframes = document.querySelectorAll('iframe[src*="youtube"], iframe[src*="vimeo"]');
      const videos = document.querySelectorAll('video');

      // For now, assume video is playing if daily show section is expanded
      const dailyShow = document.getElementById('daily-show');
      const isExpanded = dailyShow && !dailyShow.classList.contains('collapsed');

      // Also check if any video element is actually playing
      let videoActuallyPlaying = false;
      videos.forEach(v => {
        if (!v.paused && !v.ended) videoActuallyPlaying = true;
      });

      const wasPlaying = this.videoPlaying;
      this.videoPlaying = isExpanded || videoActuallyPlaying;

      // Volume change on video state change
      if (this.videoPlaying && !wasPlaying) {
        this.setTargetVolume(this.volumeLevels.videoPlaying);
      } else if (!this.videoPlaying && wasPlaying) {
        this.setTargetVolume(this.narrativeVolumes[this.narrativePhase] || this.volumeLevels.attentive);
      }
    };

    // Check periodically
    setInterval(checkVideoState, 1000);

    // Also listen for daily show toggle
    const dailyShow = document.getElementById('daily-show');
    if (dailyShow) {
      const observer = new MutationObserver(checkVideoState);
      observer.observe(dailyShow, { attributes: true, attributeFilter: ['class'] });
    }
  }

  // Set narrative phase (called from game.html during story progression)
  setNarrativePhase(phase) {
    this.narrativePhase = phase;

    if (!this.videoPlaying) {
      const targetVol = this.narrativeVolumes[phase] || this.volumeLevels.attentive;
      this.setTargetVolume(targetVol);
    }

    console.log(`🎵 Narrative phase: ${phase}, target volume: ${this.narrativeVolumes[phase]}`);
  }

  // Stop adaptive volume system
  stopAdaptiveVolume() {
    if (this.volumeFadeInterval) {
      clearInterval(this.volumeFadeInterval);
      this.volumeFadeInterval = null;
    }
    if (this.inactivityCheckInterval) {
      clearInterval(this.inactivityCheckInterval);
      this.inactivityCheckInterval = null;
    }
  }
}

// Global instance
window.chiptuneEngine = new ChiptuneEngine();

// Auto-init on first user interaction
document.addEventListener('click', function initAudio() {
  window.chiptuneEngine.init();
  window.chiptuneEngine.startAdaptiveVolume();
  document.removeEventListener('click', initAudio);
}, { once: true });
