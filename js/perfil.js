document.addEventListener('DOMContentLoaded', function () {
    const form = document.getElementById('formPerfil');
    if (!form) return;

    form.addEventListener('submit', async function (e) {
        e.preventDefault();

        // Lê imagem de perfil
        const fotoPerfilInput = document.getElementById('fotoperfil');
        const fotoPerfilBase64 = await toBase64(fotoPerfilInput.files[0]);

        // Lê imagens do portfólio
        const portfolioInput = document.getElementById('portfolioimg');
        const portfolioBase64 = await Promise.all(
            Array.from(portfolioInput.files).map(file => toBase64(file))
        );

        const perfil = {
            nome: document.getElementById('nome').value,
            titulo: document.getElementById('profissao').value,
            localizacao: document.getElementById('localizacao').value,
            sobre: document.getElementById('sobre').value,
            habilidades: document.getElementById('habilidades').value.split(',').map(h => h.trim()),
            portfolioImgs: portfolioBase64,
            email: document.getElementById('email').value,
            telefone: document.getElementById('telefone').value,
            redes: document.getElementById('redes').value.split(',').map(r => r.trim()),
            fotoperfil: fotoPerfilBase64
        };

        localStorage.setItem('perfilUsuario', JSON.stringify(perfil));
        window.location.href = "testeperfil.html";
    });

    // Função para converter arquivos em base64
   function toBase64(file, maxWidth = 400) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => {
            const img = new Image();
            img.src = reader.result;
            img.onload = () => {
                const canvas = document.createElement('canvas');
                const scale = maxWidth / img.width;
                canvas.width = maxWidth;
                canvas.height = img.height * scale;

                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

                const compressed = canvas.toDataURL('image/jpeg', 0.7); // Comprime para JPEG com 70%
                resolve(compressed);
            };
        };
        reader.onerror = error => reject(error);
    });
}

});
