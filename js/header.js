document.addEventListener('DOMContentLoaded', () => {
    // --- SEU CÓDIGO EXISTENTE PARA LOGIN/PERFIL/MENU (COMEÇA AQUI) ---

    console.log("HEADER.JS: Script carregado. Verificando estado do login...");
    const token = localStorage.getItem('authToken');
    const userId = localStorage.getItem('userId');
    const authLinks = document.getElementById('auth-links');
    const profileContainer = document.getElementById('profile-container');

    if (!authLinks || !profileContainer) {
        console.error("HEADER.JS: ERRO CRÍTICO! Um dos containers #auth-links ou #profile-container não foi encontrado no HTML.");
        // Não use return aqui, pois queremos que a lógica de busca ainda funcione.
        // O erro é crítico para o header, mas não para o resto do script.
    } else {
        if (token && userId) {
            console.log("HEADER.JS: Condição de LOGADO atendida. Atualizando header...");
            authLinks.style.display = 'none';
            profileContainer.style.display = 'block';

            const profileImgElement = document.getElementById('imgperfil');
            if (profileImgElement) {
                const profileImageUrl = localStorage.getItem('profileImageUrl');
                if (profileImageUrl && profileImageUrl !== 'null') {
                    profileImgElement.src = `http://localhost:3000${profileImageUrl}`;
                    console.log("HEADER.JS: Imagem de perfil atualizada para ->", profileImgElement.src);
                } else {
                    profileImgElement.src = '/images/perfil.jpeg'; // Imagem padrão
                    console.log("HEADER.JS: Nenhuma imagem de perfil encontrada no localStorage. Usando imagem padrão.");
                }
            } else {
                console.error("HEADER.JS: ERRO! Elemento #imgperfil não encontrado no HTML.");
            }

            const viewProfileLink = document.getElementById('view-profile-link');
            const editProfileLink = document.getElementById('edit-profile-link');
            const logoutLink = document.getElementById('logout-link');

            if (viewProfileLink) viewProfileLink.href = `testeperfil.html?id=${userId}`;
            if (editProfileLink) editProfileLink.href = 'criarperfil.html';

            if (logoutLink) {
                logoutLink.addEventListener('click', (e) => {
                    e.preventDefault();
                    localStorage.clear();
                    alert('Você foi desconectado.');
                    window.location.href = 'index.html';
                });
            } else {
                console.error("HEADER.JS: ERRO! Link de logout não encontrado.");
            }
            console.log("HEADER.JS: Script de usuário logado finalizado com sucesso.");
        } else {
            console.log("HEADER.JS: Condição de NÃO LOGADO atendida.");
            if (authLinks) authLinks.style.display = 'flex';
            if (profileContainer) profileContainer.style.display = 'none';
        }
    }


    // --- FIM DO SEU CÓDIGO EXISTENTE PARA LOGIN/PERFIL/MENU (TERMINA AQUI) ---


    // --- INÍCIO DA LÓGICA DA BARRA DE PESQUISA (MOVE ESTE BLOCO PARA CÁ) ---

    // Lógica para a barra de pesquisa
    const searchInput = document.getElementById('search-input');
    const searchButton = document.getElementById('search-button');

    if (searchButton && searchInput) {
        // Adiciona um listener para o clique no botão
        searchButton.addEventListener('click', performSearch);
        // Adiciona um listener para a tecla 'Enter' no campo de busca
        searchInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                performSearch();
            }
        });
    }

    // Função que executa a busca e redireciona para a página de resultados
    function performSearch() {
        const query = searchInput.value.trim(); // Pega o valor do input e remove espaços extras
        if (query) {
            // Redireciona para a página de resultados, passando o termo de busca na URL
            window.location.href = `search-results.html?query=${encodeURIComponent(query)}`;
        } else {
            alert('Por favor, digite algo para buscar.'); // Alerta se o campo estiver vazio
        }
    }

    // --- FIM DA LÓGICA DA BARRA DE PESQUISA ---

}); // <-- ESTE É O FECHAMENTO DO ÚNICO DOMContentLoaded LISTENER