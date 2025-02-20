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
        mode: 'no-cors'
    };
    fetch(`https://api-auth.neppo.com.br/oauth2/token?grant_type=${process.env.GRANT_TYPE}&username=${process.env.USERNAME_AUTH_NEPPO}&password=${process.env.PASSWORD_AUTH_NEPPO}`, requestOptionsGetToken)
        .then((response) => response.text())
        .then((result) => {
            let response = JSON.parse(result);
            getUsers(`Bearer ${response.access_token}`);
        })
        .catch((error) => console.error(error));
}

// busca usuarios da API NEPPO utilizando o token de autenticacao retornado de "startSearchUsers"
const getUsers = (token) => {
    const myHeaders = new Headers();
    myHeaders.append("Authorization", token);
    myHeaders.append("Content-Type", "application/json");
    const raw = JSON.stringify({
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
    });

    const requestOptions = {
        method: "POST",
        headers: myHeaders,
        body: raw,
        redirect: "follow"
    };

    fetch("https://api.neppo.com.br/chatapi/1.0/api/users", requestOptions)
        .then((response) => response.text())
        .then((result) => {
            constructGroups(filterData(JSON.parse(result).results));
        })
        .catch((error) => console.error(error));
}

// Controi grupos de usuarios com base nos status de cada usuario
const constructGroups = (data) => {
    let grupos = {
        ONLINE: [],
        OFFLINE: [],
        PAUSE: []
    };
    data?.forEach(usuario => {
        const nome = usuario[0];
        const status = usuario[1];
        const data = usuario[2];

        if (status === 'ONLINE') {
            grupos.ONLINE.push([nome, status, data]);
        } else if (status === 'OFFLINE') {
            grupos.OFFLINE.push([nome, status, data]);
        } else if (status.toUpperCase().includes('PAUSE')) {
            grupos.PAUSE.push([nome, status, data]);
        }
    });

    // Retorna os grupos
    // return grupos;
    console.log(grupos);
};

// filtra os dados dos usuarios, mantendo apenas o necessario para a construcao dos grupos -> 
// Nome | Status | Data da ultima autenticacao
const filterData = (data) => {
    let arrayData = Array();
    data?.forEach((item) => {
        let arrayAux = Array();
        arrayAux.push(
            item.displayName,
            item.agent.status,
            formatTimeDifference(item.agent.updatedAt)
        );
        arrayData.push(arrayAux);
    });
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

module.exports = { startSearchUsers };