let historyy = {
    models: {},
    selectedModel: 'hydroai-neptune-32B-V2.0',
};

function getModelHistory(model) {
    if (!historyy.models[model]) {
        historyy.models[model] = {
            selectedSupp: 'no',
            selectedSession: 'no',
            systemInstruction: '',
            savedModelName: document.querySelector(`[data-model="${model}"]`)?.textContent.trim() || model,
            conversationHistory: [],
            lastResult: '',
        };
    }
    return historyy.models[model];
}

document.getElementById('selectedModelName').textContent = getModelHistory(history.selectedModel).savedModelName;

function switchModel(newModel) {
    const previousModel = historyy.selectedModel;
    historyy.selectedModel = newModel;
    const modelData = getModelHistory(newModel);
    document.getElementById('selectedModelName').textContent = modelData.savedModelName;
    document.getElementById('systemInstruction').style.display = newModel === 'custom-prompt' ? 'block' : 'none';
    document.getElementById('file').style.display = modelData.selectedSupp === 'yes' ? 'block' : 'none';
    document.getElementById('result').innerHTML = modelData.lastResult || '';
    if (modelData.selectedSession === 'yes') {
        modelData.conversationHistory = [];
    }
}

document.querySelectorAll('.model-item').forEach(item => {
    item.addEventListener('click', function () {
        const newModel = this.getAttribute('data-model');
        const modelData = getModelHistory(newModel);
        modelData.selectedSupp = this.getAttribute('supp');
        modelData.selectedSession = this.getAttribute('session');
        switchModel(newModel);
        const modal = bootstrap.Modal.getInstance(document.getElementById('modelModal'));
        modal.hide();
    });
});

function escapeHtml(unsafe) {
    return unsafe
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

document.getElementById('aiForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const prompt = document.getElementById('prompt').value.trim();
    const fileInput = document.getElementById('file');
    const file = fileInput.files[0];
    document.getElementById('prompt').value = '';
    fileInput.value = '';
    const selectedModel = historyy.selectedModel;
    const modelData = getModelHistory(selectedModel);
    modelData.systemInstruction = document.getElementById('systemInstruction').value.trim();
    const resultDiv = document.getElementById('result');
    resultDiv.innerHTML = '<p class="text-gray-500">Processing...</p>';
    if (modelData.selectedSession === 'yes') {
        modelData.conversationHistory.push({ type: 'user', message: prompt });
    }
    const fullHistory = modelData.conversationHistory.map(entry => entry.message).join('\n');
    const formData = new FormData();
    formData.append('prompt', fullHistory + '\n' + prompt);
    formData.append('model', selectedModel);
    formData.append('system', modelData.systemInstruction);
    if (file) formData.append('file', file);
    try {
        const response = await fetch('/api/process', {
            method: 'POST',
            body: formData,
        });
        const data = await response.json();
        let historyyy;
        if (data.result) {
            if (data.result.startsWith('data:image/') || data.result.startsWith('http')) {
                resultDiv.innerHTML = `<img src="${data.result}" class="img-fluid">`;
            } else {
                historyyy = data.result;
                historyyy = historyyy.replace(/```/g, '');
                historyyy = historyyy.replace(/\*\*/g, '');
                historyyy = historyyy.replace(/\`/g, '');
                historyyy = historyyy.replace(/\*/g, '');
                let formattedText = escapeHtml(data.result);
                formattedText = formattedText.replace(/```(.*?)\n([\s\S]*?)```/g, '<pre class="kodee"><code class="$1">$2</code></pre>');
                formattedText = formattedText.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
                formattedText = formattedText.replace(/\`(.*?)\`/g, '<pre>$1</pre>');
                formattedText = formattedText.replace(/\* (.*?)/g, '- $1');
                formattedText = formattedText.replace(/(\d+\.)/g, '$1');
                formattedText = `<ol>${formattedText}</ol>`;
                resultDiv.innerHTML = formattedText;
            }
            modelData.lastResult = resultDiv.innerHTML
            if (modelData.selectedSession === 'yes') {
                modelData.conversationHistory.push({ type: 'ai', message: historyyy });
            }
        } else {
            resultDiv.innerHTML = `<p class="text-danger">Error: ${data.error}</p>`;
        }
    } catch (error) {
        resultDiv.innerHTML = `<p class="text-danger">Error: ${error.message}</p>`;
    }
});

let deferredPrompt;
const installButton = document.getElementById('installButton');
window.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault();
    deferredPrompt = event;
    installButton.style.display = 'inline-block';
    installButton.addEventListener('click', () => {
        deferredPrompt.prompt();
        deferredPrompt.userChoice.then((choiceResult) => {
            if (choiceResult.outcome === 'accepted') {
                console.log('User accepted the A2HS prompt');
            } else {
                console.log('User dismissed the A2HS prompt');
            }
            deferredPrompt = null;
            installButton.style.display = 'none';
        });
    });
});

document.addEventListener('DOMContentLoaded', () => {
    const infoPage = document.getElementById('infoPage');
    const mainContent = document.getElementById('mainContent');
    const infoButton = document.getElementById('infoButton');
    const backButton = document.getElementById('backButton');
    infoButton.addEventListener('click', (e) => {
        e.preventDefault();
        infoPage.classList.add('active');
        history.pushState({ page: 'info' }, '', 'info');
    });
    backButton.addEventListener('click', (e) => {
        e.preventDefault();
        infoPage.classList.remove('active');
        history.back();
    });
    window.addEventListener('popstate', (event) => {
        if (event.state && event.state.page === 'help') {
            infoPage.classList.add('active');
        } else {
            infoPage.classList.remove('active');
        }
    });
});

if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('/service-worker.js')
        .then((registration) => {
            console.log('Service Worker registered with scope:', registration.scope);
        })
        .catch((error) => {
            console.log('Service Worker registration failed:', error);
        });
    });
}

switchModel(historyy.selectedModel);