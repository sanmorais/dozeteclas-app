// scripts/ritmo-pro.js

// 🚀 IMPORTANTE: Reutilizando o contexto de áudio unificado do seu projeto
import { getAudioContext } from './audio-engine.js';

// 1. BANCO DE IMAGENS/SVGS DE FIGURAS RÍTMICAS (MAPEAMENTO DE SINAL)
const FIGURAS_SIMPLES = [
    {
        nome: "seminima",
        ataques: [0], 
        svg: `<svg viewBox="0 0 100 100" class="rhythm-icon">
                <circle cx="45" cy="70" r="12" fill="var(--primary)"/>
                <rect x="53" y="20" width="4" height="50" fill="var(--primary)"/>
              </svg>`
    },
    {
        nome: "duas_colcheias",
        ataques: [0, 0.5], 
        svg: `<svg viewBox="0 0 100 100" class="rhythm-icon">
                <circle cx="30" cy="70" r="10" fill="var(--primary)"/>
                <circle cx="70" cy="70" r="10" fill="var(--primary)"/>
                <rect x="36" y="25" width="4" height="45" fill="var(--primary)"/>
                <rect x="76" y="25" width="4" height="45" fill="var(--primary)"/>
                <rect x="36" y="21" width="44" height="8" fill="var(--primary)"/>
              </svg>`
    },
    {
        nome: "pausa_seminima",
        ataques: [], 
        svg: `<svg viewBox="0 0 100 100" class="rhythm-icon">
                <path d="M45 25 c0 5, 10 10, 5 15 c-10 10, 15 15, 5 25 c-5 5, -5 10, 0 10" stroke="var(--primary)" stroke-width="6" fill="none" stroke-linecap="round"/>
              </svg>`
    }
];

const FIGURAS_COMPOSTAS = [
    {
        nome: "tercina_colcheia",
        ataques: [0, 0.33, 0.66], 
        svg: `<svg viewBox="0 0 100 100" class="rhythm-icon">
                <text x="50" y="22" fill="var(--primary)" font-size="16" font-weight="900" text-anchor="middle">3</text>
                <circle cx="25" cy="75" r="8" fill="var(--primary)"/>
                <circle cx="50" cy="75" r="8" fill="var(--primary)"/>
                <circle cx="75" cy="75" r="8" fill="var(--primary)"/>
                <rect x="30" y="30" width="3" height="45" fill="var(--primary)"/>
                <rect x="55" y="30" width="3" height="45" fill="var(--primary)"/>
                <rect x="80" y="30" width="3" height="45" fill="var(--primary)"/>
                <rect x="30" y="27" width="53" height="6" fill="var(--primary)"/>
              </svg>`
    }
];

// 2. ESTADO DO TREINO RÍTMICO
let compassoAtual = "4/4";
let modoComp = "simples"; 
let exercicioAtual = []; 

// =========================================================================
// 🎲 GERADOR DE EXERCÍCIO ALEATÓRIO (POZZOLI DIGITAL)
// =========================================================================
function gerarExercicioAleatorio() {
    exercicioAtual = [];
    const bancoDisponivel = (modoComp === "simples") ? FIGURAS_SIMPLES : FIGURAS_COMPOSTAS;
    
    // Gera exatamente 20 tempos (5 linhas de 4 tempos)
    for (let i = 0; i < 20; i++) {
        const indexAleatorio = Math.floor(Math.random() * bancoDisponivel.length);
        exercicioAtual.push(bancoDisponivel[indexAleatorio]);
    }
    
    renderizarGradeDeRitmos();
}

function renderizarGradeDeRitmos() {
    const rhythmGrid = document.getElementById("rhythmGrid");
    if (!rhythmGrid) return;
    rhythmGrid.innerHTML = "";

    exercicioAtual.forEach((figura, index) => {
        const box = document.createElement("div");
        box.className = "rhythm-box";
        box.dataset.tempo = index + 1;
        
        box.innerHTML = `
            <div class="rhythm-svg-container">
                ${figura.svg}
            </div>
        `;

        rhythmGrid.appendChild(box);
    });
}

// =========================================================================
// 📱 CRIAÇÃO E GERENCIAMENTO DO POPUP DE SELEÇÃO DE COMPASSO (BLINDADO)
// =========================================================================
function abrirPopupCompasso() {
    // 🎯 REMOVE QUALQUER INSTÂNCIA ANTIGA DO POPUP DO DOM PARA EVITAR ERRO DE CACHE CSS
    const popupAntigo = document.getElementById("sigPopup");
    if (popupAntigo) {
        popupAntigo.remove();
    }

    const popup = document.createElement("div");
    popup.id = "sigPopup";
    
    // Força o estilo diretamente na propriedade style para que nenhuma classe CSS o ignore
    popup.style.position = "fixed";
    popup.style.zIndex = "99999";
    popup.style.left = "0";
    popup.style.top = "0";
    popup.style.width = "100%";
    popup.style.height = "100%";
    popup.style.background = "rgba(0,0,0,0.85)";
    popup.style.backdropFilter = "blur(8px)";
    popup.style.webkitBackdropFilter = "blur(8px)";
    popup.style.display = "flex";
    popup.style.alignItems = "center";
    popup.style.justifyContent = "center";

    popup.innerHTML = `
        <div class="modal-content" style="background: var(--card-bg); padding: 30px 25px; border-radius: 24px; width: 75%; max-width: 310px; border: 1px solid var(--primary); display: flex; flex-direction: column; gap: 15px;">
            <span class="section-label" style="font-size:16px; display:block; text-align:center; margin-bottom:5px; color: var(--primary); font-weight: 800; text-transform: uppercase;">Fórmula de Compasso</span>
            
            <div style="display:flex; flex-direction:column; gap:10px;">
                <span style="font-size: 10px; color: var(--primary); font-weight: 800; text-transform: uppercase; opacity: 0.6; margin-bottom: 5px; display: block;">Compassos Simples</span>
                <button class="select-sig-btn" data-sig="2/4" data-modo="simples" style="background: var(--primary); color: #1e2227; border: none; padding: 12px; border-radius: 10px; font-weight: 800; cursor: pointer; width: 100%;">2/4 (Binário)</button>
                <button class="select-sig-btn" data-sig="3/4" data-modo="simples" style="background: var(--primary); color: #1e2227; border: none; padding: 12px; border-radius: 10px; font-weight: 800; cursor: pointer; width: 100%; margin-top: 5px;">3/4 (Ternário)</button>
                <button class="select-sig-btn" data-sig="4/4" data-modo="simples" style="background: var(--primary); color: #1e2227; border: none; padding: 12px; border-radius: 10px; font-weight: 800; cursor: pointer; width: 100%; margin-top: 5px;">4/4 (Quaternário)</button>
                
                <span style="font-size: 10px; color: var(--primary); font-weight: 800; text-transform: uppercase; opacity: 0.6; margin: 15px 0 5px 0; display: block;">Compassos Compostos</span>
                <button class="select-sig-btn" data-sig="6/8" data-modo="composto" style="background: #121417; color: var(--primary); border: 1px solid var(--primary); padding: 12px; border-radius: 10px; font-weight: 800; cursor: pointer; width: 100%;">6/8 (Duplo Ternário)</button>
                <button class="select-sig-btn" data-sig="9/8" data-modo="composto" style="background: #121417; color: var(--primary); border: 1px solid var(--primary); padding: 12px; border-radius: 10px; font-weight: 800; cursor: pointer; width: 100%; margin-top: 5px;">9/8 (Triplo Ternário)</button>
                <button class="select-sig-btn" data-sig="12/8" data-modo="composto" style="background: #121417; color: var(--primary); border: 1px solid var(--primary); padding: 12px; border-radius: 10px; font-weight: 800; cursor: pointer; width: 100%; margin-top: 5px;">12/8 (Quádruplo Ternário)</button>
            </div>
        </div>
    `;

    document.body.appendChild(popup);

    // Adiciona evento de fechamento se clicar fora da caixa do modal
    popup.addEventListener("click", (e) => {
        if (e.target === popup) {
            popup.remove();
        }
    });

    // Adiciona evento de seleção nos botões do popup
    popup.querySelectorAll(".select-sig-btn").forEach(btn => {
        btn.onclick = () => {
            compassoAtual = btn.dataset.sig;
            modoComp = btn.dataset.modo;
            
            const sigText = document.querySelector(".sig-text");
            if (sigText) {
                sigText.textContent = `Compasso: ${compassoAtual}`;
            }
            
            popup.remove(); // Destrói o popup ao fechar
            gerarExercicioAleatorio();
        };
    });
}

// =========================================================================
// 🚀 INICIALIZAÇÃO SEGURA (GARANTE QUE O HTML EXISTE)
// =========================================================================
document.addEventListener("DOMContentLoaded", () => {
    const timeSigBtn = document.getElementById("timeSigBtn");
    const btnRegenRhythm = document.getElementById("btnRegenRhythm");
    
    if (timeSigBtn) {
        timeSigBtn.addEventListener("click", abrirPopupCompasso);
    }

    if (btnRegenRhythm) {
        btnRegenRhythm.addEventListener("click", () => {
            gerarExercicioAleatorio();
        });
    }
    
    // Sorteia as 5 linhas iniciais do Pozzoli
    gerarExercicioAleatorio();
});