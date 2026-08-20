// scripts/artistas.js - Destaques com Fallback Seguro e Sem Loops de Erro

const ARTISTAS_DESTAQUES = [
  { nome: 'Anjos de Resgate', alias: ['anjos de resgate'], desc: 'O céu inteiro está rezando por ti' },
  { nome: 'Adriana Arydes', alias: ['adriana arydes'], desc: 'Arranjos e harmonias que tocam o coração' },
  { nome: 'Vida Reluz', alias: ['vida reluz'], desc: 'As harmonias e clássicos mais tocados' },
  { nome: 'Walmir Alencar', alias: ['walmir alencar'], desc: 'Canções e conduções marcantes da carreira solo' },
  { nome: 'Juninho Cassimiro', alias: ['juninho cassimiro'], desc: 'As mais belas composições' },
  { nome: 'Comunidade Católica Shalom', alias: ['shalom', 'comunidade shalom', 'comunidade catolica shalom'], desc: 'Música de quem respira música' },
  { nome: 'Colo de Deus', alias: ['colo de deus'], desc: 'Músicas para rezar como se não houvesse amanhã!' },
  { nome: 'Eliana Ribeiro', alias: ['eliana ribeiro'], desc: 'Músicas que falam ao coração' }
];

// Placeholder SVG embutido em Base64 (carrega instantâneo, offline e nunca dá erro 404)
const SVG_FALLBACK = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 48 48' width='48' height='48'%3E%3Crect width='48' height='48' fill='%232a2a35'/%3E%3Ccircle cx='24' cy='18' r='8' fill='%23555566'/%3E%3Cpath d='M10 40c0-7.7 6.3-14 14-14s14 6.3 14 14z' fill='%23555566'/%3E%3C/svg%3E";

function normalizar(texto) {
  return (texto || '')
    .toString()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
}

function gerarSlug(texto) {
  return normalizar(texto)
    .replace(/[^\w\s-]/g, '')
    .replace(/\s+/g, '-');
}

function getSupabaseClient() {
  if (typeof _supabase !== 'undefined' && typeof _supabase.from === 'function') return _supabase;
  if (typeof supabaseClient !== 'undefined' && typeof supabaseClient.from === 'function') return supabaseClient;
  if (typeof db !== 'undefined' && typeof db.from === 'function') return db;
  if (typeof supabase !== 'undefined' && typeof supabase.from === 'function') return supabase;

  if (typeof supabase !== 'undefined' && typeof supabase.createClient === 'function') {
    if (window.SUPABASE_URL && window.SUPABASE_KEY) {
      return supabase.createClient(window.SUPABASE_URL, window.SUPABASE_KEY);
    }
  }
  return null;
}

async function carregarDestaquesArtistas() {
  const container = document.getElementById('grid-destaques-artistas');
  if (!container) return;

  const client = getSupabaseClient();
  if (!client) {
    console.error('❌ Instância do Supabase não encontrada.');
    return;
  }

  try {
    // Busca todos os artistas cadastrados para cruzar com a lista
    const { data: artistasDb, error } = await client
      .from('artistas')
      .select('nome, foto_url');

    if (error) throw error;

    // Mapa de correspondência flexível (chave normalizada -> URL pública)
    const fotosMap = new Map();
    (artistasDb || []).forEach(item => {
      if (item.nome && item.foto_url) {
        let finalUrl = item.foto_url;
        if (!finalUrl.startsWith('http://') && !finalUrl.startsWith('https://')) {
          const { data } = client.storage.from('artista').getPublicUrl(finalUrl);
          finalUrl = data?.publicUrl;
        }
        fotosMap.set(normalizar(item.nome), finalUrl);
      }
    });

    container.innerHTML = ARTISTAS_DESTAQUES.map(artista => {
      // Tenta achar pelo nome principal ou por qualquer apelido/alias
      let fotoUrl = fotosMap.get(normalizar(artista.nome));
      if (!fotoUrl && artista.alias) {
        for (const apelido of artista.alias) {
          if (fotosMap.has(normalizar(apelido))) {
            fotoUrl = fotosMap.get(normalizar(apelido));
            break;
          }
        }
      }

      fotoUrl = fotoUrl || SVG_FALLBACK;
      const slug = gerarSlug(artista.nome);

      return `
        <a href="artista.html?a=${slug}" class="card-sugestao">
          <div class="cs-info">
            <img 
              src="${fotoUrl}" 
              alt="${artista.nome}" 
              class="cs-avatar"
              loading="lazy"
              onerror="this.onerror=null; this.src='${SVG_FALLBACK}';"
            >
            <div class="cs-textos-bloco">
              <div class="cs-titulo">${artista.nome}</div>
              <div class="cs-desc">${artista.desc}</div>
            </div>
          </div>
          <div class="cs-seta">➔</div>
        </a>
      `;
    }).join('');

    console.log('✅ Destaques carregados e protegidos contra loops.');
  } catch (err) {
    console.error('❌ Erro ao carregar artistas em destaque do Supabase:', err);
  }
}

document.addEventListener('DOMContentLoaded', carregarDestaquesArtistas);