// artista.js - Controle Dinâmico do Catálogo por Artista

import { slugify } from './slug-utils.js';

// 🛡️ SANITIZAÇÃO ANTI-XSS: Escapa texto vindo do Supabase (título, autor) antes de
// injetar via innerHTML, impedindo execução de <script>/tags maliciosas salvas no banco.
function escapeHtml(str) {
    if (str === null || str === undefined) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

// 🎯 FUNÇÃO CENTRAL DE EXECUÇÃO
async function carregarCatalogoArtista() {
    const urlParams = new URLSearchParams(window.location.search);
    const slugArtista = urlParams.get('a');

    const tituloEl = document.getElementById('nome-artista-titulo');
    const container = document.getElementById('lista-musicas-container');

    if (!slugArtista) {
        console.error("Nenhum artista especificado na URL.");
        if (tituloEl) tituloEl.innerText = "Artista não encontrado";
        if (container) container.innerHTML = `<p class="error-msg">Por favor, selecione um artista válido na página inicial.</p>`;
        return;
    }

    try {
        // 🎯 CAPTURA INTELIGENTE DE ESCOPO: Tenta buscar de qualquer escopo global disponível
        const instanciaSupabase = window._supabase || (typeof _supabase !== 'undefined' ? _supabase : null);

        if (!instanciaSupabase) {
            throw new Error("A instância do Supabase não foi encontrada no escopo.");
        }

        // 1️⃣ RESOLUÇÃO DO SLUG: busca todos os nomes de autor cadastrados e encontra
        // qual deles, ao ser slugificado, corresponde exatamente ao slug recebido na URL.
        // Isso permite URLs limpas (?a=adoracao-e-vida) sem depender de colunas extras
        // no banco, mantendo a integridade mesmo com acentos/maiúsculas variados.
        const { data: linhasAutores, error: errAutores } = await instanciaSupabase
            .from('musicas')
            .select('autor')
            .not('autor', 'is', null);

        if (errAutores) throw errAutores;

        const mapaAutores = new Map();
        (linhasAutores || []).forEach(linha => {
            const nome = (linha.autor || '').trim();
            if (!nome) return;
            const chave = nome.toLowerCase();
            if (!mapaAutores.has(chave)) {
                mapaAutores.set(chave, nome);
            }
        });

        const nomeReal = Array.from(mapaAutores.values()).find(nome => slugify(nome) === slugArtista);

        if (!nomeReal) {
            console.error(`Nenhum artista encontrado para o slug: ${slugArtista}`);
            if (tituloEl) tituloEl.innerText = "Artista não encontrado";
            if (container) container.innerHTML = `<p class="error-msg">Não encontramos este artista no acervo.</p>`;
            return;
        }

        // 🎯 Exibe o nome ORIGINAL formatado (com acentos/maiúsculas corretos), nunca a versão com hífens
        if (tituloEl) tituloEl.innerText = nomeReal;
        document.title = `${nomeReal} | Doze Teclas`;

        document.getElementById('og-title')?.setAttribute('content', `Cifras de ${nomeReal} | Doze Teclas`);
        document.getElementById('og-desc')?.setAttribute('content', `Acesse o repertório completo e revisado de ${nomeReal} para teclado.`);

        // 2️⃣ BUSCA EXATA: agora que temos o nome real cadastrado no banco, buscamos
        // as músicas com correspondência EXATA (.eq), sem depender de ilike/wildcards.
        const { data: musicas, error } = await instanciaSupabase
            .from('musicas')
            .select('titulo, autor, slug, tom, compasso')
            .eq('autor', nomeReal)
            .order('titulo', { ascending: true });

        if (error) throw error;
        if (!container) return;

        container.innerHTML = "";

        if (!musicas || musicas.length === 0) {
            container.innerHTML = `
                <div class="no-songs-box">
                    <p>Ainda estamos revisando e preparando as cifras deste artista.</p>
                    <small>Em breve o catálogo completo estará disponível!</small>
                </div>`;
            return;
        }

        const escalaExibicao = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];

        musicas.forEach(musica => {
            let tomVisual = "--";
            let tomRaw = parseInt(musica.tom, 10);
            if (!isNaN(tomRaw)) {
                let idx = (tomRaw - 3 + 12) % 12;
                tomVisual = escalaExibicao[idx];
            }

            const card = document.createElement('div');
            card.className = 'card-musica-item';
            // 🛡️ Título escapado para impedir XSS armazenado vindo do banco
            card.innerHTML = `
                <div class="card-info">
                    <h3 class="card-song-title">${escapeHtml(musica.titulo)}</h3>
                    <p class="card-song-meta">TOM ORIGINAL: <span>${escapeHtml(tomVisual)}</span></p>
                </div>
                <div class="card-action">
                    <span class="btn-acessar-cifra">VER ▶</span>
                </div>
            `;

            card.addEventListener('click', () => {
                // 🛡️ encodeURIComponent evita que o slug quebre a URL ou injete parâmetros extras
                window.location.href = `cifra.html?s=${encodeURIComponent(musica.slug)}`;
            });

            container.appendChild(card);
        });

    } catch (err) {
        console.error("Erro crítico ao carregar catálogo do artista:", err);
        if (container) container.innerHTML = `<p class="error-msg">Erro ao conectar com o acervo. Tente novamente mais tarde.</p>`;
    }
}

// 🎯 MOTOR DE CHECAGEM: Aguarda qualquer declaração do Supabase ficar pronta antes de disparar
const checarSupabase = setInterval(() => {
    const existeNoEscopo = window._supabase || typeof _supabase !== 'undefined';
    if (existeNoEscopo) {
        clearInterval(checarSupabase);
        carregarCatalogoArtista();
    }
}, 50);
