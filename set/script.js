let selectedModel = localStorage.getItem('selectedModel') || 'gemini-1.5-flash';
let selectedSupp = localStorage.getItem('selectedSupp') || 'yes';
let selectedSession = localStorage.getItem('selectedSession') || 'yes';
let systemIntruction = localStorage.getItem('systemInstruction') || '';
const savedModelName = localStorage.getItem('selectedModelName') || 'Gemini 1.5 Flash (Default)';

document.getElementById('selectedModelName').textContent = savedModelName;

let conversationHistory = [];

if (selectedSession === 'yes') {
    conversationHistory = JSON.parse(localStorage.getItem(`conversationHistory_${selectedModel}`)) || [];
}

const resultDiv = document.getElementById('result');
const lastResult = localStorage.getItem(`lastResult_${selectedModel}`);
if (lastResult && conversationHistory.length > 0) {
    resultDiv.innerHTML = lastResult;
} else {
    resultDiv.innerHTML = '';
}

const systemDiv = document.getElementById('systemInstruction');
if (systemIntruction) {
    systemDiv.value = systemIntruction;
} else {
    systemDiv.value = '';
}

if (selectedModel === 'custom-prompt') {
    document.getElementById('systemInstruction').style.display = 'block';
} else {
    document.getElementById('systemInstruction').style.display = 'none';
}

document.querySelectorAll('.model-item').forEach(item => {
    item.addEventListener('click', function() {
        const previousModel = selectedModel;
        selectedModel = this.getAttribute('data-model');
        selectedSupp = this.getAttribute('supp');
        selectedSession = this.getAttribute('session');
        const modelName = this.textContent.trim();
        if (selectedModel === 'custom-prompt') {
            document.getElementById('systemInstruction').style.display = 'block';
        } else {
            document.getElementById('systemInstruction').style.display = 'none';
        }
        document.getElementById('selectedModelName').textContent = modelName;
        const modal = bootstrap.Modal.getInstance(document.getElementById('modelModal'));
        modal.hide();
        localStorage.setItem(`lastResult_${previousModel}`, resultDiv.innerHTML || '');
        const newLastResult = localStorage.getItem(`lastResult_${selectedModel}`) || '';
        resultDiv.innerHTML = newLastResult;
        localStorage.setItem('selectedModel', selectedModel);
        localStorage.setItem('selectedSupp', selectedSupp);
        localStorage.setItem('selectedSession', selectedSession);
        localStorage.setItem('selectedModelName', modelName);
        if (selectedSession === 'yes') {
            conversationHistory = JSON.parse(localStorage.getItem(`conversationHistory_${selectedModel}`)) || [];
        } else {
            conversationHistory = [];
        }
        const fileInput = document.getElementById('file');
        if (selectedSupp === 'no') {
            fileInput.style.display = 'none';
        } else {
            fileInput.style.display = 'block';
        }
    });
});

if (selectedSupp === 'no') {
    document.getElementById('file').style.display = 'none';
} else {
    document.getElementById('file').style.display = 'block';
}

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
    systemInstruction = document.getElementById('systemInstruction').value.trim();
    const fileInput = document.getElementById('file');
    const file = fileInput.files[0];
    document.getElementById('prompt').value = '';
    fileInput.value = '';
    resultDiv.innerHTML = '<p class="text-gray-500">Processing...</p>';
    if (selectedModel !== 'bing-ai') {
        conversationHistory.push({ type: 'user', message: prompt });
        localStorage.setItem(`conversationHistory_${selectedModel}`, JSON.stringify(conversationHistory));
    }
    localStorage.setItem('systemInstruction', systemInstruction);
    const fullHistory = conversationHistory.map(entry => entry.message).join('\n');
    const formData = new FormData();
    formData.append('prompt', fullHistory + '\n' + prompt); 
    formData.append('model', selectedModel);
    formData.append('system', systemInstruction);
    if (file) formData.append('file', file);
    try {
        const response = await fetch('/api/process', {
            method: 'POST',
            body: formData,
        });
        const data = await response.json();
        let historyy = data.result;
        historyy = historyy.replace(/```/g, '');
        historyy = historyy.replace(/\*\*/g, '');
        historyy = historyy.replace(/\`/g, '');
        historyy = historyy.replace(/\*/g, '');
        if (data.result) {
            if (data.result.startsWith('data:image/') || data.result.startsWith('http')) {
                resultDiv.innerHTML = `<img src="${data.result}" class="img-fluid">`;
            } else {
                let formattedText = escapeHtml(data.result);
                formattedText = formattedText.replace(/```(.*?)\n([\s\S]*?)```/g, '<pre class="kodee"><code class="$1">$2</code></pre>');
                formattedText = formattedText.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
                formattedText = formattedText.replace(/\`(.*?)\`/g, '<pre>$1</pre>');
                formattedText = formattedText.replace(/\* (.*?)/g, '- $1');
                formattedText = formattedText.replace(/(\d+\.)/g, '$1');
                formattedText = `<ol>${formattedText}</ol>`;
                resultDiv.innerHTML = formattedText;
            }
            localStorage.setItem(`lastResult_${selectedModel}`, resultDiv.innerHTML);
            if (selectedSession === 'yes') {
                conversationHistory.push({ type: 'ai', message: historyy });
                localStorage.setItem(`conversationHistory_${selectedModel}`, JSON.stringify(conversationHistory));
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

const deleteButton = document.getElementById('deleteButton');
deleteButton.addEventListener('click', () => {
    const confirmDelete = window.confirm("Are you sure you want to delete the chat history? This action cannot be undone.");
    if (confirmDelete) {
        localStorage.removeItem(`conversationHistory_${selectedModel}`);
        localStorage.removeItem(`lastResult_${selectedModel}`);
        localStorage.removeItem(`systemInstruction`);
        conversationHistory = [];
        resultDiv.innerHTML = '';
        systemDiv.value = '';
        alert("Chat history has been deleted.");
    }
});

document.addEventListener('DOMContentLoaded', () => {
    const helpPage = document.getElementById('helpPage');
    const mainContent = document.getElementById('mainContent');
    const helpButton = document.getElementById('helpButton');
    const backButton = document.getElementById('backButton');
    helpButton.addEventListener('click', (e) => {
        e.preventDefault();
        helpPage.classList.add('active');
        history.pushState({ page: 'help' }, '', 'help');
    });
    backButton.addEventListener('click', (e) => {
        e.preventDefault();
        helpPage.classList.remove('active');
        history.back();
    });
    window.addEventListener('popstate', (event) => {
        if (event.state && event.state.page === 'help') {
            helpPage.classList.add('active');
        } else {
            helpPage.classList.remove('active');
        }
    });
});

document.addEventListener('DOMContentLoaded', () => {
    const historyPage = document.getElementById('historyPage');
    const mainContent = document.getElementById('mainContent');
    const historyButton = document.getElementById('historyButton');
    const backButtonn = document.getElementById('backButtonn');
    historyButton.addEventListener('click', (e) => {
        e.preventDefault();
        historyPage.classList.add('active');
        history.pushState({ page: 'history' }, '', 'history');
    });
    backButtonn.addEventListener('click', (e) => {
        e.preventDefault();
        historyPage.classList.remove('active');
        history.back();
    });
    window.addEventListener('popstate', (event) => {
        if (event.state && event.state.page === 'help') {
            historyPage.classList.add('active');
        } else {
            historyPage.classList.remove('active');
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

const keys = Object.keys(localStorage).filter(key => key.startsWith('conversationHistory_'));
const allHistoryContent = document.getElementById('allHistoryContent');

function capitalizeModelName(modelName) {
    return modelName
        .split(' ')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
        .join(' ');
}

if (keys.length) {
    keys.forEach((key) => {
        const model = key.replace('conversationHistory_', '');
        const history = JSON.parse(localStorage.getItem(key));
        
        // Buat bagian untuk setiap model
        const modelSection = document.createElement('div');
        modelSection.className = 'mb-4';
        
        // Membuat elemen judul yang bisa diklik
        const modelTitle = document.createElement('h3');
        modelTitle.className = 'mb-2';
        modelTitle.textContent = capitalizeModelName(model);
        modelTitle.style.cursor = 'pointer';
        
        // Membuat elemen riwayat percakapan yang disembunyikan secara default
        const historyList = document.createElement('ul');
        historyList.className = 'list-group';
        historyList.style.display = 'none'; // Sembunyikan secara default
        
        if (history.length) {
            history.forEach(entry => {
                const messageItem = document.createElement('li');
                messageItem.className = `list-group-item ${entry.type === 'ai' ? 'ai-message' : 'user-message'}`;
                messageItem.innerHTML = `<strong>${entry.type === 'ai' ? 'AI' : 'User'}:</strong> ${escapeHtml(entry.message)}`;
                historyList.appendChild(messageItem);
            });
        } else {
            historyList.innerHTML = '<p class="text-muted">No conversations available for this model.</p>';
        }
        
        // Menambahkan event listener pada judul model untuk toggle riwayat percakapan
        modelTitle.addEventListener('click', () => {
            const isVisible = historyList.style.display === 'block';
            historyList.style.display = isVisible ? 'none' : 'block'; // Toggle visibility
        });
        
        // Menambahkan judul dan riwayat percakapan ke dalam modelSection
        modelSection.appendChild(modelTitle);
        modelSection.appendChild(historyList);
        allHistoryContent.appendChild(modelSection);
    });
} else {
    allHistoryContent.innerHTML = '<p class="text-muted">No conversations available.</p>';
}
