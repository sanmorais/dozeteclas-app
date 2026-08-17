import { parseAcorde, renderMiniTeclado } from './chord-diagram-engine.js';

function inicializarPainelDiagramas() {
  const btnToggle = document.getElementById('btn-toggle-diagramas');
  const btnFechar = document.getElementById('btn-fechar-diagramas');
  const painel = document.getElementById('painel-diagramas-cifra');
  const grade = document.getElementById('grade-diagramas');

  if (!btnToggle || !painel || !grade) {
    console.warn("Elementos do painel de diagramas não encontrados no DOM.");
    return;
  }

  btnToggle.addEventListener('click', () => {
    const estaVisivel = painel.style.display !== 'none';

    if (estaVisivel) {
      painel.style.display = 'none';
      return;
    }

    grade.innerHTML = '';
    const acordesUnicos = new Set();

    // 1. Busca primeiro pelas tags onde as cifras costumam ser envelopadas no DOM
    const elementosAcordes = document.querySelectorAll('.chord, .acorde, [data-chord], .cifra-acorde');
    if (elementosAcordes.length > 0) {
      elementosAcordes.forEach(el => {
        const txt = el.textContent.trim();
        if (txt) acordesUnicos.add(txt);
      });
    }

    // 2. Se não achou por tags, varre o texto buscando notação entre colchetes ou texto puro
    if (acordesUnicos.size === 0) {
      const containerCifra = document.querySelector('.cifra-conteudo, #cifra-conteudo, pre, .song-content') || document.body;
      const texto = containerCifra.innerText || containerCifra.textContent || '';
      
      const regexColchetes = /\[(.*?)\]/g;
      let match;
      while ((match = regexColchetes.exec(texto)) !== null) {
        if (match[1].trim()) acordesUnicos.add(match[1].trim());
      }
    }

    console.log("🎹 Acordes únicos detectados para o diagrama:", Array.from(acordesUnicos));

    if (acordesUnicos.size === 0) {
      grade.innerHTML = '<p style="color:#b0b3b8; font-size:14px;">Nenhum acorde detectado nesta cifra.</p>';
      painel.style.display = 'block';
      return;
    }

    // 3. Renderiza os cards
    acordesUnicos.forEach(acordeTxt => {
      const infoAcorde = parseAcorde(acordeTxt);
      if (!infoAcorde) return;

      const card = document.createElement('div');
      card.className = 'card-acorde-diagrama';

      const nome = document.createElement('span');
      nome.className = 'label-acorde';
      nome.textContent = infoAcorde.original;
      card.appendChild(nome);

      const miniPiano = renderMiniTeclado(infoAcorde);
      card.appendChild(miniPiano);

      grade.appendChild(card);
    });

    painel.style.display = 'block';
    painel.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  });

  if (btnFechar) {
    btnFechar.addEventListener('click', () => {
      painel.style.display = 'none';
    });
  }
}

// Inicialização segura
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', inicializarPainelDiagramas);
} else {
  inicializarPainelDiagramas();
}