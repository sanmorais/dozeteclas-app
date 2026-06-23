// inversoes.js - Lógica da Ferramenta de Inversões de Acordes
// 🚀 IMPORTANTE: Buscando as funções de áudio diretamente do nosso motor centralizado
import { playTone, getFreq } from './audio-engine.js';

function playChord(notesArray) {
    notesArray.forEach((note, i) => {
        setTimeout(() => playTone(getFreq(note)), i * 35);
    });
}

// --- LÓGICA DE INVERSÕES ---
const NOTES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
let currentRoot = 0;
let currentMode = "Maj";

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
            renderAll();
        };
        grid.appendChild(b);
    });
    renderAll(false);
}

// 🚀 DESACOPLAMENTO DE EVENTO: Vincula os botões de modo (Maior/Menor) diretamente via JavaScript
// Isso elimina a necessidade do onclick="setMode('Maj', this)" que estava no HTML!
document.querySelectorAll('.mode-selector .btn-sel').forEach(btn => {
    btn.addEventListener('click', (e) => {
        const mode = e.target.innerText === 'Maior' ? 'Maj' : 'Min';
        
        e.target.parentNode.querySelectorAll('.btn-sel').forEach(x => x.classList.remove('active'));
        e.target.classList.add('active');
        currentMode = mode;
        renderAll();
    });
});

function renderAll(shouldPlay = true) {
    const triad = currentMode === "Maj" ? [0, 4, 7] : [0, 3, 7];
    const titles = ["Fundamental", "1ª Inversão", "2ª Inversão"];
    let baseChordNotes = [];
    
    for (let inv = 0; inv < 3; inv++) {
        let intervals = [...triad];
        for (let i = 0; i < inv; i++) {
            let first = intervals.shift();
            intervals.push(first + 12);
        }

        if (Math.max(...intervals) + currentRoot >= 24) {
            intervals = intervals.map(v => v - 12);
        }

        const absNotes = intervals.map(iv => iv + currentRoot);
        if (inv === 0) baseChordNotes = absNotes; 

        const row = document.getElementById(`row-${inv}`);
        if (!row) continue;

        const notesText = intervals.map(iv => NOTES[((currentRoot + iv) % 12 + 12) % 12]).join(" – ");

        row.innerHTML = `
            <div class="inv-header">
                <span class="inv-name">${titles[inv]}</span>
                <span class="inv-notes">${notesText}</span>
            </div>
            <div class="piano-mini" id="kb-${inv}"></div>
        `;
        drawKeyboard(`kb-${inv}`, absNotes);
    }

    if (shouldPlay) playChord(baseChordNotes);
}

function drawKeyboard(id, activeNotes) {
    const p = document.getElementById(id);
    if (!p) return;
    p.innerHTML = '';
    
    const whiteKeyNotes = [0, 2, 4, 5, 7, 9, 11, 12, 14, 16, 17, 19, 21, 23];
    whiteKeyNotes.forEach((noteValue) => {
        const key = document.createElement('div');
        key.className = 'key-w';
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
        if (activeNotes.includes(item.n)) key.classList.add('active');
        p.appendChild(key);
    });
}

// Configuração manual dos Modais para remover inline scripts
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
    if (event.target == modal) {
        modal.style.display = 'none';
    }
});

// Inicialização automática
init();