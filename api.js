require('dotenv').config();
const express = require('express');
const { startSearchUsers } = require('./services');
const { PrismaClient } = require("@prisma/client");

const app = express();
const PORT = process.env.PORT || 3000;
const prisma = new PrismaClient();

// SERVIÇO DE AUDITORIA DE AUTENTICAÇÃO NEPPO
app.get('/auditoria-autenticacao-neppo', (req, res) => {
    const resposta = startSearchUsers();
    res.status(201).json(resposta);
});

// Obter todos os itens (GET)
app.get("/itens", async (req, res) => {
    try {
        const itens = await prisma.auditoria_autenticacao_agentes.findMany();
        res.json(itens);
    } catch (err) {
        res.status(500).json({ erro: "Erro ao buscar itens" });
    }
});

// // Criar um novo item (POST)
// app.post("/itens", async (req, res) => {
//     try {
//         const novoItem = await prisma.item.create({
//             data: { nome: req.body.nome }
//         });
//         res.status(201).json(novoItem);
//     } catch (err) {
//         res.status(500).json({ erro: "Erro ao criar item" });
//     }
// });

// // Atualizar um item (PUT)
// app.put("/itens/:id", async (req, res) => {
//     try {
//         const item = await prisma.item.update({
//             where: { id: parseInt(req.params.id) },
//             data: { nome: req.body.nome }
//         });
//         res.json(item);
//     } catch (err) {
//         res.status(404).json({ erro: "Item não encontrado" });
//     }
// });

// // Deletar um item (DELETE)
// app.delete("/itens/:id", async (req, res) => {
//     try {
//         await prisma.item.delete({
//             where: { id: parseInt(req.params.id) }
//         });
//         res.json({ mensagem: "Item deletado com sucesso!" });
//     } catch (err) {
//         res.status(404).json({ erro: "Item não encontrado" });
//     }
// });

app.listen(PORT, () => {
    console.log(`Servidor rodando em http://localhost:${PORT}`);
});