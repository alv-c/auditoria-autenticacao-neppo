require('dotenv').config();
const express = require('express');
const { startSearchUsers } = require('./services');

const app = express();
const PORT = process.env.PORT || 3000;

// Servir arquivos estáticos (HTML, CSS, JS frontend)
app.use(express.static('public'));

// SERVIÇO DE AUDITORIA DE AUTENTICAÇÃO NEPPO
app.get('/auditoria-autenticacao-neppo', (req, res) => {
    const resposta = startSearchUsers();
    res.json(resposta);
});

app.listen(PORT, () => {
    console.log(`Servidor rodando em http://localhost:${PORT}`);
});