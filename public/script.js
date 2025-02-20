async function buscarDados() {
    try {
        const response = await fetch('/api');
        const data = await response.json();
        document.getElementById('resultado').innerText = data.mensagem;
    } catch (error) {
        console.error('Erro ao buscar dados:', error);
    }
}