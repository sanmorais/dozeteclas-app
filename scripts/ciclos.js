// ciclos.js - Lógica e Animação do Círculo de Quintas/Quartas

let rotationDirection = -0.18; 
const notesSharp = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
const notesFlat  = ["C", "Db", "D", "Eb", "E", "F", "Gb", "G", "Ab", "A", "Bb", "B"];
const relMinCustom = ["Am", "Bbm", "Bm", "Cm", "C#m", "Dm", "Ebm", "Em", "Fm", "F#m", "Gm", "G#m"];

const cycles = {
    "5ths": [0, 7, 2, 9, 4, 11, 6, 1, 8, 3, 10, 5], 
    "4ths": [0, 7, 2, 9, 4, 11, 6, 1, 8, 3, 10, 5], 
    "relMinor": [0, 7, 2, 9, 4, 11, 6, 1, 8, 3, 10, 5],
    "relMajor": [0, 7, 2, 9, 4, 11, 6, 1, 8, 3, 10, 5]
};

let isPlaying = true;
let currentRotation = 0;
let currentCycleKey = "4ths";
let targetIdx = 0; 
let animationId;

function getFormattedNote(idx, type) {
    const i = (idx % 12 + 12) % 12;
    let useFlat = (currentCycleKey === "4ths" || [1, 3, 6, 8, 10].includes(i));
    if (currentCycleKey === "5ths") useFlat = false;

    const nameBase = useFlat ? notesFlat[i] : notesSharp[i];
    const relBase = relMinCustom[i];

    if (currentCycleKey === "4ths" || currentCycleKey === "5ths") return nameBase;
    if (currentCycleKey === "relMinor") return (type === 'center') ? nameBase : relBase;
    if (currentCycleKey === "relMajor") return (type === 'center') ? relBase : nameBase;
    return nameBase;
}

function createWheel() {
    const wheel = document.getElementById('wheel');
    if (!wheel) return;
    wheel.innerHTML = '';
    const sequence = cycles[currentCycleKey];

    for (let i = 0; i < 12; i++) {
        const angle = (i * 30) * (Math.PI / 180);
        const x = 115 * Math.sin(angle);
        const y = -115 * Math.cos(angle);
        
        const wrapper = document.createElement('div');
        wrapper.className = 'note-wrapper';
        wrapper.style.transform = `translate(${x}px, ${y}px)`;
        
        const circle = document.createElement('div');
        circle.className = 'note-circle';
        const noteIndex = sequence[i]; 
		
        circle.innerText = getFormattedNote(noteIndex, 'wheel');
        circle.dataset.noteIdx = noteIndex;
        
        wrapper.appendChild(circle);
        wheel.appendChild(wrapper);
    }
}

function animate() {
    if (!isPlaying) return;
    const wheel = document.getElementById('wheel');
    if (!wheel) return;
    
    currentRotation += rotationDirection; 
    wheel.style.transform = `rotate(${currentRotation}deg)`;
    document.querySelectorAll('.note-wrapper').forEach(w => {
        const t = w.style.transform.split('rotate')[0];
        w.style.transform = `${t} rotate(${-currentRotation}deg)`;
    });
    animationId = requestAnimationFrame(animate);
}

function togglePlay() {
    isPlaying = !isPlaying;
    const btn = document.getElementById('btnPlay');
    if (btn) {
        if (isPlaying) {
            btn.innerHTML = `<svg width="24" height="24" viewBox="0 0 24 24" style="pointer-events:none"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" fill="#FFC502"/></svg>`;
            animate();
        } else {
            btn.innerHTML = `<svg width="24" height="24" viewBox="0 0 24 24" style="pointer-events:none"><path d="M8 5v14l11-7z" fill="#FFC502"/></svg>`;
            cancelAnimationFrame(animationId);
        }
    }
}

function updateCycleMode() {
    const cycleModeEl = document.getElementById('cycleMode');
    if (!cycleModeEl) return;
    
    currentCycleKey = cycleModeEl.value;
	
    if (currentCycleKey === '4ths') {
        rotationDirection = -0.18; 
    } else if (currentCycleKey === '5ths') {
        rotationDirection = 0.18;
    } else {
        rotationDirection = 0.18;
    }

    pickRandomTarget();
    createWheel();
}

function pickRandomTarget() {
    const display = document.getElementById('targetDisplay');
    if (!display) return;
    
    targetIdx = Math.floor(Math.random() * 12);
    display.innerText = getFormattedNote(targetIdx, 'center');
    display.style.fontSize = (currentCycleKey === 'relMajor') ? '60px' : '75px';
}

// 🚀 ESCUTA DOS SELETORES E CLIQUES VIA SCRIPT
document.getElementById('cycleMode')?.addEventListener('change', updateCycleMode);
document.getElementById('btnPlay')?.addEventListener('click', togglePlay);

document.getElementById('wheel')?.addEventListener('click', (e) => {
    if (e.target.classList.contains('note-circle')) {
        const clicked = parseInt(e.target.dataset.noteIdx);
        const seq = cycles[currentCycleKey];
        let isCorrect = false;

        if (currentCycleKey === "relMinor" || currentCycleKey === "relMajor") {
            isCorrect = (clicked === targetIdx);
        } else if (currentCycleKey === "5ths") {
            const currentPos = seq.indexOf(targetIdx);
            isCorrect = (clicked === seq[(currentPos + 1) % 12]);
        } else if (currentCycleKey === "4ths") {
            const currentPos = seq.indexOf(targetIdx);
            isCorrect = (clicked === seq[(currentPos - 1 + 12) % 12]);
        }
		
        const display = document.getElementById('targetDisplay');
        const container = document.getElementById('mainContainer');
        if (!display || !container) return;

        if (isCorrect) {
            display.classList.add('correct');
            setTimeout(() => {
                display.classList.remove('correct');
                pickRandomTarget();
            }, 400);
        } else {
            display.classList.add('wrong');
            container.classList.add('shake');
            setTimeout(() => {
                display.classList.remove('wrong');
                container.classList.remove('shake');
            }, 400);
        }
    }
});

// Configuração dos modais sem javascript inline
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

// Inicialização segura
updateCycleMode(); 
animate();