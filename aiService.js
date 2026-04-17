const { GoogleGenerativeAI } = require('@google/generative-ai');
const config = require('./config');
const conversationStore = require('./conversationStore');

/**
 * AI Service - Handles all Gemini AI interactions
 */
class AIService {
  constructor() {
    if (!config.GEMINI_API_KEY || config.GEMINI_API_KEY === 'YOUR_API_KEY_HERE') {
      console.error('❌ GEMINI_API_KEY not set! Please update your .env file.');
      process.exit(1);
    }

    this.genAI = new GoogleGenerativeAI(config.GEMINI_API_KEY);
    this.model = this.genAI.getGenerativeModel({
      model: 'gemini-2.5-flash',
      systemInstruction: config.SYSTEM_PROMPT,
      generationConfig: {
        temperature: 0.8,
        topP: 0.9,
        topK: 40,
        maxOutputTokens: 500,  // Keep replies short for WhatsApp
      },
    });

    console.log('✅ Gemini AI initialized successfully');
  }

  /**
   * Generate a reply using conversation history
   */
  async generateReply(userId, userMessage) {
    try {
      // Get existing conversation history
      const history = conversationStore.getHistory(userId);

      // Start chat with history
      const chat = this.model.startChat({
        history: history.length > 0 ? history : undefined,
      });

      // Send message and get response
      const result = await chat.sendMessage(userMessage);
      const response = result.response.text();

      // Clean the response for WhatsApp
      const cleanedResponse = this.cleanForWhatsApp(response);

      // Save both messages to history
      conversationStore.addMessage(userId, 'user', userMessage);
      conversationStore.addMessage(userId, 'model', cleanedResponse);

      // Try to extract user data from conversation
      this.extractUserData(userId, userMessage);

      return cleanedResponse;
    } catch (error) {
      console.error('❌ AI Error:', error.message);

      // Fallback responses
      if (error.message.includes('SAFETY')) {
        return 'Bhai, ye topic pe main help nahi kar paunga. Kuch aur bata sakte ho? 🙏';
      }
      if (error.message.includes('quota') || error.message.includes('429')) {
        return 'Abhi thoda busy hoon, 1 minute mein reply karta hoon! 🙏';
      }

      return 'Main check karke batata hoon, thoda wait karein 🙏';
    }
  }

  /**
   * Clean AI response for WhatsApp formatting
   */
  cleanForWhatsApp(text) {
    return text
      .replace(/\*\*(.*?)\*\*/g, '*$1*')    // Bold: ** → *
      .replace(/##\s*/g, '')                  // Remove markdown headers
      .replace(/###\s*/g, '')
      .replace(/`{3}[\s\S]*?`{3}/g, '')      // Remove code blocks
      .replace(/`(.*?)`/g, '$1')              // Remove inline code
      .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1') // Remove links, keep text
      .trim();
  }

  /**
   * Extract user data (name, interests) from messages
   */
  extractUserData(userId, message) {
    const lowerMsg = message.toLowerCase();

    // Try to detect name patterns
    const namePatterns = [
      /(?:my name is|mera naam|i am|i'm|main)\s+([a-zA-Z]+)/i,
      /(?:naam|name)\s*(?:hai|is|:)?\s*([a-zA-Z]+)/i,
    ];

    for (const pattern of namePatterns) {
      const match = message.match(pattern);
      if (match) {
        conversationStore.updateUserData(userId, { name: match[1] });
        break;
      }
    }

    // Detect fitness-related interests
    const interestKeywords = [
      'weight loss', 'fat loss', 'muscle', 'gym', 'diet', 'workout',
      'exercise', 'protein', 'bulk', 'lean', 'abs', 'cardio',
      'transformation', 'fitness', 'strength', 'stamina',
      'supplement', 'coaching', 'plan', 'trainer',
    ];

    for (const keyword of interestKeywords) {
      if (lowerMsg.includes(keyword)) {
        conversationStore.addInterest(userId, keyword);
      }
    }
  }

  /**
   * Generate a follow-up message for inactive users
   */
  async generateFollowUp(userId) {
    const conv = conversationStore.getConversation(userId);
    const name = conv.userData.name || '';
    const interests = conv.userData.interests.join(', ');

    let followUpPrompt = `The user ${name} has been inactive for a while. You are their fitness coach. `;
    if (interests) {
      followUpPrompt += `They were interested in: ${interests}. `;
    }
    followUpPrompt += `Send a gentle, motivational follow-up message to re-engage them about their fitness journey. Keep it very short (1-2 lines). Sound like a real coach checking in on them.`;

    try {
      const result = await this.model.generateContent(followUpPrompt);
      return this.cleanForWhatsApp(result.response.text());
    } catch (error) {
      return name
        ? `Hey ${name}! Kaise chal raha hai workout? Koi help chahiye toh bata 💪`
        : 'Hey! Kaise chal raha hai fitness journey? Koi help chahiye toh bata 💪';
    }
  }
}

module.exports = new AIService();
