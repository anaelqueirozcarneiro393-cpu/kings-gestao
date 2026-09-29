// Synthesizer de som para alertas de novos pedidos usando Web Audio API puro
// Dispensa downloads ou arquivos de áudio externos pesados

let audioCtx = null;

function getAudioContext() {
  if (!audioCtx && typeof window !== 'undefined') {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (AudioContextClass) {
      audioCtx = new AudioContextClass();
    }
  }
  if (audioCtx && audioCtx.state === 'suspended') {
    audioCtx.resume().catch(() => {});
  }
  return audioCtx;
}

// Desbloqueia o contexto de áudio automaticamente na primeira interação do usuário com a página
if (typeof window !== 'undefined') {
  const unlockAudio = () => {
    try {
      const ctx = getAudioContext();
      if (ctx && ctx.state === 'suspended') {
        ctx.resume();
      }
    } catch (e) {}
    window.removeEventListener('click', unlockAudio);
    window.removeEventListener('keydown', unlockAudio);
    window.removeEventListener('touchstart', unlockAudio);
  };

  window.addEventListener('click', unlockAudio, { passive: true });
  window.addEventListener('keydown', unlockAudio, { passive: true });
  window.addEventListener('touchstart', unlockAudio, { passive: true });
}

/**
 * Toca o chime característico de novo pedido (estilo campainha de delivery / iFood)
 * Sequência melódica de dois toques (Ding-Dong agradável e chamativo)
 */
export function playNewOrderChime() {
  try {
    const ctx = getAudioContext();
    if (!ctx) return;

    if (ctx.state === 'suspended') {
      ctx.resume();
    }

    const now = ctx.currentTime;

    const playTone = (freq, startTime, duration, maxGain = 0.35) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, startTime);

      // Harmônico suave para corpo do sino
      const oscHarmonic = ctx.createOscillator();
      const gainHarmonic = ctx.createGain();
      oscHarmonic.type = 'triangle';
      oscHarmonic.frequency.setValueAtTime(freq * 2, startTime);
      gainHarmonic.gain.setValueAtTime(0, startTime);
      gainHarmonic.gain.linearRampToValueAtTime(maxGain * 0.25, startTime + 0.02);
      gainHarmonic.gain.exponentialRampToValueAtTime(0.0001, startTime + duration * 0.7);

      oscHarmonic.connect(gainHarmonic);
      gainHarmonic.connect(ctx.destination);
      oscHarmonic.start(startTime);
      oscHarmonic.stop(startTime + duration);

      // Tom fundamental
      gain.gain.setValueAtTime(0, startTime);
      gain.gain.linearRampToValueAtTime(maxGain, startTime + 0.03);
      gain.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(startTime);
      osc.stop(startTime + duration);
    };

    // Toque 1: Ding (Sol agudo - 784 Hz)
    playTone(783.99, now, 0.45, 0.35);

    // Toque 2: Dong (Dó agudo - 523 Hz)
    playTone(523.25, now + 0.22, 0.7, 0.4);

    // Toque 3: Ding de confirmação mais agudo após breve pausa
    playTone(1046.50, now + 0.55, 0.55, 0.3);

  } catch (err) {
    console.warn('[AUDIO CHIME]', err);
  }
}
