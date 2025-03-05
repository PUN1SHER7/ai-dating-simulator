// chat.js - Enhanced chat manager with realistic ghosting and response rates

class ChatManager {
    constructor(config) {
        this.config = config || {};
        this.conversations = {};
        this.currentConversationId = null;
        this.apiKey = localStorage.getItem('openrouter_api_key') || '';
        this.userProfile = JSON.parse(localStorage.getItem('user_profile')) || {
            name: '',
            age: 25,
            location: '',
            bio: '',
            interests: []
        };
        this.stats = JSON.parse(localStorage.getItem('user_stats')) || {
            messagesSent: 0,
            responsesReceived: 0,
            conversations: 0,
            datesArranged: 0,
            ghosted: 0
        };
        this.timeMultiplier = 1; // For time simulation (1 = real time, 0.1 = 10x faster, etc.)
        this.loadDifficulty();
        
        // Load existing conversations from localStorage
        this.loadConversations();
        
        // Set up timer to check for pending responses
        setInterval(() => this.checkPendingResponses(), 30000); // Check every 30 seconds
    }

    // Load difficulty settings
    loadDifficulty() {
        const difficulty = localStorage.getItem('difficulty') || 'medium';
        
        switch(difficulty) {
            case 'easy':
                this.responseRateMultiplier = 2; // Doubles response rates (still low)
                break;
            case 'hard':
                this.responseRateMultiplier = 0.5; // Halves response rates (very low)
                break;
            case 'medium':
            default:
                this.responseRateMultiplier = 1; // Normal response rates (low)
                break;
        }
        
        // Get time simulation setting
        const timeSimulation = localStorage.getItem('time_simulation') || 'accelerated';
        
        switch(timeSimulation) {
            case 'real':
                this.timeMultiplier = 1; // Real time
                break;
            case 'instant':
                this.timeMultiplier = 0.01; // Almost instant
                break;
            case 'accelerated':
            default:
                this.timeMultiplier = 0.05; // 20x faster (1 day = 72 minutes)
                break;
        }
    }

    // Load conversations from localStorage
    loadConversations() {
        const savedConversations = localStorage.getItem('conversations');
        if (savedConversations) {
            try {
                const parsed = JSON.parse(savedConversations);
                
                // Convert date strings back to Date objects
                Object.keys(parsed).forEach(id => {
                    const conv = parsed[id];
                    conv.lastActivity = new Date(conv.lastActivity);
                    conv.lastRead = new Date(conv.lastRead);
                    if (conv.nextResponseTime) {
                        conv.nextResponseTime = new Date(conv.nextResponseTime);
                    }
                    
                    // Convert message timestamps back to Date objects
                    conv.messages.forEach(msg => {
                        msg.timestamp = new Date(msg.timestamp);
                    });
                });
                
                this.conversations = parsed;
            } catch (error) {
                console.error('Error loading conversations:', error);
                this.conversations = {};
            }
        }
    }

    // Save conversations to localStorage
    saveConversations() {
        try {
            localStorage.setItem('conversations', JSON.stringify(this.conversations));
        } catch (error) {
            console.error('Error saving conversations:', error);
            // If localStorage is full, we could implement a cleanup strategy here
        }
    }

    // Initialize a conversation with a persona
    initConversation(persona) {
        const conversationId = `conv_${persona.id}_${Date.now()}`;
        
        // Adjust response rate based on difficulty
        const adjustedRate = persona.responseRate * this.responseRateMultiplier;
        
        this.conversations[conversationId] = {
            persona: persona,
            messages: [],
            status: 'active',
            lastActivity: new Date(),
            lastRead: new Date(),
            nextResponseTime: null,
            willRespond: this.willPersonaRespond(adjustedRate),
            currentResponseRate: adjustedRate, // Store the current response rate
            ghostingChance: 10 + Math.floor(Math.random() * 30) // 10-40% chance of ghosting after each message
        };
        
        this.currentConversationId = conversationId;
        this.stats.conversations++;
        this.saveStats();
        this.saveConversations();
        
        return conversationId;
    }

    // Determine if a persona will respond based on their response rate
    willPersonaRespond(responseRate) {
        const roll = Math.random() * 100;
        return roll <= responseRate;
    }

    // Get all conversations
    getAllConversations() {
        return Object.entries(this.conversations).map(([id, conv]) => ({
            id,
            persona: conv.persona,
            lastMessage: conv.messages.length > 0 ? 
                conv.messages[conv.messages.length - 1] : null,
            unread: this.hasUnreadMessages(id),
            status: conv.status,
            lastActivity: conv.lastActivity
        }));
    }

    // Check if conversation has unread messages
    hasUnreadMessages(conversationId) {
        const conv = this.conversations[conversationId];
        if (!conv) return false;
        
        // Find last received message
        for (let i = conv.messages.length - 1; i >= 0; i--) {
            const msg = conv.messages[i];
            if (msg.sender === 'persona' && new Date(msg.timestamp) > new Date(conv.lastRead)) {
                return true;
            }
        }
        
        return false;
    }

    // Mark conversation as read
    markConversationAsRead(conversationId) {
        const conv = this.conversations[conversationId];
        if (conv) {
            conv.lastRead = new Date();
            this.saveConversations();
        }
    }

    // Send a message to a persona
    async sendMessage(conversationId, messageText) {
        const conv = this.conversations[conversationId];
        if (!conv) return null;
        
        // Create message object
        const message = {
            id: `msg_${Date.now()}`,
            sender: 'user',
            content: messageText,
            timestamp: new Date(),
            status: 'sent'
        };
        
        // Add to conversation
        conv.messages.push(message);
        conv.lastActivity = new Date();
        
        // Update stats
        this.stats.messagesSent++;
        this.saveStats();
        
        // Randomly decide if this will be ghosted
        const willGhost = Math.random() * 100 < conv.ghostingChance;
        
        // Calculate if persona will respond (based on their response rate)
        // If ghosting, they definitely won't respond
        const willRespond = !willGhost && this.willPersonaRespond(conv.currentResponseRate);
        
        // Update conversation state
        conv.willRespond = willRespond;
        
        // Update status based on ghosting decision
        if (willGhost) {
            conv.status = 'ghosted';
            this.stats.ghosted++;
            this.saveStats();
        }
        
        // Save changes
        this.saveConversations();
        
        // Mark message as delivered after a short delay
        setTimeout(() => {
            const msgIndex = conv.messages.findIndex(m => m.id === message.id);
            if (msgIndex !== -1) {
                conv.messages[msgIndex].status = 'delivered';
                this.saveConversations();
                
                // Notify UI of status change
                if (typeof this.config.onMessageStatusChanged === 'function') {
                    this.config.onMessageStatusChanged(conversationId, conv.messages[msgIndex]);
                }
            }
        }, 1000 + Math.random() * 2000); // 1-3 seconds delay for "delivered"
        
        // If persona will respond, schedule a response
        if (willRespond) {
            await this.scheduleResponse(conversationId);
        }
        
        return message;
    }

    // Schedule a response from the persona
    async scheduleResponse(conversationId) {
        const conv = this.conversations[conversationId];
        if (!conv) return;
        
        // Determine response time (in hours, converted to milliseconds)
        const minHours = conv.persona.responseTime.min;
        const maxHours = conv.persona.responseTime.max;
        const responseHours = minHours + Math.random() * (maxHours - minHours);
        
        // Apply time multiplier
        const responseDelayMs = responseHours * 3600000 * this.timeMultiplier;
        
        // Set next response time
        const nextResponseTime = new Date(Date.now() + responseDelayMs);
        conv.nextResponseTime = nextResponseTime;
        this.saveConversations();
        
        // For longer delays, just schedule an update check that will fire before the response
        if (responseDelayMs > 30000) { // If more than 30 seconds
            console.log(`Scheduled response for ${conversationId} in ${responseHours} hours (${responseDelayMs}ms with multiplier)`);
            return;
        }
        
        // For short delays, wait and then generate response
        setTimeout(async () => {
            await this.generateResponse(conversationId);
        }, responseDelayMs);
    }

    // Check for pending responses (called periodically)
    async checkPendingResponses() {
        const now = new Date();
        
        for (const [id, conv] of Object.entries(this.conversations)) {
            if (conv.nextResponseTime && now >= conv.nextResponseTime) {
                // Time to respond
                console.log(`Time to respond for conversation ${id}`);
                conv.nextResponseTime = null;
                this.saveConversations();
                await this.generateResponse(id);
            }
        }
    }

    // Generate a response from the persona using OpenRouter
    async generateResponse(conversationId) {
        const conv = this.conversations[conversationId];
        if (!conv || !this.apiKey) return null;
        
        // Ensure the conversation is still active
        if (conv.status !== 'active') {
            console.log(`Conversation ${conversationId} is no longer active (${conv.status})`);
            return null;
        }
        
        // Create a pending message first to show "typing..."
        const pendingMessage = {
            id: `msg_${Date.now()}`,
            sender: 'persona',
            content: '...',
            timestamp: new Date(),
            status: 'typing'
        };
        
        conv.messages.push(pendingMessage);
        this.saveConversations();
        
        // Notify the UI of typing state
        if (typeof this.config.onTypingStarted === 'function') {
            this.config.onTypingStarted(conversationId, pendingMessage);
        }
        
        try {
            // Generate personality prompt for the AI
            const personalityPrompt = sheetsAPI.generatePersonaPrompt(conv.persona);
            
            // Get recent messages for context
            const recentMessages = conv.messages
                .filter(msg => msg.status !== 'typing')
                .slice(-10)
                .map(msg => ({
                    role: msg.sender === 'user' ? 'user' : 'assistant',
                    content: msg.content
                }));
            
            // Format messages for the API
            const messages = [
                { role: "system", content: personalityPrompt },
                ...recentMessages
            ];
            
            // Add a small random delay to simulate typing
            const typingDelay = Math.floor(1000 + Math.random() * 3000);
            await new Promise(resolve => setTimeout(resolve, typingDelay));
            
            // Make the API request to OpenRouter
            const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.apiKey}`,
                    'HTTP-Referer': window.location.href,
                    'X-Title': 'AI Dating Simulator'
                },
                body: JSON.stringify({
                    model: this.config.aiModel || 'openai/gpt-3.5-turbo',
                    messages: messages,
                    temperature: 0.7,
                    max_tokens: 150
                })
            });
            
            if (!response.ok) {
                throw new Error(`API error: ${response.status}`);
            }
            
            const data = await response.json();
            const aiResponse = data.choices[0].message.content;
            
            // Update the pending message with the real response
            const messageIndex = conv.messages.findIndex(m => m.id === pendingMessage.id);
            if (messageIndex !== -1) {
                conv.messages[messageIndex] = {
                    ...pendingMessage,
                    content: aiResponse,
                    timestamp: new Date(),
                    status: 'delivered'
                };
                
                // Mark as read after a delay (simulating read receipt)
                setTimeout(() => {
                    if (this.conversations[conversationId]) {
                        const updatedMsgIndex = this.conversations[conversationId].messages.findIndex(m => m.id === pendingMessage.id);
                        if (updatedMsgIndex !== -1) {
                            this.conversations[conversationId].messages[updatedMsgIndex].status = 'read';
                            this.saveConversations();
                            
                            // Notify the UI of status change
                            if (typeof this.config.onMessageStatusChanged === 'function') {
                                this.config.onMessageStatusChanged(conversationId, this.conversations[conversationId].messages[updatedMsgIndex]);
                            }
                        }
                    }
                }, 10000 * this.timeMultiplier);
                
                // Update stats
                this.stats.responsesReceived++;
                this.saveStats();
                
                // Update conversation state
                // Decrease the response rate each time (conversation degradation) - very realistic!
                conv.currentResponseRate = Math.max(conv.currentResponseRate * 0.8, 1);
                
                // Increase ghosting chance with each exchange
                conv.ghostingChance += 5;
                
                // Determine if persona will respond to next message
                conv.willRespond = this.willPersonaRespond(conv.currentResponseRate);
                
                this.saveConversations();
                
                // Notify the UI
                if (typeof this.config.onMessageReceived === 'function') {
                    this.config.onMessageReceived(conversationId, conv.messages[messageIndex]);
                }
                
                return conv.messages[messageIndex];
            }
            
            return null;
            
        } catch (error) {
            console.error("Error generating AI response:", error);
            
            // Remove the pending message
            const updatedMessages = conv.messages.filter(m => m.id !== pendingMessage.id);
            conv.messages = updatedMessages;
            this.saveConversations();
            
            // Notify the UI that typing has stopped
            if (typeof this.config.onTypingStopped === 'function') {
                this.config.onTypingStopped(conversationId);
            }
            
            return null;
        }
    }

    // Get a conversation by ID
    getConversation(conversationId) {
        return this.conversations[conversationId];
    }

    // Get messages for a conversation
    getMessages(conversationId) {
        const conv = this.conversations[conversationId];
        return conv ? conv.messages : [];
    }

    // Delete a conversation
    deleteConversation(conversationId) {
        if (this.conversations[conversationId]) {
            delete this.conversations[conversationId];
            this.saveConversations();
            return true;
        }
        return false;
    }

    // Check if a message contains a date proposal
    checkForDateProposal(message) {
        const dateKeywords = [
            'meet up', 'grab a coffee', 'get drinks', 'dinner', 'lunch', 
            'go out', 'date', 'this weekend', 'get together'
        ];
        
        const questionWords = ['would', 'could', 'want', 'free', 'available', 'like to'];
        
        const hasDateKeyword = dateKeywords.some(keyword => 
            message.toLowerCase().includes(keyword));
            
        const hasQuestion = questionWords.some(word => 
            message.toLowerCase().includes(word)) || message.includes('?');
            
        return hasDateKeyword && hasQuestion;
    }

    // Save stats to localStorage
    saveStats() {
        localStorage.setItem('user_stats', JSON.stringify(this.stats));
    }

    // Get persona's online status text
    getOnlineStatusText(persona) {
        if (persona.lastActive) {
            return persona.lastActive;
        }
        
        // Generate random last online time based on persona
        const lastOnlineHours = Math.floor(Math.random() * 168); // Up to 7 days
        
        if (lastOnlineHours < 1) {
            return 'Online now';
        } else if (lastOnlineHours < 2) {
            return 'Last active 1 hour ago';
        } else if (lastOnlineHours < 24) {
            return `Last active ${lastOnlineHours} hours ago`;
        } else {
            const days = Math.floor(lastOnlineHours / 24);
            return `Last active ${days} ${days === 1 ? 'day' : 'days'} ago`;
        }
    }

    // Analyze conversation and generate feedback
    analyzeConversation(conversationId) {
        const conv = this.conversations[conversationId];
        if (!conv) return null;
        
        const userMessages = conv.messages.filter(m => m.sender === 'user');
        const personaMessages = conv.messages.filter(m => m.sender === 'persona');
        
        const analysis = {
            score: 0,
            feedbackPoints: [],
            summary: "Here's how your conversation went:",
            tips: []
        };
        
        // Analyze message length
        const avgUserMessageLength = userMessages.reduce((sum, m) => sum + m.content.length, 0) / userMessages.length;
        
        if (avgUserMessageLength < 20) {
            analysis.feedbackPoints.push({
                type: 'negative',
                message: 'Your messages were very short',
                points: -10
            });
            analysis.tips.push("Try to write more detailed messages to keep the conversation engaging.");
        } else if (avgUserMessageLength > 100) {
            analysis.feedbackPoints.push({
                type: 'positive',
                message: 'You wrote detailed messages',
                points: 10
            });
        }
        
        // Analyze questions asked
        const questionsAsked = userMessages.filter(m => m.content.includes('?')).length;
        
        if (questionsAsked < 2) {
            analysis.feedbackPoints.push({
                type: 'negative',
                message: 'You asked few questions',
                points: -10
            });
            analysis.tips.push("Ask more questions to show interest in your match.");
        } else if (questionsAsked >= 3) {
            analysis.feedbackPoints.push({
                type: 'positive',
                message: 'You asked good questions',
                points: 15
            });
        }
        
        // Analyze response rate
        const responseRate = personaMessages.length / userMessages.length;
        
        if (responseRate < 0.5) {
            analysis.feedbackPoints.push({
                type: 'negative',
                message: `${conv.persona.name} showed low interest`,
                points: 0
            });
            analysis.tips.push("Try to engage with topics that align with their interests.");
        } else if (responseRate >= 0.8) {
            analysis.feedbackPoints.push({
                type: 'positive',
                message: `${conv.persona.name} showed high interest`,
                points: 20
            });
        }
        
        // Check if ghosted
        if (conv.status === 'ghosted') {
            analysis.feedbackPoints.push({
                type: 'negative',
                message: `${conv.persona.name} ghosted you`,
                points: -5
            });
            analysis.tips.push("This is very common in dating apps. Don't take it personally!");
        }
        
        // Check for interests mentioned
        const interestsMentioned = conv.persona.interests.filter(interest => 
            userMessages.some(m => m.content.toLowerCase().includes(interest.toLowerCase()))
        );
        
        if (interestsMentioned.length > 0) {
            analysis.feedbackPoints.push({
                type: 'positive',
                message: `You discussed ${interestsMentioned.length} shared interests`,
                points: interestsMentioned.length * 5
            });
        } else {
            analysis.feedbackPoints.push({
                type: 'negative',
                message: "You didn't discuss their interests",
                points: -15
            });
            analysis.tips.push("Check their profile and mention their interests in your messages.");
        }
        
        // Check for date proposal
        const dateProposed = userMessages.some(m => this.checkForDateProposal(m.content));
        
        if (dateProposed) {
            const dateAccepted = personaMessages.some(m => 
                this.checkForDateProposal(m.content) ||
                m.content.toLowerCase().includes('yes') ||
                m.content.toLowerCase().includes('sure')
            );
            
            if (dateAccepted) {
                analysis.feedbackPoints.push({
                    type: 'positive',
                    message: "You successfully arranged a date!",
                    points: 50
                });
                this.stats.datesArranged++;
                this.saveStats();
            } else {
                analysis.feedbackPoints.push({
                    type: 'neutral',
                    message: "You proposed a date but they didn't accept",
                    points: 0
                });
                analysis.tips.push("Try building more rapport before asking for a date.");
            }
        } else if (userMessages.length > 5) {
            analysis.tips.push("Consider moving the conversation towards meeting in person after establishing rapport.");
        }
        
        // Calculate final score
        analysis.score = analysis.feedbackPoints.reduce((sum, fp) => sum + fp.points, 0);
        
        return analysis;
    }
    
    // Reset all data
    resetAllData() {
        this.conversations = {};
        this.stats = {
            messagesSent: 0,
            responsesReceived: 0,
            conversations: 0,
            datesArranged: 0,
            ghosted: 0
        };
        
        this.saveConversations();
        this.saveStats();
    }
}

// Create a global instance
const chatManager = new ChatManager({
    aiModel: 'openai/gpt-3.5-turbo',
    onMessageReceived: null, // Will be set in UI.js
    onTypingStarted: null,   // Will be set in UI.js
    onTypingStopped: null,   // Will be set in UI.js
    onMessageStatusChanged: null // Will be set in UI.js
});