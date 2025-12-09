require("dotenv").config();
const express = require("express");
const { Pool } = require("pg");
const cors = require("cors");
const bcrypt = require("bcryptjs");

const app = express();
app.use(express.json());
app.use(cors());

// LOG DE TODAS AS REQUISIÇÕES
app.use((req, res, next) => {
  console.log(
    `[${new Date().toISOString()}] Pedido recebido: ${req.method} ${req.url}`
  );
  next();
});

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

// TESTAR CONEXÃO COM O BANCO
pool.connect((err, client, release) => {
  if (err) {
    console.error(
      "❌ ERRO CRÍTICO: Não consegui conectar no Neon Tech!",
      err.message
    );
  } else {
    console.log("✅ SUCESSO: Conectado ao Neon Tech!");
    release();
  }
});

// ROTA DE CADASTRO
app.post("/signup", async (req, res) => {
  const { name, email, password } = req.body;
  console.log("Tentando cadastrar:", email);

  try {
    const userCheck = await pool.query("SELECT * FROM users WHERE email = $1", [
      email,
    ]);
    if (userCheck.rows.length > 0) {
      return res.status(400).json({ error: "E-mail já cadastrado." });
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const newUser = await pool.query(
      "INSERT INTO users (name, email, password) VALUES ($1, $2, $3) RETURNING id, name, email",
      [name, email, hashedPassword]
    );

    console.log("✅ Usuário criado:", email);
    res.json(newUser.rows[0]);
  } catch (err) {
    console.error("❌ Erro no cadastro:", err.message);
    res.status(500).send("Erro no servidor");
  }
});

// ROTA DE LOGIN (Restaurada)
app.post("/login", async (req, res) => {
  const { email, password } = req.body;
  console.log("Tentando logar:", email);

  try {
    const user = await pool.query("SELECT * FROM users WHERE email = $1", [
      email,
    ]);

    if (user.rows.length === 0) {
      return res.status(400).json({ error: "Usuário não encontrado." });
    }

    const validPassword = await bcrypt.compare(password, user.rows[0].password);
    if (!validPassword) {
      return res.status(400).json({ error: "Senha incorreta." });
    }

    console.log("✅ Login realizado:", email);
    res.json({
      id: user.rows[0].id,
      name: user.rows[0].name,
      email: user.rows[0].email,
    });
  } catch (err) {
    console.error("❌ Erro no login:", err.message);
    res.status(500).send("Erro no servidor");
  }
});

// ROTA: ADICIONAR TRANSAÇÃO
app.post("/transactions", async (req, res) => {
  const { user_id, title, value, type } = req.body;

  try {
    const newTransaction = await pool.query(
      "INSERT INTO transactions (user_id, title, value, type) VALUES ($1, $2, $3, $4) RETURNING *",
      [user_id, title, value, type]
    );
    res.json(newTransaction.rows[0]);
  } catch (err) {
    console.error(err.message);
    res.status(500).send("Erro ao salvar transação");
  }
});

// ROTA: PEGAR TRANSAÇÕES DE UM USUÁRIO
app.get("/transactions/:userId", async (req, res) => {
  const { userId } = req.params;

  try {
    const allTransactions = await pool.query(
      "SELECT * FROM transactions WHERE user_id = $1 ORDER BY created_at DESC",
      [userId]
    );
    res.json(allTransactions.rows);
  } catch (err) {
    console.error(err.message);
    res.status(500).send("Erro ao buscar transações");
  }
});

// --- CORREÇÃO IMPORTANTE AQUI EMBAIXO ---
const PORT = process.env.PORT || 3000;
app.listen(PORT, "0.0.0.0", () => {
  console.log(`📡 Servidor rodando na porta ${PORT}`);
});
