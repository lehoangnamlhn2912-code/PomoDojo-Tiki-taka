// Web Audio API Sound Synthesizer for EduMotion
class AudioEngine {
  constructor() {
    this.ctx = null;
    this.activeSources = [];
    this.gainNode = null;
  }

  initCtx() {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      this.ctx = new AudioCtx();
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  // Play ambient acoustic shield sounds (white noise, rain, binaural beat)
  playAmbientSound(type, volume = 0.3) {
    this.stopAmbientSound();
    this.initCtx();
    if (!this.ctx) return;

    const masterGain = this.ctx.createGain();
    masterGain.gain.setValueAtTime(Math.max(0, Math.min(1, volume * 0.4)), this.ctx.currentTime);
    masterGain.connect(this.ctx.destination);
    this.gainNode = masterGain;

    if (type === 'white_noise' || type === 'rain' || type === 'forest') {
      const bufferSize = this.ctx.sampleRate * 2;
      const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
      const data = buffer.getChannelData(0);
      let lastOut = 0.0;

      for (let i = 0; i < bufferSize; i++) {
        const white = Math.random() * 2 - 1;
        if (type === 'rain') {
          data[i] = (lastOut + 0.02 * white) / 1.02;
          lastOut = data[i];
          data[i] *= 3.5;
        } else if (type === 'forest') {
          data[i] = (lastOut + 0.01 * white) / 1.01;
          lastOut = data[i];
          data[i] *= 2.0;
        } else {
          data[i] = white * 0.2;
        }
      }

      const noise = this.ctx.createBufferSource();
      noise.buffer = buffer;
      noise.loop = true;

      const filter = this.ctx.createBiquadFilter();
      filter.type = type === 'rain' ? 'lowpass' : 'bandpass';
      filter.frequency.setValueAtTime(type === 'rain' ? 800 : 1200, this.ctx.currentTime);

      noise.connect(filter);
      filter.connect(masterGain);
      noise.start();
      this.activeSources.push(noise);
    } else if (type === 'binaural_432') {
      const oscL = this.ctx.createOscillator();
      const oscR = this.ctx.createOscillator();
      const merger = this.ctx.createChannelMerger(2);

      oscL.frequency.setValueAtTime(432, this.ctx.currentTime);
      oscR.frequency.setValueAtTime(446, this.ctx.currentTime);

      oscL.connect(merger, 0, 0);
      oscR.connect(merger, 0, 1);
      merger.connect(masterGain);

      oscL.start();
      oscR.start();
      this.activeSources.push(oscL, oscR);
    }
  }

  setVolume(volume) {
    if (this.gainNode && this.ctx) {
      this.gainNode.gain.setValueAtTime(Math.max(0, Math.min(1, volume * 0.4)), this.ctx.currentTime);
    }
  }

  stopAmbientSound() {
    if (this.gainNode && this.ctx) {
      try {
        this.gainNode.gain.setValueAtTime(0, this.ctx.currentTime);
      } catch (_) {}
    }

    this.activeSources.forEach((source) => {
      try {
        source.stop();
        source.disconnect();
      } catch (_) {}
    });

    this.activeSources = [];
    this.gainNode = null;
  }

  // Soft Eye Protection Warning Chime
  playWarningChime() {
    this.initCtx();
    if (!this.ctx) return;

    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(440, now);
    osc.frequency.exponentialRampToValueAtTime(330, now + 0.6);

    gain.gain.setValueAtTime(0.2, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.6);

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start(now);
    osc.stop(now + 0.6);
  }

  // Quiz Success Chime
  playSuccessSound() {
    this.initCtx();
    if (!this.ctx) return;

    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(523.25, now);
    osc.frequency.setValueAtTime(659.25, now + 0.15);
    osc.frequency.setValueAtTime(783.99, now + 0.3);

    gain.gain.setValueAtTime(0.25, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.6);

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start(now);
    osc.stop(now + 0.6);
  }

  // Bio Reset Tone
  playBreathingGuideTone(freq, durationSec) {
    this.initCtx();
    if (!this.ctx) return;

    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, now);

    gain.gain.setValueAtTime(0.01, now);
    gain.gain.linearRampToValueAtTime(0.12, now + durationSec / 2);
    gain.gain.linearRampToValueAtTime(0.001, now + durationSec);

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start(now);
    osc.stop(now + durationSec);
  }

  // High-Clarity Vietnamese Text-To-Speech
  speakQuestion(text, onEnd, lang = 'vi-VN') {
    this.stopSpeaking();
    if (!text || typeof text !== 'string') return;

    // Clean formatting characters to ensure smooth reading
    const cleanText = text
      .replace(/[\n\r]+/g, ', ')
      .replace(/["*#_~`]+/g, '')
      .trim();

    // Priority 1: High-Clarity Native Vietnamese Audio Stream via Server Endpoint
    try {
      const ttsUrl = `/api/tts?text=${encodeURIComponent(cleanText.substring(0, 350))}`;
      const audio = new Audio(ttsUrl);
      this.currentAudio = audio;

      audio.onended = () => {
        this.currentAudio = null;
        if (onEnd) onEnd();
      };

      audio.onerror = (err) => {
        console.warn('Backend TTS stream fallback to SpeechSynthesis:', err);
        this.fallbackSpeechSynthesis(cleanText, onEnd, lang);
      };

      audio.play().catch((playErr) => {
        console.warn('Audio play failed (autoplay block or network), fallback to SpeechSynthesis:', playErr);
        this.fallbackSpeechSynthesis(cleanText, onEnd, lang);
      });
      return;
    } catch (e) {
      console.warn('Error initiating audio stream:', e);
      this.fallbackSpeechSynthesis(cleanText, onEnd, lang);
    }
  }

  // Fallback client-side SpeechSynthesis with strict Vietnamese voice matching
  fallbackSpeechSynthesis(text, onEnd, lang) {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 0.92;
      utterance.pitch = 1.0;
      utterance.lang = lang || 'vi-VN';

      const voices = window.speechSynthesis.getVoices();
      const viVoice = voices.find(
        (v) =>
          v.lang === 'vi-VN' ||
          v.lang === 'vi_VN' ||
          v.lang.startsWith('vi') ||
          /vietnamese|tiếng việt|vietnam|hoaimy|linh|nam|an/i.test(v.name)
      );

      if (viVoice) {
        utterance.voice = viVoice;
      }

      if (onEnd) utterance.onend = onEnd;
      window.speechSynthesis.speak(utterance);
    }
  }

  stopSpeaking() {
    if (this.currentAudio) {
      try {
        this.currentAudio.pause();
        this.currentAudio.currentTime = 0;
      } catch (e) {}
      this.currentAudio = null;
    }
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
  }
}

export const audioEngine = new AudioEngine();
