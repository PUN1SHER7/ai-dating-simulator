// app.js - Main application logic

document.addEventListener('DOMContentLoaded', () => {
    // DOM Elements
    const screens = {
        onboarding: document.getElementById('onboarding'),
        profileSelection: document.getElementById('profile-selection'),
        chatInterface: document.getElementById('chat-interface'),
        feedbackScreen: document.getElementById('feedback-screen')
    };
    
    const elements = {
        startBtn: document.getElementById('start-btn'),
        profilesContainer: document.getElementById('profiles-container'),
        backBtn: document.getElementById('back-btn'),
        chatProfilePic: document.getElementById('chat-profile-pic'),
        chatProfileName: document.getElementById('chat-profile-name'),
        chatProfileStatus: document.getElementById('chat-profile-status'),
        chatMessages: document.getElementById('chat-messages'),
        messageText: document.getElementById('message-text'),
        sendBtn: document.getElementById('send-btn'),
        feedbackContent: document.getElementById('feedback-content'),
        continueBtn: document.getElementById('continue-btn'),
        scoreDisplay: document.getElementById('score')
    };
    
    // Set up API key input
    let apiKey = localStorage.getItem('openrouter_api_key');
    if (!apiKey) {
        apiKey = prompt("Please enter your OpenRouter API key:");
        if (apiKey) {
            localStorage.setItem('openrouter_api_key', apiKey);
        }
    }
    chatManager.apiKey = apiKey;
    
    // Navigation Functions
    function showScreen(screenId) {
        // Hide all screens
        Object.values(screens).forEach(screen => {
            screen.classList.remove('active');
        });
        
        // Show the requested screen
        screens[screenId].classList.add('active');
    }
    
    // Initialize Profile Selection Screen
    function initProfileSelection() {
        elements.profilesContainer.innerHTML = '';
        
        personas.forEach(persona => {
            const profileCard = document.createElement('div');
            profileCard.className = 'profile-card';
            profileCard.innerHTML = `
                <img src="${persona.image}" alt="${persona.name}">
                <div class="profile-info">
                    <h3>${persona.name}, ${persona.age}</h3>
                    <p>${persona.bio}</p>
                </div>
            `;
            
            profileCard.addEventListener('click', () => {
                selectProfile(persona);
            });
            
            elements.profilesContainer.appendChild(profileCard);
        });
    }
    
    // Select a profile and start chat
    function selectProfile(persona) {
        // Initialize chat with selected persona
        chatManager.initChat(persona);
        
        // Update UI
        elements.chatProfilePic.src = persona.image;
        elements.chatProfileName.textContent = `${persona.name}, ${persona.age}`;
        elements.chatProfileStatus.textContent = 'Online';
        elements.chatMessages.innerHTML = '';
        
        // Add initial greeting
        addMessageToUI(chatManager.conversationHistory[0]);
        
        // Show chat interface
        showScreen('chatInterface');
    }
    
    // Add a message to the UI
    function addMessageToUI(message) {
        const messageElement = document.createElement('div');
        messageElement.className = `message ${message.role === 'user' ? 'sent' : 'received'}`;
        messageElement.textContent = message.content;
        
        elements.chatMessages.appendChild(messageElement);
        elements.chatMessages.scrollTop = elements.chatMessages.scrollHeight;
    }
    
    // Update score display
    function updateScore() {
        elements.scoreDisplay.textContent = chatManager.score;
    }
    
    // Send a message
    async function sendMessage() {
        const messageText = elements.messageText.value.trim();
        
        if (!messageText) return;
        
        // Add user message to chat
        const userMessage = chatManager.addUserMessage(messageText);
        addMessageToUI(userMessage);
        
        // Clear input
        elements.messageText.value = '';
        
        // Basic message analysis for scoring
        analyzeUserMessage(messageText);
        
        // Get AI response
        elements.chatProfileStatus.textContent = 'Typing...';
        const aiResponse = await chatManager.generateAIResponse();
        elements.chatProfileStatus.textContent = 'Online';
        
        // Add AI message to chat
        const aiMessage = chatManager.addAIMessage(aiResponse);
        addMessageToUI(aiMessage);
        
        // Update score display
        updateScore();
        
        // If conversation is long enough, show end button
        if (chatManager.conversationHistory.length >= 8) {
            const endChatButton = document.createElement('button');
            endChatButton.textContent = 'End Chat & Get Feedback';
            endChatButton.className = 'primary-btn';
            endChatButton.style.margin = '10px auto';
            endChatButton.style.display = 'block';
            
            if (!document.getElementById('end-chat-btn')) {
                endChatButton.id = 'end-chat-btn';
                elements.chatMessages.appendChild(endChatButton);
                
                endChatButton.addEventListener('click', () => {
                    showFeedback();
                });
            }
        }
    }
    
    // Analyze user message
    function analyzeUserMessage(message) {
        // Check message length
        if (message.length < 5) {
            chatManager.addFeedback('negative', 'Very short response', -5);
        } else if (message.length > 20) {
            chatManager.addFeedback('positive', 'Detailed response', 5);
        }
        
        // Check if user asked question
        if (message.includes('?')) {
            chatManager.addFeedback('positive', 'Asked a question', 5);
        }
        
        // Check for politeness
        if (message.toLowerCase().includes('please') || 
            message.toLowerCase().includes('thank') || 
            message.toLowerCase().includes('appreciate')) {
            chatManager.addFeedback('positive', 'Polite communication', 5);
        }
        
        // Check for interests match with persona
        chatManager.currentPersona.interests.forEach(interest => {
            if (message.toLowerCase().includes(interest.toLowerCase())) {
                chatManager.addFeedback('positive', `Mentioned shared interest: ${interest}`, 10);
            }
        });
    }
    
    // Show feedback screen
    function showFeedback() {
        const analysis = chatManager.analyzeConversation();
        
        let feedbackHTML = `
            <h3>Your Score: ${analysis.score}</h3>
            <p>${analysis.summary}</p>
            <div class="feedback-points">
        `;
        
        // Add feedback points
        analysis.feedbackPoints.forEach(point => {
            feedbackHTML += `
                <div class="feedback-item feedback-${point.type}">
                    <strong>${point.points > 0 ? '+' : ''}${point.points} points:</strong> ${point.message}
                </div>
            `;
        });
        
        // Add tips
        if (analysis.tips.length > 0) {
            feedbackHTML += '<h4>Tips for improvement:</h4><ul>';
            analysis.tips.forEach(tip => {
                feedbackHTML += `<li>${tip}</li>`;
            });
            feedbackHTML += '</ul>';
        }
        
        feedbackHTML += '</div>';
        
        elements.feedbackContent.innerHTML = feedbackHTML;
        showScreen('feedbackScreen');
    }
    
    // Event Listeners
    elements.startBtn.addEventListener('click', () => {
        initProfileSelection();
        showScreen('profileSelection');
    });
    
    elements.backBtn.addEventListener('click', () => {
        if (confirm('End this chat and return to profiles?')) {
            showScreen('profileSelection');
        }
    });
    
    elements.sendBtn.addEventListener('click', sendMessage);
    
    elements.messageText.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            sendMessage();
        }
    });
    
    elements.continueBtn.addEventListener('click', () => {
        chatManager.resetChat();
        showScreen('profileSelection');
    });
    
    // Start with onboarding screen
    showScreen('onboarding');
});