// chat.js - Handles the communication with OpenRouter API

class ChatManager {
    constructor() {
        this.currentPersona = null;
        this.conversationHistory = [];
        this.apiKey = ''; // You'll need to set this from the user input
        this.score = 0;
        this.feedbackPoints = [];
    }

    // Initialize the chat with a specific persona
    initChat(persona) {
        this.currentPersona = persona;
        this.conversationHistory = [];
        this.feedbackPoints = [];
        this.score = 0;
        
        // Add initial greeting from the persona
        this.addAIMessage(this.getInitialGreeting());
    }

    // Get initial greeting based on persona's personality
    getInitialGreeting() {
        const persona = this.currentPersona;
        
        if (persona.personality.extroversion > 7) {
            return `Hey there! I'm ${persona.name}. Your profile caught my eye! What have you been up to lately?`;
        } else if (persona.personality.extroversion < 4) {
            return `Hi, I'm ${persona.name}. Nice to connect. What do you enjoy doing in your free time?`;
        } else {
            return `Hello! I'm ${persona.name}. Thanks for matching with me. What interests you outside of work?`;
        }
    }

    // Add a message from the user to the conversation
    addUserMessage(message) {
        const messageObj = {
            role: 'user',
            content: message
        };
        
        this.conversationHistory.push(messageObj);
        return messageObj;
    }

    // Add a message from the AI to the conversation
    addAIMessage(message) {
        const messageObj = {
            role: 'assistant',
            content: message
        };
        
        this.conversationHistory.push(messageObj);
        return messageObj;
    }

    // Generate a response from the AI using OpenRouter
    async generateAIResponse() {
        if (!this.currentPersona || !this.apiKey) {
            console.error("Persona not set or API key missing");
            return "Sorry, I can't respond right now.";
        }

        try {
            // Simulate realistic response time
            const responseDelay = this.getRandomResponseTime();
            await new Promise(resolve => setTimeout(resolve, responseDelay * 1000));
            
            // Create the prompt for the AI
            const personalityPrompt = generatePersonalityPrompt(this.currentPersona);
            
            // Get the last few messages for context (to save tokens)
            const recentMessages = this.conversationHistory.slice(-10);
            
            // Format the messages for the API
            const messages = [
                { role: "system", content: personalityPrompt },
                ...recentMessages
            ];
            
            // Make the API request to OpenRouter
            const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.apiKey}`,
                    'HTTP-Referer': window.location.href, // Required by OpenRouter
                    'X-Title': 'AI Dating Simulator' // Optional but good practice
                },
                body: JSON.stringify({
                    model: 'openai/gpt-3.5-turbo', // Use a free model from OpenRouter
                    messages: messages,
                    temperature: 0.7, // Add some variability to responses
                    max_tokens: 150 // Keep responses concise like in dating apps
                })
            });
            
            if (!response.ok) {
                throw new Error(`API error: ${response.status}`);
            }
            
            const data = await response.json();
            return data.choices[0].message.content;
            
        } catch (error) {
            console.error("Error generating AI response:", error);
            return "Sorry, I'm having trouble with my connection. Can we chat later?";
        }
    }

    // Get a random response time based on the persona's defined range
    getRandomResponseTime() {
        const { min, max } = this.currentPersona.responseTime;
        return Math.floor(Math.random() * (max - min + 1)) + min;
    }

    // Add a feedback point during the conversation
    addFeedback(type, message, points) {
        this.feedbackPoints.push({ type, message, points });
        this.score += points;
    }

    // Analyze the conversation and generate feedback
    analyzeConversation() {
        // This is a simplified version. Could be expanded with more sophisticated analysis
        const analysis = {
            score: this.score,
            feedbackPoints: this.feedbackPoints,
            summary: "Here's how your conversation went:",
            tips: []
        };
        
        // Add tips based on conversation
        if (this.conversationHistory.length < 5) {
            analysis.tips.push("Try to keep the conversation going longer to build connection.");
        }
        
        // Count how many questions the user asked
        const userMessages = this.conversationHistory.filter(msg => msg.role === 'user');
        const questionsAsked = userMessages.filter(msg => msg.content.includes('?')).length;
        
        if (questionsAsked < 2) {
            analysis.tips.push("Ask more questions to show interest in your match.");
            if (this.score > 5) this.score -= 5;
        } else if (questionsAsked >= 3) {
            analysis.feedbackPoints.push({
                type: 'positive',
                message: 'You asked good questions',
                points: 10
            });
            this.score += 10;
        }
        
        return analysis;
    }
    
    // Reset the current chat
    resetChat() {
        this.conversationHistory = [];
        this.feedbackPoints = [];
        this.score = 0;
        this.currentPersona = null;
    }
}

// Create a singleton instance
const chatManager = new ChatManager();