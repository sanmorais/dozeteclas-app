// audio-engine.js - Motor de Áudio Unificado do Doze Teclas

const AudioCtx = window.AudioContext || window.webkitAudioContext;
let audioCtx;

/**
 * Garante a inicialização e o desbloqueio do AudioContext
 */
export function getAudioContext() {
    if (!audioCtx) audioCtx = new AudioCtx();
    if (audioCtx.state === 'suspended') audioCtx.resume();
    return audioCtx;
}

/**
 * Converte o índice de uma nota musical em sua frequência absoluta (baseada em C3 = 130.81 Hz)
 */
export function getFreq(noteIdx) {
    return 130.81 * Math.pow(2, noteIdx / 12);
}

/**
 * Toca uma frequência específica utilizando as configurações globais do usuário
 * @param {number} freq - Frequência em Hz
 */
export function playTone(freq) {
    const ctx = getAudioContext();
    
    // Busca ativa dos ajustes do painel do usuário (com valores padrão de segurança)
    const savedTimbre = localStorage.getItem('dt_timbre') || 'triangle';
    const savedVol = (localStorage.getItem('dt_volume') || 15) / 100;
    const savedSus = parseFloat(localStorage.getItem('dt_sustain') || 0.6);

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    
    osc.type = savedTimbre;
    osc.frequency.setValueAtTime(freq, ctx.currentTime);
    
    gain.gain.setValueAtTime(savedVol, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + savedSus);
    
    osc.connect(gain);
    gain.connect(ctx.destination);
    
    osc.start();
    osc.stop(ctx.currentTime + savedSus);
}