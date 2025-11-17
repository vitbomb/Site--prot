
require('dotenv').config();
const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const cors = require('cors');
const { Pool } = require('pg');
const multer = require('multer');
const path = require('path');
const app = express();
const nodemailer = require('nodemailer');
const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
    }
});
app.use(cors());
app.use(express.json());
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
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
const db = new Pool({
    connectionString: process.env.DATABASE_URL,
});
db.connect((err) => {
    if (err) {
        console.error('Erro ao conectar ao banco de dados PostgreSQL:', err.stack);
    } else {
        console.log('Conectado ao banco de dados PostgreSQL (Neon) com sucesso!');
    }
});
app.post('/api/register', async (req, res) => {
    const connection = await db.connect();
    try {
        await connection.query('BEGIN');

        const { email, password } = req.body;

        const checkUserQuery = "SELECT email FROM users WHERE email = $1";
        const { rows } = await connection.query(checkUserQuery, [email]);

        if (rows.length > 0) {
            await connection.query('ROLLBACK');
            return res.status(400).json({ message: "Este email já está em uso. Por favor, tente outro." });
        }

        const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[\.\$@!%*?&])[A-Za-z\d\.\$@!%*?&]{8,}$/;
        if (!passwordRegex.test(password)) {
            await connection.query('ROLLBACK');
            return res.status(400).json({ message: "A senha não atende aos requisitos de segurança." });
        }
        
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);
        const userQuery = "INSERT INTO users (email, password, is_verified) VALUES ($1, $2, false) RETURNING id";
        const userResult = await connection.query(userQuery, [email, hashedPassword]);
        const userId = userResult.rows[0].id;

        const verificationCode = Math.floor(100000 + Math.random() * 900000).toString();
        const expiresAt = new Date(Date.now() + 10 * 60 * 1000);
        const codeQuery = "INSERT INTO verification_codes (user_id, code, expires_at) VALUES ($1, $2, $3)";
        await connection.query(codeQuery, [userId, verificationCode, expiresAt]);
        await transporter.sendMail({
            from: `"Skill Market" <${process.env.EMAIL_USER}>`,
            to: email,
            subject: "Seu Código de Verificação do Skill Market",
            html: `
                <div style="font-family: sans-serif; text-align: center; color: #333;">
                    <h2 style="color: #4A90E2;">Bem-vindo ao Skill Market!</h2>
                    <p>Use o código abaixo para verificar seu e-mail:</p>
                    <div style="background-color: #f2f2f2; margin: 20px auto; padding: 15px; border-radius: 8px; width: fit-content;">
                        <h1 style="font-size: 48px; letter-spacing: 8px; margin: 0; color: #333;">${verificationCode}</h1>
                    </div>
                    <p style="font-size: 14px; color: #888;">Este código expira em 10 minutos.</p>
                </div>
            `
        });
        await connection.query('COMMIT');
        res.status(201).json({ 
            message: "Usuário registrado com sucesso! Verifique seu e-mail.",
            userId: userId
        });
    } catch (error) {
        await connection.query('ROLLBACK');
        console.error("Erro no registro:", error);
        res.status(500).json({ message: "Erro no servidor." });
    } finally {
        connection.release();
    }
});
app.post('/api/verify', async (req, res) => {
    const connection = await db.connect();
    try {
        await connection.query('BEGIN');
        const { userId, code } = req.body;
        const codeQuery = "SELECT * FROM verification_codes WHERE user_id = $1 AND code = $2";
        const codeResult = await connection.query(codeQuery, [userId, code]);
        if (codeResult.rows.length === 0) {
            return res.status(400).json({ message: "Código inválido ou usuário não encontrado." });
        }
        const verificationData = codeResult.rows[0];
        if (new Date() > new Date(verificationData.expires_at)) {
            return res.status(400).json({ message: "O código de verificação expirou." });
        }
        await connection.query("UPDATE users SET is_verified = true WHERE id = $1", [userId]);
        await connection.query("DELETE FROM verification_codes WHERE user_id = $1", [userId]);
        const userQuery = "SELECT * FROM users WHERE id = $1";
        const userResult = await connection.query(userQuery, [userId]);
        const user = userResult.rows[0];
        const payload = { userId: user.id, email: user.email };
        const token = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '1h' });
        await connection.query('COMMIT');
        res.json({ 
            message: "Email verificado com sucesso!",
            token,
            userId: user.id,
            profileImageUrl: null 
        });
    } catch (error) {
        await connection.query('ROLLBACK');
        console.error("Erro na verificação:", error);
        res.status(500).json({ message: "Erro no servidor durante a verificação." });
    } finally {
        connection.release();
    }
});
const crypto = require('crypto');
app.post('/api/forgot-password', async (req, res) => {
    try {
        const { email } = req.body;
        const { rows } = await db.query("SELECT * FROM users WHERE email = $1", [email]);
        if (rows.length === 0) {
            return res.json({ message: "Se um usuário com este email existir, um link de recuperação será enviado." });
        }
        const user = rows[0];
        const resetToken = crypto.randomBytes(32).toString('hex');
        const expiresAt = new Date(Date.now() + 30 * 60 * 1000);
        await db.query(
            "INSERT INTO password_reset_tokens (user_id, token, expires_at) VALUES ($1, $2, $3)",
            [user.id, resetToken, expiresAt]
        );
        const resetLink = `http://127.0.0.1:5501/reset-password.html?token=${resetToken}`;
        await transporter.sendMail({
            from: `"Skill Market" <${process.env.EMAIL_USER}>`,
            to: email,
            subject: "Recuperação de Senha - Skill Market",
            html: `
                <p>Você solicitou a recuperação de senha. Clique no link abaixo para criar uma nova senha:</p>
                <a href="${resetLink}">${resetLink}</a>
                <p>Este link expira em 30 minutos.</p>
            `
        });
        res.json({ message: "Se um usuário com este email existir, um link de recuperação será enviado." });
    } catch (error) {
        console.error("Erro em forgot-password:", error);
        res.status(500).json({ message: "Erro no servidor." });
    }
});
app.post('/api/reset-password', async (req, res) => {
    try {
        const { token, newPassword } = req.body;
        const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[\.\$@!%*?&])[A-Za-z\d\.\$@!%*?&]{8,}$/;
        if (!passwordRegex.test(newPassword)) {
            return res.status(400).json({ message: "A nova senha não atende aos requisitos de segurança." });
        }
        const { rows } = await db.query("SELECT * FROM password_reset_tokens WHERE token = $1", [token]);
        if (rows.length === 0) {
            return res.status(400).json({ message: "Token inválido." });
        }
        const tokenData = rows[0];
        if (new Date() > new Date(tokenData.expires_at)) {
            return res.status(400).json({ message: "Token expirado." });
        }
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(newPassword, salt);
        await db.query("UPDATE users SET password = $1 WHERE id = $2", [hashedPassword, tokenData.user_id]);
        await db.query("DELETE FROM password_reset_tokens WHERE token = $1", [token]);
        res.json({ message: "Senha alterada com sucesso! Você já pode fazer login." });
    } catch (error) {
        console.error("Erro em reset-password:", error);
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
if (!user.is_verified) {
    return res.status(403).json({ message: "Por favor, verifique seu e-mail antes de fazer login." });
}
        const profileQuery = "SELECT profile_image_url FROM profiles WHERE user_id = $1";
        const profileResult = await db.query(profileQuery, [user.id]);
        let profileImageUrl = null;
        if (profileResult.rows.length > 0) {
            profileImageUrl = profileResult.rows[0].profile_image_url;
        }
        const payload = { userId: user.id, email: user.email };
        const secretKey = process.env.JWT_SECRET;
        const token = jwt.sign(payload, secretKey, { expiresIn: '1h' });
        res.json({ 
            token, 
            userId: user.id,
            profileImageUrl
        });

    } catch (error) {
        console.error("Erro no login:", error);
        res.status(500).json({ message: "Erro no servidor." });
    }
});
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
app.post('/api/profile', authenticateToken, cpUpload, async (req, res) => {
    const connection = await db.connect();
    try {
        await connection.query('BEGIN'); 
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
        await connection.query("DELETE FROM skills WHERE profile_id = $1", [profileId]);
        const skillsArray = skills ? skills.split(',').map(s => s.trim()).filter(Boolean) : [];
        if (skillsArray.length > 0) {
            for (const skill of skillsArray) {
                await connection.query("INSERT INTO skills (profile_id, skill_name) VALUES ($1, $2)", [profileId, skill]);
            }
        }
        if (portfolioImages.length > 0) {
            await connection.query("DELETE FROM portfolio_items WHERE profile_id = $1", [profileId]);
            for (const image of portfolioImages) {
                const imageUrl = `/uploads/${image.filename}`;
                await connection.query("INSERT INTO portfolio_items (profile_id, image_url) VALUES ($1, $2)", [profileId, imageUrl]);
            }
        }
        await connection.query('COMMIT');
        res.status(200).json({ message: "Perfil salvo com sucesso!" });
    } catch (error) {
        await connection.query('ROLLBACK');
        console.error('Erro ao salvar perfil:', error);
        res.status(500).json({ message: "Erro ao salvar perfil." });
    } finally {
        connection.release();
    }
});
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
            console.log(`GET /api/profile/${userId}: Perfil não encontrado, retornando 404.`);
            return res.status(404).json({ message: "Perfil não encontrado." });
        }
        console.log(`GET /api/profile/${userId}: Perfil encontrado, buscando portfólio...`);
        const profile = profileResult.rows[0];
        const getPortfolioQuery = "SELECT * FROM portfolio_items WHERE profile_id = $1;";
        const portfolioResult = await db.query(getPortfolioQuery, [profile.id]);
        profile.portfolio = portfolioResult.rows;
        res.json(profile);
    } catch (error) {
        console.error(`Erro CRÍTICO ao buscar perfil para userId ${req.params.userId}:`, error);
        res.status(500).json({ message: "Erro no servidor ao buscar perfil." });
    }
});
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Servidor back-end rodando em http://localhost:${PORT}`);
});