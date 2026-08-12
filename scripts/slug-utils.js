// slug-utils.js - Utilitário Compartilhado de Slugificação (Doze Teclas)
// Usado por catalogo.js e artista.js para garantir que a MESMA convenção de
// geração de slug seja aplicada em toda a plataforma, evitando URLs quebradas
// ou inconsistentes entre as páginas.

/**
 * Converte um texto livre (ex: nome de artista com acentos/maiúsculas) em um
 * slug limpo e seguro para uso em URLs (ex: "Adoração e Vida" -> "adoracao-e-vida").
 * @param {string} text
 * @returns {string}
 */
export function slugify(text) {
    if (!text) return '';
    return text
        .toString()
        .toLowerCase()
        .normalize('NFD') // Normaliza acentos
        .replace(/[\u0300-\u036f]/g, '') // Remove marcas de acentuação
        .replace(/[^\w\s-]/g, '') // Remove caracteres especiais
        .trim()
        .replace(/\s+/g, '-') // Substitui espaços por hífens
        .replace(/-+/g, '-'); // Evita múltiplos hífens seguidos
}
