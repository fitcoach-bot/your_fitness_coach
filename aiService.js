const config = require('./config');
const conversationStore = require('./conversationStore');

/**
 * AI Service - Fixed OpenRouter Version
 */
class AIService {
  constructor() {
    // Hardcoded key for immediate fix, but using ENV as priority
    this.apiKey = process.env.GEMINI_API_KEY || "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";
    console.log('✅ OpenRouter AI Service Initialized with provided Key');
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

      const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${this.apiKey}`,
          "Content-Type": "application/json",
          "HTTP-Referer": "https://github.com/fitcoach-bot"
        },
        body: JSON.stringify({
          "model": "google/gemini-flash-1.5",
          "messages": messages,
          "temperature": 0.8
        })
      });

      const data = await response.json();
      
      if (data.error) throw new Error(data.error.message);

      const replyText = data.choices[0].message.content;
      const cleanedResponse = this.cleanForWhatsApp(replyText);

      conversationStore.addMessage(userId, 'user', userMessage);
      conversationStore.addMessage(userId, 'model', cleanedResponse);

      return cleanedResponse;
    } catch (error) {
      console.error('❌ AI Business Error:', error.message);
      return 'Main check karke jaldi batata hoon! 🙏';
    }
  }

  async generateFollowUp(userId) {
    try {
      const prompt = "Send a short motivational fitness check-in message in Hinglish.";
      const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${this.apiKey}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          "model": "google/gemini-flash-1.5",
          "messages": [{ role: "user", content: prompt }]
        })
      });
      const data = await response.json();
      return this.cleanForWhatsApp(data.choices[0].message.content);
    } catch (err) {
      return 'Workout kaisa chal raha hai? 💪';
    }
  }

  cleanForWhatsApp(text) {
    return text.replace(/\*\*(.*?)\*\*/g, '*$1*').replace(/##?\s*/g, '').trim();
  }
}

module.exports = new AIService();
