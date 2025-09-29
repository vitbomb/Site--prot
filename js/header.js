// js/header.js

document.addEventListener('DOMContentLoaded', () => {
    const signupLink = document.getElementById('signup-link');
    const signinLink = document.getElementById('signin-link');
    const profileContainer = document.getElementById('profile-container');
    const viewProfileLink = document.getElementById('view-profile-link');
    const editProfileLink = document.getElementById('edit-profile-link');
    const logoutLink = document.getElementById('logout-link');

    // Verifica se o usuário está logado
    const token = localStorage.getItem('authToken');
    const userId = localStorage.getItem('userId');

    if (token && userId) {
        // --- USUÁRIO ESTÁ LOGADO ---

        // 1. Esconde os botões de Sign In/Up
        if (signupLink) signupLink.style.display = 'none';
        if (signinLink) signinLink.style.display = 'none';

        // 2. Mostra o ícone do perfil
        if (profileContainer) profileContainer.style.display = 'block';

        // 3. Corrige os links do submenu para serem dinâmicos
        if (viewProfileLink) viewProfileLink.href = `testeperfil.html?id=${userId}`;
        if (editProfileLink) editProfileLink.href = 'criarperfil.html'; // A página de edição já sabe pegar o userId

        // 4. Adiciona a funcionalidade de Logout
        if (logoutLink) {
            logoutLink.addEventListener('click', (event) => {
                event.preventDefault(); // Impede que o link tente navegar
                
                // Limpa os dados de login do navegador
                localStorage.removeItem('authToken');
                localStorage.removeItem('userId');
                
                alert('Você saiu da sua conta.');
                
                // Redireciona para a página inicial
                window.location.href = 'index.html';
            });
        }

    } else {
        // --- USUÁRIO NÃO ESTÁ LOGADO ---

        // Garante que o menu de perfil esteja escondido
        if (profileContainer) profileContainer.style.display = 'none';
    }
});