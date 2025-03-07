const fs = require('fs');
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();
const axios = require('axios');
const schedule = require('node-schedule');

// busca token para autenticacao da API NEPPO
const startSearchUsers = async () => {
    try {
        const myHeadersGetToken = {
            "Authorization": process.env.AUTHORIZATION_AUTH_NEPPO,
            "Content-Type": "application/x-www-form-urlencoded"
        };

        const body = new URLSearchParams();
        body.append("grant_type", process.env.GRANT_TYPE);
        body.append("username", process.env.USERNAME_AUTH_NEPPO);
        body.append("password", process.env.PASSWORD_AUTH_NEPPO);

        const response = await axios.post(
            'https://api-auth.neppo.com.br/oauth2/token',
            body,
            { headers: myHeadersGetToken }
        );
        const dataRequest = {
            token: `Bearer ${response.data.access_token}`,
            requisicoes: generateRequisicoes()
        };

        await getUsers(dataRequest);

    } catch (error) {
        console.error('Erro ao realizar a requisição:', error);
    }
};

const generateRequisicoes = () => {
    const requisicoesConfig = JSON.parse(fs.readFileSync('requisicoesConfig.json', 'utf8'));
    return requisicoesConfig;
};

// busca usuarios da API NEPPO utilizando o token de autenticacao retornado de "startSearchUsers"
const getUsers = async (dataRequest) => {
    const headers = {
        "Authorization": dataRequest?.token,
        "Content-Type": "application/json"
    };

    let data = [];
    const promises = [];

    for (let chave in dataRequest?.requisicoes) {
        if (dataRequest.requisicoes.hasOwnProperty(chave)) {
            const body = JSON.stringify(dataRequest.requisicoes[chave].body);
            const promise = axios.post(dataRequest.requisicoes[chave].url, body, { headers })
                .then((response) => {
                    data[dataRequest.requisicoes[chave].indice] = response.data.results;
                })
                .catch((error) => {
                    console.error('Erro ao fazer a requisição:', error);
                });

            promises.push(promise);
        }
    }
    await Promise.all(promises);
    constructGroups(filterData(data));
};

// filtra os dados dos usuarios, mantendo apenas o necessário para a construção dos grupos -> 
// Nome | Status | Data da última autenticação
const filterData = (data) => {
    let arrayData = [];
    Object.keys(data)?.forEach((key) => {
        let arrayAux = [];
        data[key]?.forEach((item) => {
            let itemData;
            if (key === 'agentes_nao_autenticados') { // referência para mapeamento do objeto de retorno
                itemData = {
                    nome: item.displayName,
                    status: item.agent.status,
                    ultimaAutenticacao: formatTimeDifference(returnDateBr(convertUTCtoBRT(item.agent.updatedAt)))
                };
            }
            arrayAux.push(itemData);
        });
        arrayData.push(arrayAux);
    });

    function returnDateBr(data) {
        return new Date(data.toLocaleString("en-US", { timeZone: "America/Sao_Paulo" }));
    };

    function convertUTCtoBRT(utcTime) {
        const utcDate = new Date(utcTime);
        utcDate.setHours(utcDate.getHours() - 3);
        return utcDate.toISOString().replace('Z', '');
    };

    return arrayData;
}

// Calcula a data da ultima autenticacao do usuario com a data atual, retornando o tempo de inatividade do usuario
const formatTimeDifference = (updatedAt) => {
    const updatedDate = new Date(updatedAt);
    const now = new Date();
    const diffMs = now - updatedDate;
    const diffMinutes = Math.floor(diffMs / (1000 * 60));
    const days = Math.floor(diffMinutes / (60 * 24));
    const hours = Math.floor((diffMinutes % (60 * 24)) / 60);
    const minutes = diffMinutes % 60;
    let timeDifference = '';
    if (days > 0) timeDifference += `${days}d `;
    if (hours > 0) timeDifference += `${hours}h `;
    if (minutes > 0 || (days === 0 && hours === 0)) timeDifference += `${minutes}m`;
    return timeDifference || '0m';
}

// Constroi grupos de usuarios com base nos status de cada usuario
const constructGroups = (data) => {
    const grupos = {
        AGENTES_ONLINE: [],
        AGENTES_OFFLINE: [],
        AGENTES_PAUSE: [],
    };

    const statusToGroup = {
        // status | grupo
        'ONLINE': 'AGENTES_ONLINE',
        'OFFLINE': 'AGENTES_OFFLINE',
        'PAUSE': 'AGENTES_PAUSE',
    };

    data?.forEach(arrayInterno => {
        arrayInterno.forEach(usuario => {
            const nome = usuario.nome;
            const status = usuario.status;
            const data = usuario.ultimaAutenticacao;
            const group = statusToGroup[status.toUpperCase().includes('PAUSE') ? 'PAUSE' : status];
            grupos[group]?.push({ nome, status, data });
        });
    });

    insertDatabase(grupos);
};

const insertDatabase = async (data) => {
    const grupoDados = {
        descricao: "Grupo de auditoria de autenticação NEPPO",
        data_json: JSON.stringify(data),
        create_at: new Date(),
    };

    try {
        const novoRegistro = await prisma.auditoria_autenticacao_agentes.upsert({
            where: {
                id: 1,
            },
            update: {
                data_json: JSON.stringify(data),
                update_at: new Date(),
            },
            create: grupoDados,
        });
        console.log("Operação realizada com sucesso:", novoRegistro);
        return data;
    } catch (error) {
        console.error("Erro ao inserir ou atualizar registro:", error);
    }
};

const fazerRequisicao = async () => {
    try {
        // configurar URI de requisicao
        const response = await axios.get('http://localhost:3000/auditoria-autenticacao-neppo');
        console.log('Requisição bem-sucedida:', response.data);
    } catch (error) {
        console.error('Erro ao fazer requisição:', error.message);
    }
};

const agendadorTarefas = () => {
    // Agendar a tarefa para as 08:58 de segunda a sexta-feira
    schedule.scheduleJob('58 8 * * 1-5', () => {
        console.log('Executando requisição às 08:58');
        fazerRequisicao();
    });

    // Agendar a tarefa para as 13:58 de segunda a sexta-feira
    schedule.scheduleJob('58 13 * * 1-5', () => {
        console.log('Executando requisição às 13:58');
        fazerRequisicao();
    });

    // Agendar a tarefa para as 15:58 de segunda a sexta-feira
    schedule.scheduleJob('58 15 * * 1-5', () => {
        console.log('Executando requisição às 15:58');
        fazerRequisicao();
    });
}

agendadorTarefas();

module.exports = { startSearchUsers };