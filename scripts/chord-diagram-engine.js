// scripts/chord-diagram-engine.js
// Motor centralizado de análise harmônica e renderização de diagramas de teclado

export const NOTAS_NOMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];

const ENARMONIAS = {
  "Db": "C#", "Eb": "D#", "Gb": "F#", "Ab": "G#", "Bb": "A#"
};

// Dicionário com o vocabulário harmônico estendido do Doze Teclas
export const TABELA_INTERVALOS = {
  // Tríades & Suspensões
  "": [0, 4, 7],
  "m": [0, 3, 7],
  "sus2": [0, 2, 7],
  "sus4": [0, 5, 7],
  "4": [0, 5, 7],
  "7sus4": [0, 5, 7, 10],

  // Quinta Aumentada (5#)
  "5#": [0, 4, 8],
  "aug": [0, 4, 8],
  "7(5#)": [0, 4, 8, 10],       // Fundamental (0), 3M (4), 5Aum (8), 7m (10)
  "7(#5)": [0, 4, 8, 10],
  "7M(5#)": [0, 4, 8, 11],

  // Diminutos & Meio-diminutos
  "º": [0, 3, 6],
  "dim": [0, 3, 6],
  "º7": [0, 3, 6, 9],
  "dim7": [0, 3, 6, 9],
  "m7(b5)": [0, 3, 6, 10],
  "m7b5": [0, 3, 6, 10],

  // Sétimas, Sextas e Adições
  "6": [0, 4, 7, 9],
  "m6": [0, 3, 7, 9],
  "7": [0, 4, 7, 10],
  "7M": [0, 4, 7, 11],
  "maj7": [0, 4, 7, 11],
  "m7": [0, 3, 7, 10],
  "m7M": [0, 3, 7, 11],
  "9": [0, 4, 7, 10, 14],
  "add9": [0, 2, 4, 7],
  "m(add9)": [0, 3, 7, 14],
  "madd9": [0, 3, 7, 14],
  "m9": [0, 3, 7, 10, 14],
  "7M(9)": [0, 4, 7, 11, 14],
  "m7(9)": [0, 2, 3, 7, 10],
  "m7/9": [0, 2, 3, 7, 10],

  // Tensões II-V-I (Dominantes Alterados)
  "7(b9)": [0, 4, 7, 10, 13],
  "7(#9)": [0, 4, 7, 10, 15],
  "7(b13)": [0, 4, 8, 10],
  "7(b9/b13)": [0, 4, 8, 10, 13]
};

// Parser para decompor qualquer acorde da cifra
export function parseAcorde(textoAcorde) {
  if (!textoAcorde || typeof textoAcorde !== 'string') return null;
  const limpo = textoAcorde.replace(/[\[\]]/g, '').trim();

  // Ignora marcações de compasso e barras isoladas
  if (['/', '|', '||', '%'].includes(limpo) || /^\d+x$/.test(limpo)) return null;

  // Separação Baixo Invertido (mão esquerda)
  const partes = limpo.split('/');
  const baseTexto = partes[0].trim();
  const baixoTexto = partes.length > 1 ? partes[1].trim() : null;

  // Extrai Fundamental e Sufixo da Base
  const match = baseTexto.match(/^([A-G][#|b]?)(.*)$/);
  if (!match) return null;

  let fundamental = match[1];
  let sufixo = match[2] ? match[2].trim() : "";

  // Normalização enarmônica
  if (ENARMONIAS[fundamental]) fundamental = ENARMONIAS[fundamental];
  const rootIndex = NOTAS_NOMES.indexOf(fundamental);
  if (rootIndex === -1) return null;

  // Resolução com fallback seguro para tríade se o sufixo não existir
  let intervalos = TABELA_INTERVALOS[sufixo];
  if (!intervalos) {
    intervalos = sufixo.startsWith('m') ? TABELA_INTERVALOS['m'] : TABELA_INTERVALOS[''];
  }

  // Notas absolutas da mão direita
  const notasDireita = intervalos.map(iv => rootIndex + iv);

  // Tratamento do baixo da mão esquerda
  let notaBaixo = null;
  if (baixoTexto) {
    let baixoNorm = ENARMONIAS[baixoTexto] || baixoTexto;
    const baixoIndex = NOTAS_NOMES.indexOf(baixoNorm);
    if (baixoIndex !== -1) notaBaixo = baixoIndex;
  }

  return {
    original: limpo,
    nomeBase: fundamental + sufixo,
    baixo: baixoTexto,
    notasDireita,
    notaBaixo
  };
}

// Renderiza o mini-teclado de 2 oitavas (C até B) com baixo integrado
export function renderMiniTeclado(acordeObj) {
  const container = document.createElement('div');
  container.className = 'piano-container mini-diagrama';

  const { notasDireita, notaBaixo } = acordeObj;
  
  // Notas ativas do acorde na região fundamental / mão direita (0 a 23)
  const ativas = new Set(notasDireita.map(n => n % 24));

  // 14 Teclas Brancas
  const whiteKeyNotes = [0, 2, 4, 5, 7, 9, 11, 12, 14, 16, 17, 19, 21, 23];
  whiteKeyNotes.forEach(val => {
    const key = document.createElement('div');
    key.className = 'key-w';
    if (ativas.has(val)) {
      key.classList.add('active');
      // Se for a nota do baixo da inversão, ganha destaque azul
      if (notaBaixo !== null && (val % 12 === notaBaixo % 12)) {
        key.classList.add('key-bass');
      }
    }
    container.appendChild(key);
  });

  // 10 Teclas Pretas com posicionamento percentual
  const blackKeyMap = [
    { n: 1, pos: 4.8 }, { n: 3, pos: 12 }, { n: 6, pos: 26.2 }, { n: 8, pos: 33.4 }, { n: 10, pos: 40.5 },
    { n: 13, pos: 54.8 }, { n: 15, pos: 62 }, { n: 18, pos: 76.2 }, { n: 20, pos: 83.4 }, { n: 22, pos: 90.5 }
  ];

  blackKeyMap.forEach(item => {
    const key = document.createElement('div');
    key.className = 'key-b';
    key.style.left = item.pos + '%';
    if (ativas.has(item.n)) {
      key.classList.add('active');
      // Se for a nota do baixo da inversão, ganha destaque azul
      if (notaBaixo !== null && (item.n % 12 === notaBaixo % 12)) {
        key.classList.add('key-bass');
      }
    }
    container.appendChild(key);
  });

  return container;
}