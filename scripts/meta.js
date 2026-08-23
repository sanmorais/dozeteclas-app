// scripts/meta.js - Gerador Automático de Meta Tags
(() => {
  function injetarMetadados() {
    const tituloAtual = document.title;
    
    // Verifica se o título já foi carregado (geralmente contém " | Doze Teclas")
    if (!tituloAtual || !tituloAtual.includes('|')) {
      return false; 
    }

    const urlParams = new URLSearchParams(window.location.search);
    const slug = urlParams.get('s');
    const artistaSlug = urlParams.get('a');
    const playlistTag = urlParams.get('t');

    let titulo = "";
    let artista = "";
    let descricao = "";
    let urlFinal = window.location.href;

    if (slug) {
      // Padrão Cifra: "Música - Artista | Doze Teclas"
      const partes = tituloAtual.split('|')[0].split('-');
      titulo = partes[0]?.trim();
      artista = partes[1]?.trim();
      if (!titulo || !artista) return false;
      
      descricao = `Cifra para teclado da música ${titulo} de ${artista}. Arranjo com acordes simplificados no padrão Doze Teclas.`;
      urlFinal = `${window.location.origin}${window.location.pathname}?s=${slug}`;
    } else if (artistaSlug) {
      // Padrão Artista: "Nome do Artista - Cifras e Repertório | Doze Teclas"
      const partes = tituloAtual.split('|')[0].split('-');
      artista = partes[0]?.trim();
      if (!artista) return false;

      descricao = `Confira o acervo de cifras para teclado de ${artista}. Todas as músicas revisadas, simplificadas e com troca de tom no Doze Teclas.`;
      urlFinal = `${window.location.origin}${window.location.pathname}?a=${artistaSlug}`;
    } else if (playlistTag) {
      // Padrão Playlist: "Playlist [Nome] | Doze Teclas"
      const nomePlaylist = tituloAtual.split('|')[0].replace('Playlist', '').trim();
      descricao = `Seleção especial de cifras revisadas e preparadas para o momento de ${nomePlaylist}. Confira o repertório completo.`;
      urlFinal = `${window.location.origin}${window.location.pathname}?t=${playlistTag}`;
    } else {
      // Páginas Estáticas (Home, Catálogo, etc)
      urlFinal = `${window.location.origin}${window.location.pathname}`;
    }

    const imagemPadrao = `${window.location.origin}/assets/logo-dozeteclas-card.jpg`;

    // Função interna para criar/atualizar as tags no <head>
    function setMeta(seletor, attr, attrVal, conteudo) {
      if (!conteudo) return;
      let el = document.querySelector(seletor);
      if (!el) {
        el = document.createElement('meta');
        el.setAttribute(attr, attrVal);
        document.head.appendChild(el);
      }
      el.setAttribute('content', conteudo);
    }

    function setLink(rel, href) {
      let el = document.querySelector(`link[rel="${rel}"]`);
      if (!el) {
        el = document.createElement('link');
        el.rel = rel;
        document.head.appendChild(el);
      }
      el.href = href;
    }

    // 1. Meta Tags (SEO e Google)
    if (descricao) setMeta('meta[name="description"]', 'name', 'description', descricao);
    
    // Canonical (Essencial para Google Search Console)
    setLink('canonical', urlFinal);

    // 2. Open Graph (WhatsApp, Facebook)
    setMeta('meta[property="og:title"]', 'property', 'og:title', tituloAtual);
    if (descricao) setMeta('meta[property="og:description"]', 'property', 'og:description', descricao);
    setMeta('meta[property="og:url"]', 'property', 'og:url', urlFinal);
    setMeta('meta[property="og:image"]', 'property', 'og:image', imagemPadrao);

    // 3. Twitter Card
    setMeta('meta[name="twitter:title"]', 'name', 'twitter:title', tituloAtual);
    if (descricao) setMeta('meta[name="twitter:description"]', 'name', 'twitter:description', descricao);
    setMeta('meta[name="twitter:image"]', 'name', 'twitter:image', imagemPadrao);

    // 4. Schema JSON-LD Estruturado (Apenas para Cifras)
    if (slug && titulo && artista) {
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
        description: descricao,
        url: urlFinal,
        inLanguage: 'pt-BR'
      });
    }

    return true; // Retorna sucesso
  }

  // 1. Tenta rodar imediatamente (caso o título já esteja lá)
  if (injetarMetadados()) return;

  // 2. Se a cifra/artista demora a carregar e o título ainda não está pronto, aguarda.
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