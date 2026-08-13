// theme-toggle.js - Alternador de Tema Claro/Escuro Compartilhado
// Usado nas páginas de filtro do acervo (artista.html, album.html,
// vozesnoaltar.html, playlist.html, catalogo.html) para manter a
// preferência de tema sincronizada com o localStorage em todo o site.

function aplicarTemaGlobal(tema) {
    const icone = document.getElementById('theme-toggle-icon');

    if (tema === 'light') {
        document.body.classList.add('light-theme');
        if (icone) {
            icone.classList.remove('bi-toggle-off');
            icone.classList.add('bi-toggle-on');
        }
    } else {
        document.body.classList.remove('light-theme');
        if (icone) {
            icone.classList.remove('bi-toggle-on');
            icone.classList.add('bi-toggle-off');
        }
    }
}
window.aplicarTemaGlobal = aplicarTemaGlobal;

document.addEventListener('DOMContentLoaded', () => {
    // 💾 Recupera a preferência salva (padrão: tema escuro do Doze Teclas)
    const temaSalvo = localStorage.getItem('theme') || 'dark';
    aplicarTemaGlobal(temaSalvo);

    // 🖱️ Alterna o tema ao clicar no botão e persiste a escolha no localStorage,
    // garantindo que a preferência do usuário se mantenha em todas as páginas.
    document.getElementById('btn-theme-toggle')?.addEventListener('click', () => {
        const modoClaroAtivo = document.body.classList.contains('light-theme');
        const novoTema = modoClaroAtivo ? 'dark' : 'light';
        aplicarTemaGlobal(novoTema);
        localStorage.setItem('theme', novoTema);
    });
});
