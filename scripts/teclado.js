// teclado.js - Lógica do Teclado Virtual de 3 Oitavas e Metrônomo

let isPointerDown = false;
let bpm = 120; 
let sig = 4; 
let beat = 0;
let playing = false; 
let timer;

// Configurações atuais
let currentTimbre = 'triangle';
let pianoVolume = 0.9;

const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
const pianoCtx = new (window.AudioContext || window.webkitAudioContext)();
const activeNodes = {};

const frequencies = [
    65.41, 69.30, 73.42, 77.78, 82.41, 87.31, 92.50, 98.00, 103.83, 110.00, 116.54, 123.47, // Oitava 2
    130.81, 138.59, 146.83, 155.56, 164.81, 174.61, 185.00, 196.00, 207.65, 220.00, 233.08, 246.94, // Oitava 3
    261.63, 277.18, 293.66, 311.13, 329.63, 349.23, 369.99, 392.00, 415.30, 440.00, 466.16, 493.88  // Oitava 4
];

function playNote(index) {
    if (pianoCtx.state === 'suspended') pianoCtx.resume();
    stopNote(index);
    const osc = pianoCtx.createOscillator();
    const gain = pianoCtx.createGain();
    osc.type = currentTimbre;
    osc.frequency.value = frequencies[index] || 440;
    gain.gain.setValueAtTime(pianoVolume, pianoCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, pianoCtx.currentTime + 1.2);
    osc.connect(gain); gain.connect(pianoCtx.destination);
    osc.start(); activeNodes[index] = { osc, gain };
}

function stopNote(index) {
    if (activeNodes[index]) {
        activeNodes[index].gain.gain.exponentialRampToValueAtTime(0.001, pianoCtx.currentTime + 0.1);
        activeNodes[index].osc.stop(pianoCtx.currentTime + 0.1);
        delete activeNodes[index];
    }
}

function playClick(isFirst) {
    const osc = audioCtx.createOscillator();
    const envelope = audioCtx.createGain();
    const metroVolEl = document.getElementById('metroVol');
    const vol = metroVolEl ? metroVolEl.value / 100 : 0.5;
    
    osc.type = 'sine';
    osc.frequency.value = isFirst ? 1000 : 600;
    envelope.gain.value = vol;
    osc.connect(envelope); envelope.connect(audioCtx.destination);
    osc.start();
    envelope.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.1);
    osc.stop(audioCtx.currentTime + 0.1);
}

function initKeyboard() {
    const k = document.getElementById('keyboard');
    if (!k) return;
    k.innerHTML = ''; 
    const wWidth = 40;
    const bWidth = 26;
    const offset = bWidth / 2;

    const whiteIndices = [
        0, 2, 4, 5, 7, 9, 11,      // Oitava 2
        12, 14, 16, 17, 19, 21, 23, // Oitava 3
        24, 26, 28, 29, 31, 33, 35  // Oitava 4
    ];

    // Gerar 21 Brancas
    for (let i = 0; i < 21; i++) {
        const div = document.createElement('div');
        div.className = 'key-w';
        addKeyEvents(div, whiteIndices[i]);
        k.appendChild(div);
    }

    // Gerar Pretas
    const blackFendas = [
        1, 2, 4, 5, 6,        // Oitava 2
        8, 9, 11, 12, 13,     // Oitava 3
        15, 16, 18, 19, 20    // Oitava 4
    ];
    
    const blackIndices = [
        1, 3, 6, 8, 10,       // Oitava 2
        13, 15, 18, 20, 22,   // Oitava 3
        25, 27, 30, 32, 34    // Oitava 4
    ];

    blackFendas.forEach((fenda, index) => {
        const div = document.createElement('div');
        div.className = 'key-b';
        div.style.left = (fenda * wWidth) - offset + 'px';
        addKeyEvents(div, blackIndices[index]);
        k.appendChild(div);
    });

    setupScrollWithMouse();
}

function addKeyEvents(el, noteIndex) {
    el.addEventListener('pointerdown', (e) => { isPointerDown = true; el.releasePointerCapture(e.pointerId); noteOn(el, noteIndex); });
    el.addEventListener('pointerenter', (e) => { if (isPointerDown || e.buttons === 1) noteOn(el, noteIndex); });
    el.addEventListener('pointerleave', () => noteOff(el, noteIndex));
    el.addEventListener('pointerup', () => { isPointerDown = false; noteOff(el, noteIndex); });
}

function noteOn(el, index) { if (!el.classList.contains('active')) { el.classList.add('active'); playNote(index); } }
function noteOff(el, index) { el.classList.remove('active'); stopNote(index); }

function updateSettings() {
    const timbreSelect = document.getElementById('timbreSelect');
    const pianoVol = document.getElementById('pianoVol');
    if (timbreSelect) currentTimbre = timbreSelect.value;
    if (pianoVol) pianoVolume = pianoVol.value / 100;
}

// 🚀 CONTROLE MODAL UNIFICADO POR IDs
function openModal(id) { 
    const target = document.getElementById(id);
    if (target) target.style.display = 'flex'; 
}

function closeModal(id) { 
    const target = document.getElementById(id);
    if (target) target.style.display = 'none'; 
}

function setupScrollWithMouse() {
    const slider = document.getElementById('viewport');
    if (!slider) return;
    let isDown = false; let startX; let scrollLeft;
    slider.addEventListener('mousedown', (e) => { if (e.target.closest('.key-w') || e.target.closest('.key-b')) return; isDown = true; startX = e.pageX - slider.offsetLeft; scrollLeft = slider.scrollLeft; });
    slider.addEventListener('mouseleave', () => isDown = false);
    slider.addEventListener('mouseup', () => isDown = false);
    slider.addEventListener('mousemove', (e) => { if (!isDown) return; e.preventDefault(); const x = e.pageX - slider.offsetLeft; const walk = (x - startX) * 2; slider.scrollLeft = scrollLeft - walk; });
}

function changeBPM(v) { 
    bpm = Math.max(40, Math.min(240, bpm + v)); 
    const bpmNum = document.getElementById('bpmNum');
    if (bpmNum) bpmNum.innerText = bpm; 
    if (playing) { stopTimer(); startTimer(); } 
}

function changeSig(v) { 
    sig = Math.max(1, Math.min(20, sig + v)); 
    const sigNum = document.getElementById('sigNum');
    if (sigNum) sigNum.innerText = sig; 
    beat = 0; 
}

function toggleMetro() { 
    if (audioCtx.state === 'suspended') audioCtx.resume(); 
    playing = !playing; 
    const btn = document.getElementById('metroPlay'); 
    if (playing) { 
        if (btn) { btn.innerText = 'PARAR'; btn.classList.add('playing'); }
        startTimer(); 
    } else { 
        if (btn) { btn.innerText = 'INICIAR'; btn.classList.remove('playing'); }
        stopTimer(); 
    } 
}

function startTimer() { 
    timer = setInterval(() => { 
        const n = document.getElementById('bpmNum'); 
        const isFirst = (beat === 0); 
        playClick(isFirst); 
        if (n) n.style.color = isFirst ? 'var(--primary)' : 'white'; 
        beat = (beat + 1) % sig; 
    }, (60 / bpm) * 1000); 
}

function stopTimer() { clearInterval(timer); beat = 0; }

// 🚀 BIND DE EVENTOS DA INTERFACE (Substituindo todos os oncliks/onchanges)
document.getElementById('btnOpenSettings')?.addEventListener('click', () => openModal('settingsModal'));
document.getElementById('btnOpenHelp')?.addEventListener('click', () => openModal('helpModal'));

document.getElementById('bpmMinus')?.addEventListener('click', () => changeBPM(-1));
document.getElementById('bpmPlus')?.addEventListener('click', () => changeBPM(1));
document.getElementById('sigMinus')?.addEventListener('click', () => changeSig(-1));
document.getElementById('sigPlus')?.addEventListener('click', () => changeSig(1));

document.getElementById('metroPlay')?.addEventListener('click', toggleMetro);

document.getElementById('timbreSelect')?.addEventListener('change', updateSettings);
document.getElementById('pianoVol')?.addEventListener('input', updateSettings);

// Fechamento dos Modais pelos botões 'X'
document.querySelectorAll('.close-modal').forEach(btn => {
    btn.addEventListener('click', (e) => {
        const modal = e.target.closest('.modal');
        if (modal) closeModal(modal.id);
    });
});

// Inicialização segura
initKeyboard();
const viewport = document.getElementById('viewport');
if (viewport) viewport.scrollLeft = 280; // Centraliza no C3