// catalogo.js - Índice Alfabético Completo de Artistas do Acervo Doze Teclas

import { slugify } from './slug-utils.js';

// 🛡️ SANITIZAÇÃO ANTI-XSS: Escapa qualquer texto vindo do Supabase antes de
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


// 🎯 Normaliza a "letra-bucket" (chave de agrupamento), sem acento, para bater
// corretamente com as âncoras estáticas #letra-A, #letra-B, etc.
function letraBucket(nome) {
    const primeiraLetra = String(nome).trim().normalize('NFD').replace(/[\u0300-\u036f]/g, '').charAt(0).toUpperCase();
    return /^[A-Z]$/.test(primeiraLetra) ? primeiraLetra : '#';
}

const ALFABETO = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split('');

// 🎯 FUNÇÃO CENTRAL DE EXECUÇÃO
async function carregarCatalogoArtistas() {
    const container = document.getElementById('catalogo-lista-container');
    const indexBar = document.getElementById('az-index-bar');

    if (!container) return;

    try {
        const instanciaSupabase = window._supabase || (typeof _supabase !== 'undefined' ? _supabase : null);

        if (!instanciaSupabase) {
            throw new Error("A instância do Supabase não foi encontrada no escopo.");
        }

        // 🎯 BUSCA OTIMIZADA: seleciona apenas a coluna 'autor' (nenhum dado extra é transferido)
        //
        // 🐛 CORREÇÃO DE BUG CRÍTICO (Artista desaparecendo do catálogo):
        // O PostgREST (API do Supabase) tem um limite MÁXIMO DE LINHAS RETORNADAS por
        // requisição sem paginação explícita (geralmente 100 ou 1000, dependendo da
        // configuração "Max Rows" do projeto). Sem `.order()`, o banco pode devolver as
        // linhas em QUALQUER ordem física da tabela — e um simples UPDATE (como salvar
        // uma cifra no editor) faz o Postgres criar uma nova versão física da linha
        // (MVCC), o que pode mudar sua posição no resultado "sem ordenação". Se essa
        // linha for empurrada para além do limite padrão, o único registro daquele
        // artista some da consulta, e o artista desaparece do catálogo — mesmo a música
        // continuando 100% intacta no banco (por isso ainda aparece na busca geral).
        //
        // A correção definitiva combina duas medidas:
        //   1. `.order('autor')` → garante uma ordenação determinística e estável,
        //      independente da posição física da linha na tabela.
        //   2. `.limit(2000)` → garante margem confortável acima do total de músicas
        //      do acervo, evitando cortes silenciosos caso o acervo cresça.
        const { data: musicas, error } = await instanciaSupabase
            .from('musicas')
            .select('autor')
            .not('autor', 'is', null)
            .order('autor', { ascending: true })
            .limit(2000);

        if (error) {
            console.error('Erro no catálogo:', error);
            throw error;
        }


        if (!musicas || musicas.length === 0) {
            container.innerHTML = `
                <div class="no-songs-box">
                    <p>Ainda não há artistas cadastrados no acervo.</p>
                    <small>Em breve o catálogo completo estará disponível!</small>
                </div>`;
            return;
        }

        // 🎯 DEDUPLICAÇÃO: usa um Map (chave = nome normalizado) para evitar duplicidade
        // por diferenças de caixa (ex: "Shalom" vs "SHALOM")
        const mapaArtistas = new Map();
        musicas.forEach(m => {
            const nomeOriginal = (m.autor || '').trim();
            if (!nomeOriginal) return;
            const chave = nomeOriginal.toLowerCase();
            if (!mapaArtistas.has(chave)) {
                mapaArtistas.set(chave, nomeOriginal);
            }
        });

        const listaArtistas = Array.from(mapaArtistas.values())
            .sort((a, b) => a.localeCompare(b, 'pt-BR', { sensitivity: 'base' }));

        if (listaArtistas.length === 0) {
            container.innerHTML = `
                <div class="no-songs-box">
                    <p>Ainda não há artistas cadastrados no acervo.</p>
                    <small>Em breve o catálogo completo estará disponível!</small>
                </div>`;
            return;
        }

        // 🎯 AGRUPAMENTO POR LETRA INICIAL (A-Z + '#' para símbolos/números)
        const grupos = {};
        listaArtistas.forEach(nome => {
            const letra = letraBucket(nome);
            if (!grupos[letra]) grupos[letra] = [];
            grupos[letra].push(nome);
        });

        // 🎯 RENDERIZAÇÃO: monta cada seção alfabética com escape total de HTML
        let html = "";
        const letrasComConteudo = new Set();

        [...ALFABETO, '#'].forEach(letra => {
            if (!grupos[letra] || grupos[letra].length === 0) return;
            letrasComConteudo.add(letra);

            html += `<section class="catalogo-letter-section" id="letra-${letra}">`;
            html += `<h2 class="catalogo-letter-heading">${escapeHtml(letra)}</h2>`;
            html += `<div class="catalogo-artist-grid">`;

            grupos[letra].forEach(nome => {
                const slug = slugify(nome);
                html += `<a href="artista.html?a=${encodeURIComponent(slug)}" class="catalogo-artist-link">${escapeHtml(nome)}</a>`;
            });

            html += `</div></section>`;
        });

        container.innerHTML = html;

        // 🎯 Marca no índice A-Z quais letras têm conteúdo real (as demais ficam desabilitadas)
        if (indexBar) {
            indexBar.querySelectorAll('a[data-letra]').forEach(link => {
                const letra = link.getAttribute('data-letra');
                if (!letrasComConteudo.has(letra)) {
                    link.classList.add('disabled');
                    link.removeAttribute('href');
                } else {
                    link.setAttribute('href', `#letra-${letra}`);
                }
            });
        }

    } catch (err) {
        console.error("Erro crítico ao carregar catálogo de artistas:", err);
        container.innerHTML = `<p class="error-msg">Erro ao conectar com o acervo. Tente novamente mais tarde.</p>`;
    }
}

// 🎯 MOTOR DE CHECAGEM: Aguarda qualquer declaração do Supabase ficar pronta antes de disparar
const checarSupabaseCatalogo = setInterval(() => {
    const existeNoEscopo = window._supabase || typeof _supabase !== 'undefined';
    if (existeNoEscopo) {
        clearInterval(checarSupabaseCatalogo);
        carregarCatalogoArtistas();
    }
}, 50);
