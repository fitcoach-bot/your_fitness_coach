const config = require('./config');
const conversationStore = require('./conversationStore');

/**
 * AI Service - Professional OpenRouter Integration (Final Fix)
 */
class AIService {
  constructor() {
    // Force using the provided key directly to avoid Railway Variable confusion
    this.apiKey = "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";
    console.log('✅ AI Service: Using Direct OpenRouter Key');
  }

  async generateReply(userId, userMessage) {
    try {
      const prevHistory = conversationStore.getHistory(userId);
      const messages = [
        { role: "system", content: config.SYSTEM_PROMPT },
        ...prevHistory.map(h => ({
          role: h.role === 'user' ? 'user' : 'assistant',
          content: h.parts ? h.parts[0].text : h.content
        })),
        { role: "user", content: userMessage }
      ];

      console.log(`🤖 Logic: Calling OpenRouter for user ${userId}...`);

      const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${this.apiKey.trim()}`, // Added .trim() for safety
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          "model": "google/gemini-flash-1.5",
          "messages": messages,
          "temperature": 0.8
        })
      });

      const data = await response.json();
      
      if (data.error) {
        console.error('❌ OpenRouter Provider Error:', data.error);
        throw new Error(data.error.message || "Auth Error");
      }

      const replyText = data.choices[0].message.content;
      const cleanedResponse = this.cleanForWhatsApp(replyText);

      conversationStore.addMessage(userId, 'user', userMessage);
      conversationStore.addMessage(userId, 'model', cleanedResponse);

      return cleanedResponse;
    } catch (error) {
      console.error('❌ AI Final Error:', error.message);
      return 'Main check karke batata hoon, server thoda busy hai! 🙏';
    }
  }

  async generateFollowUp(userId) {
    try {
      const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${this.apiKey.trim()}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          "model": "google/gemini-flash-1.5",
          "messages": [{ role: "user", content: "Short Hinglish fitness check-in" }]
        })
      });
      const data = await response.json();
      return this.cleanForWhatsApp(data.choices[0].message.content);
    } catch (err) {
      return 'Kaise chal raha hai workout? 💪';
    }
  }

  cleanForWhatsApp(text) {
    return text.replace(/\*\*(.*?)\*\*/g, '*$1*').replace(/##?\s*/g, '').trim();
  }
}

module.exports = new AIService();
