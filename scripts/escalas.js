// escalas.js - Lógica da Ferramenta de Escalas
// 🚀 IMPORTANTE: Buscando as funções de áudio diretamente do nosso motor centralizado
import { playTone, getFreq } from './audio-engine.js';

// MOTOR DE ARPEJO SINCRONIZADO COM O VISUAL
function playScaleSequence(notesArray) {
    notesArray.forEach((note, i) => {
        setTimeout(() => {
            // Chamando as funções que importamos do arquivo central
            playTone(getFreq(note)); 
            animateKey(note);
        }, i * 320); // Velocidade do arpejo
    });
}

// ANIMAÇÃO DE PRESSÃO DA TECLA
function animateKey(noteValue) {
    const key = document.querySelector(`[data-note="${noteValue}"]`);
    if (key) {
        key.classList.add('playing');
        setTimeout(() => key.classList.remove('playing'), 200);
    }
}

const NOTES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
const SCALES = {
    "major": { name: "Maior", intervals: [0, 2, 4, 5, 7, 9, 11, 12] },
    "minor": { name: "Menor Natural", intervals: [0, 2, 3, 5, 7, 8, 10, 12] },
    "m_harmonic": { name: "Menor Harmônica", intervals: [0, 2, 3, 5, 7, 8, 11, 12] },
    "m_melodic": { name: "Menor Melódica", intervals: [0, 2, 3, 5, 7, 9, 11, 12] },
    "dorian": { name: "Dórico", intervals: [0, 2, 3, 5, 7, 9, 10, 12] },
    "phrygian": { name: "Frígio", intervals: [0, 1, 3, 5, 7, 8, 10, 12] },
    "lydian": { name: "Lídio", intervals: [0, 2, 4, 6, 7, 9, 11, 12] },
    "mixolydian": { name: "Mixolídio", intervals: [0, 2, 4, 5, 7, 9, 10, 12] },
    "locrian": { name: "Lócrio", intervals: [0, 1, 3, 5, 6, 8, 10, 12] },
    "penta_maj": { name: "Pentatônica Maior", intervals: [0, 2, 4, 7, 9, 12] },
    "penta_min": { name: "Pentatônica Menor", intervals: [0, 3, 5, 7, 10, 12] },
    "penta_blues": { name: "Penta Blues", intervals: [0, 3, 5, 6, 7, 10, 12] },
    "whole_tone": { name: "Tons Inteiros", intervals: [0, 2, 4, 6, 8, 10, 12] },
    "altered": { name: "Alterada", intervals: [0, 1, 3, 4, 6, 8, 10, 12] },
    "bebop_dom": { name: "Bebop Dominante", intervals: [0, 2, 4, 5, 7, 9, 10, 11, 12] }
};

let currentRoot = 0;

function init() {
    const grid = document.getElementById('noteSelector');
    if (!grid) return;
    
    NOTES.forEach((n, i) => {
        const b = document.createElement('button');
        b.className = 'btn-sel' + (i === 0 ? ' active' : '');
        b.innerText = n;
        b.onclick = (e) => {
            document.querySelectorAll('#noteSelector .btn-sel').forEach(x => x.classList.remove('active'));
            e.target.classList.add('active');
            currentRoot = i;
            updateScale();
        };
        grid.appendChild(b);
    });
    updateScale(false);
}

// Vincula a mudança do select de escala diretamente por JavaScript (Remove o onChange="updateScale()" do HTML)
document.getElementById('scaleType')?.addEventListener('change', () => updateScale(true));

function updateScale(shouldPlay = true) {
    const scaleTypeEl = document.getElementById('scaleType');
    const nameDisplay = document.getElementById('scaleNameDisplay');
    const notesDisplay = document.getElementById('scaleNotesDisplay');
    
    if (!scaleTypeEl) return;
    const type = scaleTypeEl.value;
    const scaleData = SCALES[type];
    
    if (nameDisplay) nameDisplay.innerText = NOTES[currentRoot] + " " + scaleData.name;
    
    const absoluteNotes = scaleData.intervals.map(iv => (currentRoot + iv));
    if (notesDisplay) notesDisplay.innerText = absoluteNotes.map(n => NOTES[n % 12]).join(" – ");
    
    drawKeyboard('pianoScale', absoluteNotes);
    if (shouldPlay) playScaleSequence(absoluteNotes);
}

function drawKeyboard(id, activeNotes) {
    const p = document.getElementById(id);
    if (!p) return;
    p.innerHTML = '';
    
    const whiteKeyNotes = [0, 2, 4, 5, 7, 9, 11, 12, 14, 16, 17, 19, 21, 23];
    whiteKeyNotes.forEach((noteValue) => {
        const key = document.createElement('div');
        key.className = 'key-w';
        key.dataset.note = noteValue; 
        if (activeNotes.includes(noteValue)) key.classList.add('active');
        p.appendChild(key);
    });

    const blackKeyMap = [
        {n: 1, pos: 4.8}, {n: 3, pos: 12}, {n: 6, pos: 26.2}, {n: 8, pos: 33.4}, {n: 10, pos: 40.5},
        {n: 13, pos: 54.8}, {n: 15, pos: 62}, {n: 18, pos: 76.2}, {n: 20, pos: 83.4}, {n: 22, pos: 90.5}
    ];

    blackKeyMap.forEach(item => {
        const key = document.createElement('div');
        key.className = 'key-b';
        key.style.left = item.pos + '%';
        key.dataset.note = item.n; 
        if (activeNotes.includes(item.n)) key.classList.add('active');
        p.appendChild(key);
    });
}

// Configuração dos cliques do Modal de Ajuda (Remove o onclick inline do HTML)
document.getElementById('btnHelp')?.addEventListener('click', () => {
    const modal = document.getElementById('helpModal');
    if (modal) modal.style.display = 'flex';
});

document.getElementById('btnCloseHelp')?.addEventListener('click', () => {
    const modal = document.getElementById('helpModal');
    if (modal) modal.style.display = 'none';
});

window.addEventListener('click', (event) => {
    const modal = document.getElementById('helpModal');
    if (event.target === modal) {
        modal.style.display = 'none';
    }
});

// Inicialização automática ao carregar o script
init();