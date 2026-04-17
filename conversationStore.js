const config = require('./config');

/**
 * In-memory conversation store
 * Maintains chat history, user data, and activity tracking per user
 */
class ConversationStore {
  constructor() {
    // Map<userId, { history: [], userData: {}, lastActive: Date }>
    this.conversations = new Map();
  }

  /**
   * Get or create a conversation for a user
   */
  getConversation(userId) {
    if (!this.conversations.has(userId)) {
      this.conversations.set(userId, {
        history: [],
        userData: {
          name: null,
          interests: [],
          issues: [],
          firstContact: new Date().toISOString(),
        },
        lastActive: Date.now(),
        messageCount: 0,
      });
    }
    return this.conversations.get(userId);
  }

  /**
   * Add a message to history (keeps last MAX_HISTORY messages)
   */
  addMessage(userId, role, content) {
    const conv = this.getConversation(userId);
    conv.history.push({
      role,        // 'user' or 'model'
      parts: [{ text: content }],
    });

    // Trim history to stay within limits
    if (conv.history.length > config.MAX_HISTORY) {
      conv.history = conv.history.slice(-config.MAX_HISTORY);
    }

    conv.lastActive = Date.now();
    conv.messageCount++;
    return conv;
  }

  /**
   * Get chat history formatted for Gemini
   */
  getHistory(userId) {
    const conv = this.getConversation(userId);
    return conv.history;
  }

  /**
   * Update user data (name, interest, etc.)
   */
  updateUserData(userId, data) {
    const conv = this.getConversation(userId);
    Object.assign(conv.userData, data);
  }

  /**
   * Save a user interest
   */
  addInterest(userId, interest) {
    const conv = this.getConversation(userId);
    if (!conv.userData.interests.includes(interest)) {
      conv.userData.interests.push(interest);
    }
  }

  /**
   * Get time since last message (in minutes)
   */
  getInactiveMinutes(userId) {
    const conv = this.getConversation(userId);
    return (Date.now() - conv.lastActive) / (1000 * 60);
  }

  /**
   * Check if user is new (first message)
   */
  isNewUser(userId) {
    return !this.conversations.has(userId);
  }

  /**
   * Get all conversations (for monitoring)
   */
  getAllConversations() {
    const result = {};
    for (const [userId, conv] of this.conversations) {
      result[userId] = {
        messageCount: conv.messageCount,
        lastActive: new Date(conv.lastActive).toISOString(),
        userData: conv.userData,
      };
    }
    return result;
  }

  /**
   * Clear a specific conversation
   */
  clearConversation(userId) {
    this.conversations.delete(userId);
  }

  /**
   * Get inactive users (for follow-up)
   */
  getInactiveUsers(minutes = config.INACTIVITY_TIMEOUT) {
    const inactive = [];
    for (const [userId, conv] of this.conversations) {
      const inactiveMin = (Date.now() - conv.lastActive) / (1000 * 60);
      if (inactiveMin >= minutes && conv.messageCount > 0) {
        inactive.push({ userId, ...conv.userData, inactiveMinutes: Math.round(inactiveMin) });
      }
    }
    return inactive;
  }
}

module.exports = new ConversationStore();
