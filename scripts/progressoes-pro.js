// scripts/progressoes-pro.js

// 🚀 IMPORTANTE: Reutilizando o contexto de áudio unificado do seu projeto
import { getAudioContext } from './audio-engine.js';

// 1. DICIONÁRIO DE NOTAS (ESCALA CROMÁTICA)
const ESCALA = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];

// 2. CADASTRO SEQUENCIAL DE PROGRESSÕES
// 🎯 Adicionado o mapeamento físico de intervalos (keys) para reprodução exata das tríades e tétrades
const PROGRESSOES = [
    {
        nome: "I - V - VIm - IV (Balada Pop/Rock)",
        graus: [
            { grau: "I", semitons: 0, sufixo: "", desc: "1º maior", keys: [0, 4, 7, 12] },
            { grau: "V", semitons: 7, sufixo: "", desc: "5º maior", keys: [7, 11, 14, 19] },
            { grau: "VIm", semitons: 9, sufixo: "m", desc: "6º menor", keys: [9, 12, 16, 21] },
            { grau: "IV", semitons: 5, sufixo: "", desc: "4º maior", keys: [5, 9, 12, 17] }
        ]
    },
    {
        nome: "I - IV - V (Sertanejo / Folk / Rock)",
        graus: [
            { grau: "I", semitons: 0, sufixo: "", desc: "1º maior", keys: [0, 4, 7, 12] },
            { grau: "IV", semitons: 5, sufixo: "", desc: "4º maior", keys: [5, 9, 12, 17] },
            { grau: "V", semitons: 7, sufixo: "", desc: "5º maior", keys: [7, 11, 14, 19] },
            { grau: "I", semitons: 0, sufixo: "", desc: "1º maior", keys: [0, 4, 7, 12] }
        ]
    },
    {
        nome: "I - VIm - IV - V (Balada Anos 50/60)",
        graus: [
            { grau: "I", semitons: 0, sufixo: "", desc: "1º maior", keys: [0, 4, 7, 12] },
            { grau: "VIm", semitons: 9, sufixo: "m", desc: "6º menor", keys: [9, 12, 16, 21] },
            { grau: "IV", semitons: 5, sufixo: "", desc: "4º maior", keys: [5, 9, 12, 17] },
            { grau: "V", semitons: 7, sufixo: "", desc: "5º maior", keys: [7, 11, 14, 19] }
        ]
    },
    {
        nome: "VIm - IV - I - V (Pop/Rock Menor)",
        graus: [
            { grau: "VIm", semitons: 9, sufixo: "m", desc: "6º menor", keys: [9, 12, 16, 21] },
            { grau: "IV", semitons: 5, sufixo: "", desc: "4º maior", keys: [5, 9, 12, 17] },
            { grau: "I", semitons: 0, sufixo: "", desc: "1º maior", keys: [0, 4, 7, 12] },
            { grau: "V", semitons: 7, sufixo: "", desc: "5º maior", keys: [7, 11, 14, 19] }
        ]
    },
    {
        nome: "IIm7 - V7 - I7M - VI7 (Jazz / R&B)",
        graus: [
            { grau: "IIm7", semitons: 2, sufixo: "m7", desc: "2º menor", keys: [2, 5, 9, 12] },
            { grau: "V7", semitons: 7, sufixo: "7", desc: "5º dominante", keys: [7, 11, 14, 17] },
            { grau: "I7M", semitons: 0, sufixo: "7M", desc: "1º maior", keys: [0, 4, 7, 11] },
            { grau: "VI7(b9)", semitons: 9, sufixo: "7(b9)", desc: "Subst. dominante", keys: [9, 13, 16, 20] }
        ]
    },
    {
        nome: "I7M - VIm7 - IIm7 - V7 (Bossa Nova Standard)",
        graus: [
            { grau: "I7M", semitons: 0, sufixo: "7M", desc: "1º maior", keys: [0, 4, 7, 11] },
            { grau: "VIm7", semitons: 9, sufixo: "m7", desc: "6º menor", keys: [9, 12, 16, 19] },
            { grau: "IIm7", semitons: 2, sufixo: "m7", desc: "2º menor", keys: [2, 5, 9, 12] },
            { grau: "V7", semitons: 7, sufixo: "7", desc: "5º dominante", keys: [7, 11, 14, 17] }
        ]
    },
    {
        nome: "IV7M - III7 - VIm7 - I7 (Neo-Soul Moderno)",
        graus: [
            { grau: "IV7M", semitons: 5, sufixo: "7M", desc: "4º maior", keys: [5, 9, 12, 16] },
            { grau: "III7", semitons: 4, sufixo: "7", desc: "3º dominante", keys: [4, 8, 11, 14] },
            { grau: "VIm7", semitons: 9, sufixo: "m7", desc: "6º menor", keys: [9, 12, 16, 19] },
            { grau: "I7", semitons: 0, sufixo: "7", desc: "1º dominante", keys: [0, 4, 7, 10] }
        ]
    },
    {
        nome: "I7M - I7 - IV7M - IVm6 (MPB / Cinematic)",
        graus: [
            { grau: "I7M", semitons: 0, sufixo: "7M", desc: "1º maior", keys: [0, 4, 7, 11] },
            { grau: "I7", semitons: 0, sufixo: "7", desc: "1º dominante", keys: [0, 4, 7, 10] },
            { grau: "IV7M", semitons: 5, sufixo: "7M", desc: "4º maior", keys: [5, 9, 12, 16] },
            { grau: "IVm6", semitons: 5, sufixo: "m6", desc: "4º menor", keys: [5, 8, 12, 14] }
        ]
    }
];

// 3. ESTADO DA APLICAÇÃO
let tonicaAtualIndex = 0; // Começa em C (Dó)
let progressaoAtivaIndex = 0; // Primeira progressão
let reproduzindo = false;
let loopAtivo = true;
let compassoTimer = null;
let acordeAtualIndex = 0;

// Elementos da Interface
const chordFocus = document.getElementById("chordFocus");
const btnToneDown = document.getElementById("btn-tone-down");
const btnToneUp = document.getElementById("btn-tone-up");
const progressionToggleBtn = document.getElementById("progressionToggleBtn");
const progressionText = document.querySelector(".progression-text");
const cardsContainer = document.querySelector(".progression-cards-grid");
const playBtn = document.getElementById("playBtn");
const playIcon = document.getElementById("playIcon");
const loopBtn = document.getElementById("loopBtn");
const bpmSelector = document.querySelector(".bpm-selector");

// Ajuda Externa
const openHelpBtn = document.getElementById("openHelpBtn");
const closeHelpBtn = document.getElementById("closeHelpBtn");
const helpModal = document.getElementById("helpModal");

// =========================================================================
// 🔊 MOTOR DE ÁUDIO REUTILIZADO (DO SEU CAMPO HARMÔNICO)
// =========================================================================
function playTone(freq) {
    const ctx = getAudioContext(); // Reutiliza o contexto unificado
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    
    // Configurações do seu Painel / Configurações do teclado
    const savedTimbre = localStorage.getItem('dt_timbre') || 'triangle';
    const savedVol = (localStorage.getItem('dt_volume') || 15) / 100;
    
    osc.type = savedTimbre;
    osc.frequency.setValueAtTime(freq, ctx.currentTime);
    gain.gain.setValueAtTime(savedVol, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.6); // Envelope clássico
    
    osc.connect(gain); 
    gain.connect(ctx.destination);
    
    osc.start(); 
    osc.stop(ctx.currentTime + 0.6);
}

// Executa as notas em arpejo sequencial de 30ms para efeito de dedilhado
function playChord(notes) {
    notes.forEach((n, i) => {
        setTimeout(() => {
            // Frequência fundamental baseada no Dó Central (130.81Hz C3)
            playTone(130.81 * Math.pow(2, n / 12));
        }, i * 30);
    });
}

// Traduz os intervalos relativos somando a tônica atual do topo
function getProcessedKeys(keys) {
    return keys.map(k => k + tonicaAtualIndex);
}

// =========================================================================
// 📐 RENDERIZAÇÃO DOS ACORDES E TRANSPOSIÇÃO
// =========================================================================
function renderizarMódulo() {
    // Atualiza a nota tônica do cabeçalho
    chordFocus.textContent = ESCALA[tonicaAtualIndex];

    const progressao = PROGRESSOES[progressaoAtivaIndex];
    progressionText.textContent = progressao.nome;

    cardsContainer.innerHTML = "";
    
    progressao.graus.forEach((grauObj, index) => {
        // Calcula a nota fundamental do grau com base na transposição da tônica
        const notaCalculada = ESCALA[(tonicaAtualIndex + grauObj.semitons) % 12];
        const nomeCompletoAcorde = `${notaCalculada}${grauObj.sufixo}`;

        const card = document.createElement("div");
        card.className = "prog-box";
        
        // Aplica o brilho amarelo no acorde atual tocando
        if (reproduzindo && index === acordeAtualIndex) {
            card.classList.add("active-glow");
        }

        card.innerHTML = `
            <span class="deg-tag">${grauObj.grau}</span>
            <span class="chord-display">${nomeCompletoAcorde}</span>
            <span class="deg-desc">${grauObj.desc}</span>
        `;

        // Clique para ouvir o acorde individualmente
        card.onclick = () => {
            if (!reproduzindo) {
                const finalKeys = getProcessedKeys(grauObj.keys);
                playChord(finalKeys);
            }
        };

        cardsContainer.appendChild(card);
    });
}

// =========================================================================
// ⚙️ CONTROLES GERAIS E EVENTOS DE CLIQUE (BLINDADOS)
// =========================================================================

// Função de inicialização segura que amarra os botões após o HTML carregar
document.addEventListener("DOMContentLoaded", () => {
    // 1. Renderiza o módulo pela primeira vez
    renderizarMódulo();

    // 2. Vincula os botões de transposição
    if (btnToneDown) {
        btnToneDown.addEventListener("click", () => {
            tonicaAtualIndex = (tonicaAtualIndex - 1 + 12) % 12;
            renderizarMódulo();
        });
    }

    if (btnToneUp) {
        btnToneUp.addEventListener("click", () => {
            tonicaAtualIndex = (tonicaAtualIndex + 1) % 12;
            renderizarMódulo();
        });
    }

    // 3. Vincula o botão de alternar progressões
    if (progressionToggleBtn) {
        progressionToggleBtn.addEventListener("click", () => {
            pararReproducao();
            progressaoAtivaIndex = (progressaoAtivaIndex + 1) % PROGRESSOES.length;
            renderizarMódulo();
        });
    }

    // 4. Vincula o Modal de Ajuda (Seção de Ajuda Externa)
    if (openHelpBtn && helpModal) {
        openHelpBtn.addEventListener("click", () => helpModal.style.display = "flex");
    }
    
    if (closeHelpBtn && helpModal) {
        closeHelpBtn.addEventListener("click", () => helpModal.style.display = "none");
    }

    window.addEventListener("click", (e) => {
        if (helpModal && e.target === helpModal) {
            helpModal.style.display = "none";
        }
    });

    // 5. VINCULA OS BOTÕES DE TRANSPORTE (PLAY E LOOP) DE FORMA SEGURA
    if (playBtn) {
        playBtn.addEventListener("click", () => {
            if (reproduzindo) {
                pararReproducao();
            } else {
                iniciarReproducao();
            }
        });
    }

    if (loopBtn) {
        // Define o estado visual inicial baseado na variável
        loopBtn.classList.toggle("active", loopAtivo);

        loopBtn.addEventListener("click", () => {
            loopAtivo = !loopAtivo;
            loopBtn.classList.toggle("active", loopAtivo);
        });
    }
});

// =========================================================================
// ⏱️ METRÔNOMO E REPRODUÇÃO SEQUENCIAL (BPM)
// =========================================================================
function dispararProximoAcorde() {
    if (!reproduzindo) return;

    const progressao = PROGRESSOES[progressaoAtivaIndex];
    
    // 1. Se estourar o limite de acordes da progressão
    if (acordeAtualIndex >= progressao.graus.length) {
        if (loopAtivo) {
            acordeAtualIndex = 0; // Se o loop estiver ativo, reseta para o primeiro
        } else {
            pararReproducao(); // Caso contrário, para a execução aqui
            return;
        }
    }

    // 2. Identifica e toca as notas do acorde atual
    const grauObj = progressao.graus[acordeAtualIndex];
    const finalKeys = getProcessedKeys(grauObj.keys);
    
    playChord(finalKeys);
    renderizarMódulo();

    // 3. Prepara o index para o próximo acorde na sequência
    acordeAtualIndex++;

    // 4. Captura o BPM do seletor de forma segura
    const selectorElement = document.querySelector(".bpm-selector");
    const bpm = selectorElement ? parseInt(selectorElement.value, 10) : 100;
    
    // Calcula o tempo de intervalo em milissegundos
    const intervaloMs = (60 / bpm) * 1000;

    // Agenda o próximo passo de forma encadeada
    compassoTimer = setTimeout(dispararProximoAcorde, intervaloMs);
}

function iniciarReproducao() {
    reproduzindo = true;
    acordeAtualIndex = 0; // Começa estritamente do primeiro acorde
    if (playIcon) {
        playIcon.innerHTML = `<path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/>`; // Ícone de Pause
    }
    dispararProximoAcorde();
}

function pararReproducao() {
    reproduzindo = false;
    if (compassoTimer) {
        clearTimeout(compassoTimer);
    }
    acordeAtualIndex = 0;
    if (playIcon) {
        playIcon.innerHTML = `<path d="M8 5v14l11-7z"/>`; // Ícone de Play
    }
    renderizarMódulo(); // Remove os destaques amarelos
}

// =========================================================================
// 🚀 INICIALIZAÇÃO
// =========================================================================
document.addEventListener("DOMContentLoaded", () => {
    renderizarMódulo();
}); 