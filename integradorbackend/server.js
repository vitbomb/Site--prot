// server.js - Versão com PERFIS, AUTENTICAÇÃO e PostgreSQL (Neon)

// Carrega as variáveis de ambiente do arquivo .env
require('dotenv').config();

// 1. Importar os pacotes
const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const cors = require('cors');
const { Pool } = require('pg'); // Pacote para PostgreSQL
const multer = require('multer');
const path = require('path');

// 2. Inicializar o Express
const app = express();

// 3. Configurar os Middlewares
app.use(cors());
app.use(express.json());
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// --- Configuração do Multer (sem alterações) ---
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, 'uploads/');
    },
    filename: function (req, file, cb) {
        cb(null, file.fieldname + '-' + Date.now() + path.extname(file.originalname));
    }
});
const upload = multer({ storage: storage });
const cpUpload = upload.fields([{ name: 'profileImage', maxCount: 1 }, { name: 'portfolioImages', maxCount: 8 }]);
// ---------------------------------------------------

// --- Configuração da Conexão com o Banco de Dados PostgreSQL ---
const db = new Pool({
    connectionString: process.env.DATABASE_URL,
});

// Verificação da conexão
db.connect((err) => {
    if (err) {
        console.error('Erro ao conectar ao banco de dados PostgreSQL:', err.stack);
    } else {
        console.log('Conectado ao banco de dados PostgreSQL (Neon) com sucesso!');
    }
});
// -----------------------------------------------------------

// --- Rotas de Autenticação (Adaptadas para pg) ---
app.post('/api/register', async (req, res) => {
    try {
        const { email, password } = req.body;
        const checkUserQuery = "SELECT email FROM users WHERE email = $1";
        const { rows } = await db.query(checkUserQuery, [email]);

        if (rows.length > 0) {
            return res.status(400).json({ message: "Este email já está em uso." });
        }

        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);
        const insertUserQuery = "INSERT INTO users (email, password) VALUES ($1, $2)";
        await db.query(insertUserQuery, [email, hashedPassword]);
        
        res.status(201).json({ message: "Usuário registrado com sucesso!" });
    } catch (error) {
        console.error("Erro no registro:", error);
        res.status(500).json({ message: "Erro no servidor." });
    }
});

app.post('/api/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        const findUserQuery = "SELECT * FROM users WHERE email = $1";
        const { rows } = await db.query(findUserQuery, [email]);

        if (rows.length === 0) {
            return res.status(400).json({ message: "Email ou senha inválidos." });
        }
        
        const user = rows[0];
        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return res.status(400).json({ message: "Email ou senha inválidos." });
        }

        const payload = { userId: user.id, email: user.email };
        const secretKey = process.env.JWT_SECRET;
        const token = jwt.sign(payload, secretKey, { expiresIn: '1h' });
        
        res.json({ token, userId: user.id });
    } catch (error) {
        console.error("Erro no login:", error);
        res.status(500).json({ message: "Erro no servidor." });
    }
});

// --- Middleware de Autenticação JWT (sem alterações) ---
function authenticateToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    if (token == null) return res.sendStatus(401);

    jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
        if (err) return res.sendStatus(403);
        req.user = user;
        next();
    });
}
// ------------------------------------

// --- Rota para CRIAR/ATUALIZAR um Perfil (Totalmente Reestruturada) ---
app.post('/api/profile', authenticateToken, cpUpload, async (req, res) => {
    const connection = await db.connect(); // Pega uma conexão do pool
    try {
        await connection.query('BEGIN'); // Inicia a transação

        const userId = req.user.userId;
        const { fullName, title, location, about, skills, contact_email, phone, instagram_url, website_url } = req.body;
        const profileImage = req.files['profileImage'] ? req.files['profileImage'][0] : null;
        const portfolioImages = req.files['portfolioImages'] || [];
        const profileImageUrl = profileImage ? `/uploads/${profileImage.filename}` : null;

        const profileQuery = `
            INSERT INTO profiles (user_id, full_name, title, location, about, profile_image_url, contact_email, phone, instagram_url, website_url, updated_at)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, CURRENT_TIMESTAMP)
            ON CONFLICT (user_id) DO UPDATE SET
                full_name = EXCLUDED.full_name, title = EXCLUDED.title, location = EXCLUDED.location,
                about = EXCLUDED.about, profile_image_url = COALESCE(EXCLUDED.profile_image_url, profiles.profile_image_url),
                contact_email = EXCLUDED.contact_email, phone = EXCLUDED.phone,
                instagram_url = EXCLUDED.instagram_url, website_url = EXCLUDED.website_url,
                updated_at = CURRENT_TIMESTAMP
            RETURNING id;
        `;
        const profileResult = await connection.query(profileQuery, [userId, fullName, title, location, about, profileImageUrl, contact_email, phone, instagram_url, website_url]);
        const profileId = profileResult.rows[0].id;
        
        // Atualizar Habilidades
        await connection.query("DELETE FROM skills WHERE profile_id = $1", [profileId]);
        const skillsArray = skills ? skills.split(',').map(s => s.trim()).filter(Boolean) : [];
        if (skillsArray.length > 0) {
            for (const skill of skillsArray) {
                await connection.query("INSERT INTO skills (profile_id, skill_name) VALUES ($1, $2)", [profileId, skill]);
            }
        }
        
        // Atualizar Portfólio (apenas se novas imagens forem enviadas)
        if (portfolioImages.length > 0) {
            // Nota: Esta lógica apaga todo o portfólio antigo e adiciona o novo.
            await connection.query("DELETE FROM portfolio_items WHERE profile_id = $1", [profileId]);
            for (const image of portfolioImages) {
                const imageUrl = `/uploads/${image.filename}`;
                await connection.query("INSERT INTO portfolio_items (profile_id, image_url) VALUES ($1, $2)", [profileId, imageUrl]);
            }
        }

        await connection.query('COMMIT'); // Confirma a transação
        res.status(200).json({ message: "Perfil salvo com sucesso!" });

    } catch (error) {
        await connection.query('ROLLBACK'); // Desfaz a transação em caso de erro
        console.error('Erro ao salvar perfil:', error);
        res.status(500).json({ message: "Erro ao salvar perfil." });
    } finally {
        connection.release(); // Libera a conexão de volta para o pool
    }
});


// --- ROTA PARA BUSCAR DADOS DE UM PERFIL (Adaptada para pg) ---
app.get('/api/profile/:userId', async (req, res) => {
    try {
        const { userId } = req.params;

        const getProfileQuery = `
            SELECT p.*, string_agg(s.skill_name, ',') as skills
            FROM profiles p
            LEFT JOIN skills s ON p.id = s.profile_id
            WHERE p.user_id = $1
            GROUP BY p.id;
        `;
        const profileResult = await db.query(getProfileQuery, [userId]);

        if (profileResult.rows.length === 0) {
            return res.status(404).json({ message: "Perfil não encontrado." });
        }
        const profile = profileResult.rows[0];
        
        const getPortfolioQuery = "SELECT * FROM portfolio_items WHERE profile_id = $1;";
        const portfolioResult = await db.query(getPortfolioQuery, [profile.id]);
        
        profile.portfolio = portfolioResult.rows;
        res.json(profile);
    } catch (error) {
        console.error("Erro ao buscar perfil:", error);
        res.status(500).json({ message: "Erro no servidor ao buscar perfil." });
    }
});


// 4. Iniciar o Servidor
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Servidor back-end rodando em http://localhost:${PORT}`);
});