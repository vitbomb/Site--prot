// Dentro de js/header.js

document.addEventListener('DOMContentLoaded', () => {
    const token = localStorage.getItem('authToken');
    const userId = localStorage.getItem('userId');

    const authLinks = document.getElementById('auth-links');
    const profileContainer = document.getElementById('profile-container');

    if (token && userId) {
        // Usuário ESTÁ logado
        authLinks.style.display = 'none'; // Esconde "Sign Up" e "Sign In"
        profileContainer.style.display = 'block'; // Mostra o ícone do perfil

        // Links do submenu do perfil
        const viewProfileLink = document.getElementById('view-profile-link');
        const editProfileLink = document.getElementById('edit-profile-link');
        const logoutLink = document.getElementById('logout-link');

        if (viewProfileLink) {
            viewProfileLink.href = `testeperfil.html?id=${userId}`;
        }
        if (editProfileLink) {
            editProfileLink.href = 'criarperfil.html';
        }
        if (logoutLink) {
            logoutLink.addEventListener('click', (e) => {
                e.preventDefault();
                localStorage.removeItem('authToken');
                localStorage.removeItem('userId');
                alert('Você foi desconectado.');
                window.location.href = 'index.html';
            });
        }

    } else {
        // Usuário NÃO está logado
        authLinks.style.display = 'flex'; // Mostra "Sign Up" e "Sign In"
        profileContainer.style.display = 'none'; // Esconde o ícone do perfil
    }
});