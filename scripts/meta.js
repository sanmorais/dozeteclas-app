// scripts/meta.js - Gerador Automático de Meta Tags
(() => {
  function injetarMetadados() {
    const tituloAtual = document.title;
    
    // 1. Só continua se o título já contiver a assinatura e o hífen separador
    if (!tituloAtual || !tituloAtual.includes('| Doze Teclas')) {
      return false; 
    }

    const urlParams = new URLSearchParams(window.location.search);
    const slug = urlParams.get('s');
    const artistaSlug = urlParams.get('a');
    const playlistTag = urlParams.get('t');

    let titulo = "";
    let artista = "";
    let descricao = "";
    let tipoOg = "website";
    let urlFinal = window.location.href;

    // Isola o trecho antes do " | Doze Teclas"
    const miolo = tituloAtual.split('|')[0].trim();

    if (slug) {
      tipoOg = "music.song";
      
      // Procura pelo último separador com espaços " - "
      // Isso protege músicas como "Pai-Nosso", "Em-humildade", etc.
      const sepIdx = miolo.lastIndexOf(' - ');
      
      if (sepIdx !== -1) {
        titulo = miolo.substring(0, sepIdx).trim();
        artista = miolo.substring(sepIdx + 3).trim();
      } else {
        // Fallback caso não tenha espaço em volta do hífen
        const partes = miolo.split('-');
        if (partes.length >= 2) {
          artista = partes.pop().trim();
          titulo = partes.join('-').trim();
        } else {
          titulo = miolo;
          artista = "Doze Teclas";
        }
      }

      // Se ainda estiver com o texto genérico da casca, aguarda a mutação real
      if (titulo.toLowerCase().includes('carregando') || titulo === 'Doze Teclas') {
        return false;
      }
      
      descricao = `Cifra para teclado da música ${titulo} de ${artista}. Arranjo com acordes simplificados no padrão Doze Teclas.`;
      urlFinal = `${window.location.origin}${window.location.pathname}?s=${slug}`;

    } else if (artistaSlug) {
      tipoOg = "profile";
      const sepIdx = miolo.indexOf(' - ');
      artista = sepIdx !== -1 ? miolo.substring(0, sepIdx).trim() : miolo;

      descricao = `Confira o acervo de cifras para teclado de ${artista}. Todas as músicas revisadas, simplificadas e com troca de tom no Doze Teclas.`;
      urlFinal = `${window.location.origin}${window.location.pathname}?a=${artistaSlug}`;

    } else if (playlistTag) {
      tipoOg = "music.playlist";
      const nomePlaylist = miolo.replace(/Playlist/i, '').trim();
      descricao = `Seleção especial de cifras revisadas e preparadas para o momento de ${nomePlaylist}. Confira o repertório completo.`;
      urlFinal = `${window.location.origin}${window.location.pathname}?t=${playlistTag}`;

    } else {
      urlFinal = `${window.location.origin}${window.location.pathname}`.replace(/\/index\.html$/, '/');
    }

    const imagemPadrao = `${window.location.origin}/assets/logo-dozeteclas-card.jpg`;

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

    // Atualização das Tags
    if (descricao) setMeta('meta[name="description"]', 'name', 'description', descricao);
    setLink('canonical', urlFinal);

    setMeta('meta[property="og:type"]', 'property', 'og:type', tipoOg);
    setMeta('meta[property="og:title"]', 'property', 'og:title', tituloAtual);
    if (descricao) setMeta('meta[property="og:description"]', 'property', 'og:description', descricao);
    setMeta('meta[property="og:url"]', 'property', 'og:url', urlFinal);
    setMeta('meta[property="og:image"]', 'property', 'og:image', imagemPadrao);

    setMeta('meta[name="twitter:title"]', 'name', 'twitter:title', tituloAtual);
    if (descricao) setMeta('meta[name="twitter:description"]', 'name', 'twitter:description', descricao);
    setMeta('meta[name="twitter:image"]', 'name', 'twitter:image', imagemPadrao);

    // Schema JSON-LD
    if (slug && titulo && artista && titulo !== 'Doze Teclas') {
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
        'name': titulo,
        'composer': { '@type': 'MusicGroup', 'name': artista },
        'description': descricao,
        'url': urlFinal,
        'inLanguage': 'pt-BR'
      });
    }

    return true;
  }

  // Tenta rodar de imediato
  if (injetarMetadados()) return;

  // Se não estiver pronto, observa as alterações da tag <title>
  const titleNode = document.querySelector('title');
  if (titleNode) {
    const observer = new MutationObserver(() => {
      if (injetarMetadados()) {
        observer.disconnect();
      }
    });

    observer.observe(titleNode, { childList: true, characterData: true, subtree: true });
  }
})();