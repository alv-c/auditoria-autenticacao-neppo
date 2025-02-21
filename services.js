// busca token para autenticacao da API NEPPO
const startSearchUsers = () => {
    const myHeadersGetToken = new Headers();
    myHeadersGetToken.append("Authorization", process.env.AUTHORIZATION_AUTH_NEPPO);
    myHeadersGetToken.append("Content-Type", "application/x-www-form-urlencoded");
    const requestOptionsGetToken = {
        method: "POST",
        headers: myHeadersGetToken,
        body: '{}',
        redirect: "follow",
    };
    fetch(`https://api-auth.neppo.com.br/oauth2/token?grant_type=${process.env.GRANT_TYPE}&username=${process.env.USERNAME_AUTH_NEPPO}&password=${process.env.PASSWORD_AUTH_NEPPO}`, requestOptionsGetToken)
        .then((response) => response.text())
        .then((result) => {
            let response = JSON.parse(result);
            let dataRequest = {
                token: `Bearer ${response.access_token}`,
                requisicoes: {
                    1: {
                        indice: 'usuarios_agentes', //referência para mapeamento do objeto de retorno
                        body: JSON.stringify({
                            "conditions": [
                                {
                                    "key": "profile.id",
                                    "value": 2,
                                    "operator": "EQNUM"
                                },
                                {
                                    "key": "profile.id",
                                    "value": 16,
                                    "operator": "EQNUM",
                                    "logic": "OR"
                                },
                                {
                                    "key": "active",
                                    "operator": "IS_TRUE",
                                    "logic": "AND"
                                }
                            ],
                            "size": 1000
                        }),
                        url: 'https://api.neppo.com.br/chatapi/1.0/api/users'
                    },
                    2: {
                        indice: 'usuarios_clientes',
                        body: JSON.stringify({
                            "conditions": [
                                {
                                    "key": "groupConf.id",
                                    "value": 25,
                                    "operator": "EQNUM"
                                },
                                {
                                    "key": "status",
                                    "value": "OPEN",
                                    "operator": "EQ",
                                    "logic": "AND"
                                }
                            ],
                            "size": 500
                        }),
                        url: 'https://api.neppo.com.br/chatapi/1.0/api/user-session'
                    }
                }
            }
            getUsers(dataRequest);
        })
        .catch((error) => console.error(error));
}

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
                body: dataRequest.requisicoes[chave].body,
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

// filtra os dados dos usuarios, mantendo apenas o necessario para a construcao dos grupos -> 
// Nome | Status | Data da ultima autenticacao
const filterData = (data) => {
    let arrayData = Array();
    Object.keys(data)?.forEach((key) => {
        let arrayAux = Array();
        data[key]?.forEach((item) => {
            let itemData;
            if (key === 'usuarios_agentes') { //referência para mapeamento do objeto de retorno
                itemData = [
                    item.displayName,
                    item.agent.status,
                    formatTimeDifference(returnDateBr(item.agent.updatedAt))
                ];
            } else if (key === 'usuarios_clientes') {
                itemData = [
                    item.user.displayName,
                    'CHATBOT_EM_ESPERA',
                    formatTimeDifference(returnDateBr(item.updatedAt))
                ];
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
    let grupos = {
        AGENTES_ONLINE: [],
        AGENTES_OFFLINE: [],
        AGENTES_PAUSE: [],
        CHATBOT_EM_ESPERA: []
    };
    data?.forEach(arrayInterno => {
        arrayInterno.forEach(usuario => {
            const nome = usuario[0];
            const status = usuario[1];
            const data = usuario[2];
            if (status === 'ONLINE') {
                grupos.AGENTES_ONLINE.push([nome, status, data]);
            } else if (status === 'OFFLINE') {
                grupos.AGENTES_OFFLINE.push([nome, status, data]);
            } else if (status.toUpperCase().includes('PAUSE')) {
                grupos.AGENTES_PAUSE.push([nome, status, data]);
            } else if (status === 'CHATBOT_EM_ESPERA') {
                grupos.CHATBOT_EM_ESPERA.push([nome, status, data]);
            }
        });
    });

    // Retorna os grupos
    // return grupos;
    console.log(grupos);
};

module.exports = { startSearchUsers };