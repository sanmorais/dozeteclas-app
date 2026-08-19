// scripts/meta.js - Gerador Automático de Meta Tags
(() => {
  function injetarMetadados() {
    const tituloAtual = document.title;
    
    // Verifica se o título já foi carregado no padrão "Música - Artista | Doze Teclas"
    if (!tituloAtual || !tituloAtual.includes('-') || !tituloAtual.includes('|')) {
      return false; 
    }

    // Extrai os dados limpando os espaços
    const partes = tituloAtual.split('|')[0].split('-');
    const titulo = partes[0]?.trim();
    const artista = partes[1]?.trim();

    if (!titulo || !artista) return false;

    const urlParams = new URLSearchParams(window.location.search);
    const slug = urlParams.get('s') || '';
    const urlFinal = slug ? `${window.location.origin}${window.location.pathname}?s=${slug}` : window.location.href;
    
    const descricao = `Cifra para teclado da música ${titulo} de ${artista}. Arranjo com acordes simplificados no padrão Doze Teclas.`;
    const imagemPadrao = `${window.location.origin}/assets/logo-dozeteclas-card.jpg`;

    // Função interna para criar/atualizar as tags no <head>
    function setMeta(seletor, attr, attrVal, conteudo) {
      let el = document.querySelector(seletor);
      if (!el) {
        el = document.createElement('meta');
        el.setAttribute(attr, attrVal);
        document.head.appendChild(el);
      }
      el.setAttribute('content', conteudo);
    }

    // 1. Meta Tags (SEO e Google)
    setMeta('meta[name="description"]', 'name', 'description', descricao);

    // 2. Open Graph (WhatsApp, Facebook)
    setMeta('meta[property="og:title"]', 'property', 'og:title', tituloAtual);
    setMeta('meta[property="og:description"]', 'property', 'og:description', descricao);
    setMeta('meta[property="og:url"]', 'property', 'og:url', urlFinal);
    setMeta('meta[property="og:image"]', 'property', 'og:image', imagemPadrao);

    // 3. Twitter Card
    setMeta('meta[name="twitter:title"]', 'name', 'twitter:title', tituloAtual);
    setMeta('meta[name="twitter:description"]', 'name', 'twitter:description', descricao);
    setMeta('meta[name="twitter:image"]', 'name', 'twitter:image', imagemPadrao);

    // 4. Schema JSON-LD Estruturado
    let scriptTag = document.querySelector('script[data-schema="music"]');
    if (!scriptTag) {
      scriptTag = document.createElement('script');
      scriptTag.type = 'application/ld+json';
      scriptTag.setAttribute('data-schema', 'music');
      document.head.appendChild(scriptTag);
    }
    
    scriptTag.textContent = JSON.stringify({
      '@context': 'https://schema.org',
      '@type': 'MusicComposition',
      name: titulo,
      composer: { '@type': 'Person', name: artista },
      inLanguage: 'pt-BR'
    });

    return true; // Retorna sucesso
  }

  // 1. Tenta rodar imediatamente (caso o título já esteja lá)
  if (injetarMetadados()) return;

  // 2. Se a cifra demora a carregar e o título ainda não está pronto, aguarda.
  const titleNode = document.querySelector('title');
  if (titleNode) {
    const observer = new MutationObserver(() => {
      // Quando o título mudar, tenta injetar novamente
      if (injetarMetadados()) {
        observer.disconnect(); // SUCESSO: Desliga o observador na mesma hora (zero risco de loop)
      }
    });

    // Fica vigiando apenas o texto dentro da tag <title>
    observer.observe(titleNode, { childList: true, characterData: true, subtree: true });
  }
})();