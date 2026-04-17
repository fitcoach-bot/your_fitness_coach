const conversationStore = require('./conversationStore');
const config = require('./config');

/**
 * Intent Handler - Detects fitness-related user intent and adds context
 */
class IntentHandler {
  constructor() {
    // Greeting patterns (Hindi + English)
    this.greetingPatterns = [
      /^(hi|hello|hey|hii+|helo|namaste|namaskar)[\s!.]*$/i,
      /^(kya hal|kaise ho|how are you|sup|wassup|good morning|good evening|good afternoon)[\s!?.]*$/i,
      /^(bhai|bro|dost|coach|sir|guru)[\s!.]*$/i,
    ];

    // Farewell patterns
    this.farewellPatterns = [
      /^(bye|goodbye|alvida|tata|ok bye|thanks bye|dhanyawad|shukriya)[\s!.]*$/i,
      /^(thank you|thankyou|thanks|thnx|thx|dhanyabad)[\s!.]*$/i,
    ];

    // Fitness goal patterns (weight loss, muscle gain, transformation)
    this.fitnessGoalPatterns = [
      /weight\s*loss|fat\s*loss|patla|slim|lean|belly\s*fat|pet\s*kam|motapa|weight\s*kam|vajan\s*kam/i,
      /muscle|gym|body\s*build|bulk|mass|gain|strength|takat|dola|bicep|chest|abs|six\s*pack/i,
      /transform|body\s*bana|fitness|fit\s*hona|healthy|stamina|endurance/i,
      /weight\s*gain|weight\s*badha|patla\s*hoon|dubla|skinny|underweight/i,
    ];

    // Diet inquiry patterns
    this.dietPatterns = [
      /diet|kya\s*khau|meal|khana|breakfast|lunch|dinner|snack|nutrition|protein|carb|calorie/i,
      /veg|non[\s-]*veg|egg|anda|vegetarian|chicken|paneer|doodh|milk|supplements?/i,
      /budget\s*diet|sasta|cheap|ghar\s*ka\s*khana|homemade|tiffin/i,
    ];

    // Workout inquiry patterns
    this.workoutPatterns = [
      /workout|exercise|kasrat|kasar|routine|schedule|training|warm\s*up|cool\s*down/i,
      /push\s*up|pull\s*up|squat|plank|crunch|deadlift|bench\s*press|cardio|running|walk/i,
      /home\s*workout|ghar\s*pe|bina\s*gym|without\s*gym|gym\s*ja|yoga|stretch/i,
      /sets?|reps?|kitne\s*set|kaise\s*karu|form|technique|video/i,
    ];

    // Subscription/pricing patterns
    this.subscriptionPatterns = [
      /price|cost|rate|kitna|kitne|fees|charges|amount|paisa|rupee|₹|\brs\b/i,
      /subscription|plan\s*chahiye|coaching|personal\s*trainer|hire|join|enroll|register/i,
      /paid|premium|package|offer|discount|trial|free/i,
    ];

    // Injury/medical concern patterns
    this.injuryPatterns = [
      /injury|chot|dard|pain|back\s*pain|knee|shoulder|joint|fracture|surgery|doctor/i,
      /sugar|diabetes|bp|blood\s*pressure|thyroid|pcod|pcos|heart|asthma/i,
    ];

    // Owner/human escalation patterns
    this.escalationPatterns = [
      /owner|manager|human|real person|kisi aur se|boss|incharge|complaint/i,
    ];
  }

  /**
   * Detect the intent of a message
   */
  detectIntent(userId, message) {
    const trimmedMsg = message.trim();
    const isNewUser = conversationStore.isNewUser(userId);

    // Check greeting
    for (const pattern of this.greetingPatterns) {
      if (pattern.test(trimmedMsg)) {
        return {
          intent: 'greeting',
          isGreeting: true,
          isNewUser,
          context: isNewUser
            ? 'This is a NEW person messaging for the first time. Introduce yourself as FitCoach, their personal fitness trainer. Ask about their fitness goal in a friendly way.'
            : 'This is a RETURNING user. Welcome them back warmly and ask about their progress or what they need today.',
        };
      }
    }

    // Check farewell
    for (const pattern of this.farewellPatterns) {
      if (pattern.test(trimmedMsg)) {
        return {
          intent: 'farewell',
          isFarewell: true,
          context: 'User is leaving. Thank them, give a quick motivational line, and invite them to come back anytime for fitness guidance.',
        };
      }
    }

    // Check escalation
    if (this.escalationPatterns.some(p => p.test(trimmedMsg))) {
      return {
        intent: 'escalation',
        context: config.OWNER_NUMBER
          ? `User wants to talk to a real person. Let them know you will connect them. Owner number: ${config.OWNER_NUMBER}`
          : 'User wants a real person. Let them know the team will get back shortly.',
      };
    }

    // Check injury/medical
    if (this.injuryPatterns.some(p => p.test(trimmedMsg))) {
      return {
        intent: 'injury',
        context: 'User is mentioning an injury or medical condition. Be empathetic, ask details, and ALWAYS recommend consulting a doctor first. Give safe general advice only. Never prescribe exercises for injured areas without medical clearance.',
      };
    }

    // Check subscription/pricing
    if (this.subscriptionPatterns.some(p => p.test(trimmedMsg))) {
      return {
        intent: 'subscription',
        context: 'User is asking about coaching/pricing/subscription. This is a HOT LEAD. Shift to sales mode naturally. Highlight value, benefits, and offer a trial or clear pricing. Make it feel like a genuine offer, not pushy.',
      };
    }

    // Check fitness goal
    if (this.fitnessGoalPatterns.some(p => p.test(trimmedMsg))) {
      return {
        intent: 'fitness_goal',
        context: 'User is talking about their fitness goal. This is a SERIOUS user. Ask smart questions one by one (age, weight, height, routine, diet preference, budget) to understand them better. Then offer to create a personalized plan.',
      };
    }

    // Check diet inquiry
    if (this.dietPatterns.some(p => p.test(trimmedMsg))) {
      return {
        intent: 'diet_inquiry',
        context: 'User is asking about diet/nutrition. Give practical, budget-friendly diet advice. Ask about their veg/non-veg preference and budget if not known. Provide simple meal suggestions they can actually follow.',
      };
    }

    // Check workout inquiry
    if (this.workoutPatterns.some(p => p.test(trimmedMsg))) {
      return {
        intent: 'workout_inquiry',
        context: 'User is asking about workouts/exercises. Give specific exercises with sets x reps. Ask if they have gym access or want home workouts. Suggest YouTube searches for proper form videos. Keep it simple and actionable.',
      };
    }

    // Default: general query
    return {
      intent: 'general',
      context: 'Answer the user helpfully with a fitness mindset. If you detect any interest in fitness, gently steer the conversation towards their goals. Give free value to build trust.',
    };
  }

  /**
   * Enhance the user message with intent context for better AI responses
   */
  enhanceMessage(userId, message) {
    const { intent, context } = this.detectIntent(userId, message);

    // Add context as a hidden instruction prefix
    const enhanced = `[CONTEXT: ${context}]\n\nCustomer message: ${message}`;

    return { enhanced, intent };
  }
}

module.exports = new IntentHandler();
