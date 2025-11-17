document.addEventListener('DOMContentLoaded', () => {
    console.log("HEADER.JS: Script carregado. Verificando estado do login...");
    const token = localStorage.getItem('authToken');
    const userId = localStorage.getItem('userId');
    console.log("HEADER.JS: Token encontrado ->", token ? "Sim" : "Não");
    console.log("HEADER.JS: UserID encontrado ->", userId);
    const authLinks = document.getElementById('auth-links');
    const profileContainer = document.getElementById('profile-container');
    if (!authLinks || !profileContainer) {
        console.error("HEADER.JS: ERRO CRÍTICO! Um dos containers #auth-links ou #profile-container não foi encontrado no HTML.");
        return;
    }

    if (token && userId) {
        console.log("HEADER.JS: Condição de LOGADO atendida. Atualizando header...");
        authLinks.style.display = 'none';
        profileContainer.style.display = 'block';
        console.log("HEADER.JS: Links de autenticação escondidos, container de perfil exibido.");
        const profileImageUrl = localStorage.getItem('profileImageUrl');
        const profileImgElement = document.getElementById('imgperfil');
        if (profileImgElement) {
            if (profileImageUrl && profileImageUrl !== 'null') {
                profileImgElement.src = `http://localhost:3000${profileImageUrl}`;
                console.log("HEADER.JS: Imagem de perfil atualizada para ->", profileImgElement.src);
            } else {
                profileImgElement.src = '/images/perfil.jpeg'; 
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
        authLinks.style.display = 'flex';
        profileContainer.style.display = 'none';
    }
});