// dicionario.js - Lógica da Ferramenta de Dicionário de Acordes
// 🚀 IMPORTANTE: Buscando as funções de áudio diretamente do nosso motor centralizado
import { playTone, getFreq } from './audio-engine.js';

function playChord(notesArray) {
    notesArray.forEach((note, i) => {
        setTimeout(() => playTone(getFreq(note)), i * 35);
    });
}

// --- LÓGICA DO DICIONÁRIO ---
const NOTES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
const CHORDS = {
    // Tríades Básicas e Suspensas
    "maj": { name: "", intervals: [0, 4, 7] },
    "min": { name: "m", intervals: [0, 3, 7] },
    "sus2": { name: "sus2", intervals: [0, 2, 7] },
    "sus4": { name: "sus4", intervals: [0, 5, 7] },
    "dim": { name: "dim", intervals: [0, 3, 6] },
    "aug": { name: "aug", intervals: [0, 4, 8] },
    
    // Tétrades
    "maj7": { name: "Maj7", intervals: [0, 4, 7, 11] },
    "7": { name: "7", intervals: [0, 4, 7, 10] },
    "m7": { name: "m7", intervals: [0, 3, 7, 10] },
    "m7b5": { name: "m7(b5)", intervals: [0, 3, 6, 10] },
    "dim7": { name: "dim7", intervals: [0, 3, 6, 9] },

    // Sextas e Adições
    "maj6": { name: "6", intervals: [0, 4, 7, 9] },
    "min6": { name: "m6", intervals: [0, 3, 7, 9] },
    "add9": { name: "add9", intervals: [0, 4, 7, 14] }, 
    "madd9": { name: "m(add9)", intervals: [0, 3, 7, 14] }
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
            updateChord();
        };
        grid.appendChild(b);
    });
    updateChord(false); 
}

// 🚀 DESACOPLAMENTO DO SELECT: O próprio script ouve as mudanças de tipo de acorde
document.getElementById('chordType')?.addEventListener('change', () => updateChord(true));

function updateChord(shouldPlaySound = true) {
    const chordTypeEl = document.getElementById('chordType');
    const nameDisplay = document.getElementById('chordNameDisplay');
    const notesDisplay = document.getElementById('chordNotesDisplay');
    
    if (!chordTypeEl) return;
    const type = chordTypeEl.value;
    const chordData = CHORDS[type];
    
    if (nameDisplay) nameDisplay.innerText = NOTES[currentRoot] + chordData.name;
    
    const absoluteNotes = chordData.intervals.map(iv => (currentRoot + iv));
    if (notesDisplay) notesDisplay.innerText = absoluteNotes.map(n => NOTES[n % 12]).join(" – ");
    
    drawKeyboard('pianoMain', absoluteNotes);

    if (shouldPlaySound) { playChord(absoluteNotes); }
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

// 🚀 EVENTOS DO MODAL: Desacoplados dos atributos HTML
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

init();