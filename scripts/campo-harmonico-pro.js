// campo-harmonico-pro.js - Sequenciador e Substituições de Graus Harmônicos
// 🚀 IMPORTANTE: Buscando as funções de áudio diretamente do nosso motor centralizado
import { getAudioContext } from './audio-engine.js';

const tones = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
const ptNotes = ["dó", "ré", "mi", "fá", "sol", "lá", "si", "dó", "ré", "mi", "fá", "sol", "lá", "si"];
const degrees = ["I", "II", "III", "IV", "V", "VI", "VII"];
let userChoices = { "I": -1, "II": -1, "III": -1, "IV": -1, "V": -1, "VI": -1, "VII": -1 };

const chordsData = {
    "I": { original: { name: "7M", keys: [0, 4, 7, 11] }, subs: [{ label: "Relativo", name: "m7", keys: [9, 12, 16, 19] }, { label: "Anti-Rel", name: "m7", keys: [4, 7, 11, 14] }] },
    "II": { original: { name: "m7", keys: [2, 5, 9, 12] }, subs: [{ label: "Vizinhança", name: "7M", keys: [5, 9, 12, 16] }, { label: "Emprést.", name: "m7b5", keys: [2, 5, 8, 12] }] },
    "III": { original: { name: "m7", keys: [4, 7, 11, 14] }, subs: [{ label: "Relativo", name: "7M", keys: [0, 4, 7, 11] }, { label: "Vizinhança", name: "m7", keys: [9, 12, 16, 19] }] },
    "IV": { original: { name: "7M", keys: [5, 9, 12, 16] }, subs: [{ label: "Vizinhança", name: "m7", keys: [2, 5, 9, 12] }, { label: "Emprést.", name: "m6", keys: [5, 8, 12, 14] }] },
    "V": { original: { name: "7", keys: [7, 11, 14, 17] }, subs: [{ label: "SubV7", name: "7", keys: [1, 5, 8, 11] }, { label: "Diminuto", name: "º", keys: [11, 14, 17, 20] }] },
    "VI": { original: { name: "m7", keys: [9, 12, 16, 19] }, subs: [{ label: "Relativo", name: "7M", keys: [0, 4, 7, 11] }, { label: "Anti-Rel", name: "7M", keys: [5, 9, 12, 16] }] },
    "VII": { original: { name: "m7b5", keys: [11, 14, 17, 21] }, subs: [{ label: "Dominante", name: "7", keys: [7, 11, 14, 17] }, { label: "SubV", name: "7", keys: [0, 4, 7, 10] }] }
};

let currentRootIndex = 0, isPlaying = false, isLooping = false, playInterval, currentStep = 0;

function playTone(freq) {
    const ctx = getAudioContext(); // 🚀 Reutilizando o contexto unificado do motor
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    
    const savedTimbre = localStorage.getItem('dt_timbre') || 'triangle';
    const savedVol = (localStorage.getItem('dt_volume') || 15) / 100;
    
    osc.type = savedTimbre;
    osc.frequency.setValueAtTime(freq, ctx.currentTime);
    gain.gain.setValueAtTime(savedVol, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.6);
    osc.connect(gain); gain.connect(ctx.destination);
    osc.start(); osc.stop(ctx.currentTime + 0.6);
}

function playChord(notes) {
    notes.forEach((n, i) => setTimeout(() => playTone(130.81 * Math.pow(2, n / 12)), i * 30));
}

function init() {
    const tg = document.getElementById('tonGrid');
    if (!tg) return;

    tones.forEach((t, i) => {
        const b = document.createElement('button');
        b.className = 'btn-ton' + (i === 0 ? " active" : "");
        b.innerText = t;
        b.onclick = () => {
            document.querySelectorAll('.btn-ton').forEach(btn => btn.classList.remove('active'));
            b.classList.add('active');
            currentRootIndex = i;
            
            degrees.forEach(d => userChoices[d] = -1);
            
            updateChordDisplays();
            drawPiano([]);
        };
        tg.appendChild(b);
    });
    buildDegreeGrid();
    drawPiano([]);
}

function buildDegreeGrid() {
    const dg = document.getElementById('degGrid');
    if (!dg) return;
    dg.innerHTML = '';
    degrees.forEach((d) => {
        const box = document.createElement('div');
        box.className = 'degree-box';
        box.id = `box-${d}`;
        box.innerHTML = `
            <span class="deg-tag">${d}</span>
            <span class="chord-display" id="chord-${d}">---</span>
            <div class="sub-menu" id="menu-${d}">
                <button class="sub-btn" id="sub-${d}-orig">Original</button>
                <button class="sub-btn" id="sub-${d}-0">${chordsData[d].subs[0].label}</button>
                <button class="sub-btn" id="sub-${d}-1">${chordsData[d].subs[1].label}</button>
            </div>`;
        
        box.onclick = (e) => {
            if (e.target.tagName !== 'BUTTON') {
                document.querySelectorAll('.sub-menu').forEach(m => m.style.display = 'none');
                document.getElementById(`menu-${d}`).style.display = 'flex';
            }
        };
        dg.appendChild(box);

        // 🚀 BIND DOS CLIQUES DAS SUBSTITUIÇÕES DINÂMICAS VIA JS
        document.getElementById(`sub-${d}-orig`).onclick = () => apply(d, -1);
        document.getElementById(`sub-${d}-0`).onclick = () => apply(d, 0);
        document.getElementById(`sub-${d}-1`).onclick = () => apply(d, 1);
    });
    updateChordDisplays();
}

function updateChordDisplays() {
    degrees.forEach(d => {
        const disp = document.getElementById(`chord-${d}`);
        if (!disp) return;
        const optIdx = userChoices[d];
        const info = (optIdx === -1) ? chordsData[d].original : chordsData[d].subs[optIdx];
        disp.innerText = tones[(currentRootIndex + info.keys[0]) % 12] + info.name;

        document.querySelectorAll(`#menu-${d} .sub-btn`).forEach(b => b.classList.remove('selected'));
        if (optIdx === -1) document.getElementById(`sub-${d}-orig`)?.classList.add('selected');
        else document.getElementById(`sub-${d}-${optIdx}`)?.classList.add('selected');
    });
}

function getProcessedKeys(keys) {
    let tempKeys = keys.map(k => k + currentRootIndex);
    let root = tempKeys[0];
    let max = Math.max(...tempKeys);
    let shift = (root > 12 || max > 23) ? -12 : 0;
    return tempKeys.map(k => k + shift);
}

function apply(d, optIdx) {
    userChoices[d] = optIdx;
    updateChordDisplays();
    const keys = (optIdx === -1) ? chordsData[d].original.keys : chordsData[d].subs[optIdx].keys;
    const finalKeys = getProcessedKeys(keys);
    drawPiano(finalKeys);
    playChord(finalKeys);
    
    const menu = document.getElementById(`menu-${d}`);
    if (menu) menu.style.display = 'none';
}

function togglePlay() {
    isPlaying = !isPlaying;
    const icon = document.getElementById('playIcon');
    const bpmSelector = document.querySelector('.bpm-selector');
    if (!icon || !bpmSelector) return;

    if (isPlaying) {
        icon.innerHTML = '<path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/>';
        const runStep = () => {
            if (!isPlaying) return;
            document.querySelectorAll('.degree-box').forEach(b => b.classList.remove('playing'));
            const d = degrees[currentStep];
            const box = document.getElementById(`box-${d}`);
            if (box) box.classList.add('playing');

            const optIdx = userChoices[d];
            const keys = (optIdx === -1) ? chordsData[d].original.keys : chordsData[d].subs[optIdx].keys;
            const finalKeys = getProcessedKeys(keys);

            playChord(finalKeys);
            drawPiano(finalKeys);

            currentStep = (currentStep + 1) % degrees.length;
            if (currentStep === 0 && !isLooping) {
                setTimeout(() => { if (isPlaying) togglePlay(); }, (60 / bpmSelector.value) * 1000);
            }
        };
        runStep();
        playInterval = setInterval(runStep, (60 / bpmSelector.value) * 1000);
    } else {
        icon.innerHTML = '<path d="M8 5v14l11-7z"/>';
        clearInterval(playInterval);
        currentStep = 0;
        document.querySelectorAll('.degree-box').forEach(b => b.classList.remove('playing'));
        drawPiano([]);
    }
}

function toggleLoop() { 
    isLooping = !isLooping; 
    document.getElementById('loopBtn')?.classList.toggle('active'); 
}

function drawPiano(act = []) {
    const p = document.getElementById('piano');
    const l = document.getElementById('pianoLabels');
    if (!p || !l) return;
    p.innerHTML = ''; l.innerHTML = '';
    const whites = [0, 2, 4, 5, 7, 9, 11, 12, 14, 16, 17, 19, 21, 23];
    whites.forEach((n, i) => {
        const k = document.createElement('div');
        k.className = 'kw' + (act.includes(n) ? ' active' : '');
        p.appendChild(k);
        const lbl = document.createElement('div');
        lbl.className = 'note-lbl';
        lbl.innerText = ptNotes[i] || "";
        l.appendChild(lbl);
    });
    const blacks = [{n:1,x:4.8},{n:3,x:12},{n:6,x:26.2},{n:8,x:33.4},{n:10,x:40.5},{n:13,x:54.8},{n:15,x:62},{n:18,x:76.2},{n:20,x:83.4},{n:22,x:90.5}];
    blacks.forEach(b => {
        const k = document.createElement('div');
        k.className = 'kb' + (act.includes(b.n) ? ' active' : '');
        k.style.left = b.x + '%';
        p.appendChild(k);
    });
}

// 🚀 ATRIBUIÇÃO DOS BOTÕES DE TRANSPORTE FIXOS VIA JS
document.getElementById('playBtn')?.addEventListener('click', togglePlay);
document.getElementById('loopBtn')?.addEventListener('click', toggleLoop);

// Fechar os submenus de substituição se clicar fora de um box de grau
window.addEventListener('click', (e) => {
    if (!e.target.closest('.degree-box')) {
        document.querySelectorAll('.sub-menu').forEach(m => m.style.display = 'none');
    }
});

// Eventos do modal sem javascript inline
document.querySelectorAll('.btn-help').forEach(btn => {
    btn.addEventListener('click', () => {
        const modal = document.getElementById('helpModal');
        if (modal) modal.style.display = 'flex';
    });
});

document.getElementById('helpModal')?.addEventListener('click', (e) => {
    if (e.target.id === 'helpModal' || e.target.classList.contains('btn-ton')) {
        document.getElementById('helpModal').style.display = 'none';
    }
});

// Inicialização segura
init();