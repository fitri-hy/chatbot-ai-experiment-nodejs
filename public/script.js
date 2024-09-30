document.getElementById('send-button').addEventListener('click', async () => {
    const userInput = document.getElementById('user-input').value.trim();

    if (!userInput) {
        alert('Please enter a question!');
        return;
    }

    const sanitizedInput = sanitizeInput(userInput);
    displayMessage(sanitizedInput, 'user');
    document.getElementById('user-input').value = '';

    const typingMessageId = 'typing-message';
    displayTypingIndicator(typingMessageId);

    try {
        const response = await fetch('http://localhost:3000/api/chat', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ input: sanitizedInput })
        });

        if (!response.ok) {
            throw new Error('Network response was not ok: ' + response.statusText);
        }

        const data = await response.json();

        removeTypingIndicator(typingMessageId);

        const htmlResponse = marked.parse(data.response);
        displayMessage(htmlResponse, 'bot');

        // Handle localStorage if the response was not saved to the database
        if (!data.savedToDb) {
            localStorage.setItem('lastResponse', data.response);
            console.log("Response stored in localStorage:", data.response);
        } else {
            console.log("Response saved to database:", data.response);
        }
    } catch (error) {
        console.error('Error:', error);
        removeTypingIndicator(typingMessageId);
        displayMessage('Sorry, I encountered an error.', 'bot');
    }
});

function sanitizeInput(input) {
    const tempElement = document.createElement('div');
    tempElement.textContent = input;
    return tempElement.innerHTML;
}

function displayMessage(message, sender) {
    const conversationDiv = document.getElementById('conversation');

    const messageHTML = `
        <div class="${sender === 'user' ? 'text-right' : 'text-left'} mb-2">
            <article class="${sender === 'user' ? 'bg-blue-500 text-white' : 'bg-gray-300 text-black'} prose rounded-lg p-2 inline-block">
                ${message}
            </article>
        </div>
    `;
    conversationDiv.insertAdjacentHTML('beforeend', messageHTML);
    conversationDiv.scrollTop = conversationDiv.scrollHeight;
}

function displayTypingIndicator(typingMessageId) {
    const conversationDiv = document.getElementById('conversation');
    const typingHTML = `
        <div id="${typingMessageId}" class="typing-indicator">
            <div class="dot"></div>
            <div class="dot"></div>
            <div class="dot"></div>
        </div>
    `;
    conversationDiv.insertAdjacentHTML('beforeend', typingHTML);
    conversationDiv.scrollTop = conversationDiv.scrollHeight;
}

function removeTypingIndicator(typingMessageId) {
    const typingMessageElement = document.getElementById(typingMessageId);
    if (typingMessageElement) {
        typingMessageElement.remove();
    }
}
