let chatHistory = [];

const chatMessages = document.getElementById('chat-messages');
const chatForm = document.getElementById('chat-form');
const userInput = document.getElementById('user-input');
const submitBtn = chatForm.querySelector('button');

function addMessage(text, sender) {
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${sender}`;

    const bubbleDiv = document.createElement('div');
    bubbleDiv.className = 'bubble';
    bubbleDiv.textContent = text;

    messageDiv.appendChild(bubbleDiv);
    chatMessages.appendChild(messageDiv);

    chatMessages.scrollTop = chatMessages.scrollHeight;
}

chatForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    const text = userInput.value.trim();
    if (!text) return;

    // Add user message to UI
    addMessage(text, 'user');
    userInput.value = '';

    // Disable inputs while waiting
    userInput.disabled = true;
    submitBtn.disabled = true;

    try {
        const response = await fetch('http://127.0.0.1:5000/chat', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                query: text,
                history: chatHistory
            })
        });

        if (!response.ok) {
            throw new Error('Network response was not ok');
        }

        const data = await response.json();

        // Add bot message
        addMessage(data.response, 'bot');

        // Update history
        chatHistory = data.history;

    } catch (error) {
        console.error('Error fetching response:', error);
        addMessage('Lo siento, hubo un error al conectar con el servidor.', 'bot');
    } finally {
        // Re-enable inputs
        userInput.disabled = false;
        submitBtn.disabled = false;
        userInput.focus();
    }
});
