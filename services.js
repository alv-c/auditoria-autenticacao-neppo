const fs = require('fs');
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

// busca token para autenticacao da API NEPPO
const startSearchUsers = async () => {
    try {
        const myHeadersGetToken = new Headers();
        myHeadersGetToken.append("Authorization", process.env.AUTHORIZATION_AUTH_NEPPO);
        myHeadersGetToken.append("Content-Type", "application/x-www-form-urlencoded");
        const requestOptionsGetToken = {
            method: "POST",
            headers: myHeadersGetToken,
            body: '{}',
            redirect: "follow",
        };
        const response = await fetch(`https://api-auth.neppo.com.br/oauth2/token?grant_type=${process.env.GRANT_TYPE}&username=${process.env.USERNAME_AUTH_NEPPO}&password=${process.env.PASSWORD_AUTH_NEPPO}`, requestOptionsGetToken);
        const result = await response.text();
        const responseData = JSON.parse(result);
        const dataRequest = {
            token: `Bearer ${responseData.access_token}`,
            requisicoes: generateRequisicoes()
        };
        await getUsers(dataRequest);
    } catch (error) {
        console.error(error);
    }
}

const generateRequisicoes = () => {
    const requisicoesConfig = JSON.parse(fs.readFileSync('requisicoesConfig.json', 'utf8'));
    return requisicoesConfig;
};

// busca usuarios da API NEPPO utilizando o token de autenticacao retornado de "startSearchUsers"
const getUsers = async (dataRequest) => {
    const myHeaders = new Headers();
    myHeaders.append("Authorization", dataRequest?.token);
    myHeaders.append("Content-Type", "application/json");
    let data = Array();
    const promises = [];
    for (let chave in dataRequest?.requisicoes) {
        if (dataRequest.requisicoes.hasOwnProperty(chave)) {
            const requestOptions = {
                method: "POST",
                headers: myHeaders,
                body: JSON.stringify(dataRequest.requisicoes[chave].body),
                redirect: "follow"
            };
            const promise = fetch(dataRequest.requisicoes[chave].url, requestOptions)
                .then((response) => response.text())
                .then((result) => {
                    data[dataRequest.requisicoes[chave].indice] = JSON.parse(result).results;
                })
                .catch((error) => console.error(error));
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
                    ultimaAutenticacao: formatTimeDifference(returnDateBr(item.agent.updatedAt))
                };
            } else if (key === 'usuarios_recepcao_espera') {
                itemData = {
                    nome: item.user.displayName,
                    status: 'CHATBOT_RECEPCAO_ESPERA',
                    ultimaAutenticacao: formatTimeDifference(returnDateBr(item.updatedAt))
                };
            } else if (key === 'usuarios_gerais_espera') {
                itemData = {
                    nome: item.user.displayName,
                    status: 'CHATBOT_GERAIS_ESPERA',
                    ultimaAutenticacao: formatTimeDifference(returnDateBr(item.updatedAt))
                };
            }
            arrayAux.push(itemData);
        });
        arrayData.push(arrayAux);
    });

    function returnDateBr(data) {
        return new Date(data.toLocaleString("en-US", { timeZone: "America/Sao_Paulo" }));
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
    if (days > 0) {
        if (days == 1) timeDifference += `${days} dia `;
        else timeDifference += `${days} dias `;
    }
    if (hours > 0) {
        if (hours == 1) timeDifference += `${hours} hora `;
        else timeDifference += `${hours} horas `;
    }
    if (minutes > 0 || (days === 0 && hours === 0)) {
        if (minutes == 1) timeDifference += `${minutes} minuto`;
        else timeDifference += `${minutes} minutos`;
    }
    return timeDifference || '0m';
}

// Constroi grupos de usuarios com base nos status de cada usuario
const constructGroups = (data) => {
    const grupos = {
        AGENTES_ONLINE: [],
        AGENTES_OFFLINE: [],
        AGENTES_PAUSE: [],
        CHATBOT_RECEPCAO_ESPERA: [],
        CHATBOT_GERAIS_ESPERA: []
    };

    const statusToGroup = {
        // status | grupo
        'ONLINE': 'AGENTES_ONLINE',
        'OFFLINE': 'AGENTES_OFFLINE',
        'PAUSE': 'AGENTES_PAUSE',
        'CHATBOT_RECEPCAO_ESPERA': 'CHATBOT_RECEPCAO_ESPERA',
        'CHATBOT_GERAIS_ESPERA': 'CHATBOT_GERAIS_ESPERA'
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

module.exports = { startSearchUsers };