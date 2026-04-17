/**
 * ====================================
 *  FitCoach AI - WhatsApp Fitness Coach
 *  Powered by Google Gemini
 * ====================================
 */

const { Client, LocalAuth } = require('whatsapp-web.js');
const QRCode = require('qrcode');
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const config = require('./config');
const aiService = require('./aiService');
const intentHandler = require('./intentHandler');
const conversationStore = require('./conversationStore');

// ─── Puppeteer Setup (Laptop + Mobile Support) ──────────────
const puppeteerConfig = {
  headless: true,
  args: [
    '--no-sandbox',
    '--disable-setuid-sandbox',
    '--disable-dev-shm-usage',
    '--disable-accelerated-2d-canvas',
    '--no-first-run',
    '--disable-gpu',
  ],
};

// Agar process mobile (Termux) par chal raha hai toh uska rasta do
if (process.platform === 'android') {
  puppeteerConfig.executablePath = '/data/data/com.termux/files/usr/bin/chromium-browser';
} else if (process.env.PUPPETEER_EXECUTABLE_PATH) {
  // Cloud Server / Docker ke liye
  puppeteerConfig.executablePath = process.env.PUPPETEER_EXECUTABLE_PATH;
}

// ─── Initialize WhatsApp Client ─────────────────────────────────
const client = new Client({
  authStrategy: new LocalAuth({
    dataPath: config.SESSION_PATH,
  }),
  puppeteer: puppeteerConfig,
});

// ─── QR Code Event ──────────────────────────────────────────────
let qrPageOpened = false;

client.on('qr', async (qr) => {
  console.log('\n📱 QR Code generated! Opening in browser...\n');

  try {
    // Generate QR code as data URL
    const qrDataUrl = await QRCode.toDataURL(qr, {
      width: 400,
      margin: 2,
      color: { dark: '#000000', light: '#FFFFFF' },
    });

    // Create a nice HTML page with the QR code
    const htmlContent = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>WhatsApp QR Code - Scan to Connect</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
      background: linear-gradient(135deg, #075e54 0%, #128c7e 50%, #25d366 100%);
      display: flex; justify-content: center; align-items: center;
      min-height: 100vh; color: #fff;
    }
    .card {
      background: #fff; border-radius: 20px; padding: 40px;
      box-shadow: 0 20px 60px rgba(0,0,0,0.3); text-align: center;
      max-width: 500px; width: 90%;
    }
    .logo { font-size: 48px; margin-bottom: 10px; }
    h1 { color: #075e54; font-size: 22px; margin-bottom: 5px; }
    .subtitle { color: #666; font-size: 14px; margin-bottom: 25px; }
    .qr-container {
      background: #f0f0f0; border-radius: 15px; padding: 20px;
      display: inline-block; margin-bottom: 25px;
    }
    .qr-container img { display: block; width: 300px; height: 300px; }
    .steps { text-align: left; color: #333; font-size: 14px; line-height: 2; }
    .steps span { color: #25d366; font-weight: bold; }
    .timer { color: #999; font-size: 12px; margin-top: 15px; }
    .connected { display: none; color: #25d366; font-size: 20px; font-weight: bold; }
  </style>
</head>
<body>
  <div class="card">
    <div class="logo">📱</div>
    <h1>${config.BUSINESS_NAME} - WhatsApp Bot</h1>
    <p class="subtitle">Scan QR code to connect your WhatsApp</p>
    <div class="qr-container">
      <img src="${qrDataUrl}" alt="WhatsApp QR Code" />
    </div>
    <div class="steps">
      <span>1.</span> Open WhatsApp on your phone<br>
      <span>2.</span> Tap <b>Menu ⋮</b> → <b>Linked Devices</b><br>
      <span>3.</span> Tap <b>Link a Device</b><br>
      <span>4.</span> Point your phone camera at this QR code
    </div>
    <p class="timer">⏳ QR code refreshes automatically if expired</p>
  </div>
</body>
</html>`;

    // Save QR HTML file
    const qrFilePath = path.join(__dirname, 'qr-code.html');
    fs.writeFileSync(qrFilePath, htmlContent);
    console.log('✅ QR code saved to: qr-code.html');

    // Open in default browser (only first time)
    if (!qrPageOpened) {
      qrPageOpened = true;
      if (process.platform === 'win32') {
        // Windows: start "" "path" — empty title needed for paths with spaces
        exec(`start "" "${qrFilePath}"`);
      } else if (process.platform === 'darwin') {
        exec(`open "${qrFilePath}"`);
      } else {
        exec(`xdg-open "${qrFilePath}"`);
      }
      console.log('🌐 QR code opened in browser!\n');
    } else {
      console.log('🔄 QR code updated! Refresh browser page to see new QR.\n');
    }

    console.log('👉 Scan the QR code with WhatsApp > Linked Devices > Link a Device\n');
  } catch (err) {
    console.error('⚠️ Could not generate QR image:', err.message);
    console.log('QR raw data:', qr);
  }
});

// ─── Authentication Events ──────────────────────────────────────
client.on('authenticated', () => {
  console.log('✅ WhatsApp authenticated successfully!');
});

client.on('auth_failure', (msg) => {
  console.error('❌ Authentication failed:', msg);
  console.log('🔄 Deleting session and restarting...');
  // Session will be regenerated on next start
});

// ─── Ready Event ────────────────────────────────────────────────
client.on('ready', () => {
  console.log('\n' + '='.repeat(50));
  console.log('  💪 FitCoach AI is LIVE!');
  console.log('  📊 Coach: ' + config.BUSINESS_NAME);
  console.log('  ⏰ Started at: ' + new Date().toLocaleString('en-IN'));
  console.log('='.repeat(50) + '\n');

  // Start inactivity checker
  startInactivityChecker();
});

// ─── Message Handler ────────────────────────────────────────────
client.on('message', async (msg) => {
  try {
    // Skip group messages, status updates, newsletters, and media-only messages
    if (msg.from.includes('@g.us')) return;           // Group message
    if (msg.from.includes('@newsletter')) return;     // Newsletter message
    if (msg.from === 'status@broadcast') return;       // Status update
    if (msg.type === 'sticker') return;                // Stickers
    if (!msg.body || msg.body.trim() === '') return;   // Empty messages

    const userId = msg.from;
    const userMessage = msg.body.trim();
    const contact = await msg.getContact();
    const contactName = contact.pushname || contact.name || 'Customer';

    // Log incoming message
    console.log(`\n📩 [${new Date().toLocaleTimeString('en-IN')}] ${contactName} (${userId}):`);
    console.log(`   "${userMessage}"`);

    // Save contact name if available
    if (contactName && contactName !== 'Customer') {
      conversationStore.updateUserData(userId, { name: contactName });
    }

    // Detect intent and enhance message
    const { enhanced, intent } = intentHandler.enhanceMessage(userId, userMessage);

    console.log(`   🎯 Intent: ${intent}`);

    // Show typing indicator
    const chat = await msg.getChat();
    await chat.sendStateTyping();

    // Add natural delay before replying
    const delay = config.REPLY_DELAY + Math.random() * 1000;
    await sleep(delay);

    // Generate AI reply
    const reply = await aiService.generateReply(userId, enhanced);

    // Send the reply
    await msg.reply(reply);

    // Log outgoing message
    console.log(`   🤖 Reply: "${reply.substring(0, 100)}${reply.length > 100 ? '...' : ''}"`);

    // Handle escalation — notify owner
    if (intent === 'escalation' && config.OWNER_NUMBER) {
      try {
        const ownerChatId = config.OWNER_NUMBER + '@c.us';
        const escalationMsg = `🚨 *Customer Escalation*\n\nFrom: ${contactName}\nNumber: ${userId}\nMessage: "${userMessage}"\n\nPlease follow up.`;
        await client.sendMessage(ownerChatId, escalationMsg);
        console.log('   📢 Owner notified about escalation');
      } catch (err) {
        console.error('   ⚠️ Could not notify owner:', err.message);
      }
    }

  } catch (error) {
    console.error('❌ Message handling error:', error);
    try {
      await msg.reply('Main check karke best plan deta hoon, thoda wait kar 🙏');
    } catch (e) {
      // Can't even send fallback
    }
  }
});

// ─── Inactivity Follow-up System ────────────────────────────────
function startInactivityChecker() {
  setInterval(async () => {
    const inactiveUsers = conversationStore.getInactiveUsers(config.INACTIVITY_TIMEOUT);

    for (const user of inactiveUsers) {
      try {
        const followUpMsg = await aiService.generateFollowUp(user.userId);
        await client.sendMessage(user.userId, followUpMsg);
        // Reset their timer so we don't spam
        conversationStore.addMessage(user.userId, 'model', followUpMsg);
        console.log(`📤 Follow-up sent to ${user.name || user.userId}`);
      } catch (err) {
        console.error(`⚠️ Follow-up failed for ${user.userId}:`, err.message);
      }
    }
  }, 5 * 60 * 1000); // Check every 5 minutes
}

// ─── Disconnection Handler ──────────────────────────────────────
client.on('disconnected', (reason) => {
  console.log('⚠️ Client disconnected:', reason);
  console.log('🔄 Attempting to reconnect...');
  setTimeout(() => {
    client.initialize();
  }, 5000);
});

// ─── Graceful Shutdown ──────────────────────────────────────────
process.on('SIGINT', async () => {
  console.log('\n🛑 Shutting down gracefully...');
  try {
    await client.destroy();
  } catch (e) {
    // Ignore
  }
  process.exit(0);
});

process.on('unhandledRejection', (reason) => {
  console.error('⚠️ Unhandled promise rejection:', reason);
});

// ─── Utility ────────────────────────────────────────────────────
function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ─── Start the bot ──────────────────────────────────────────────
console.log('\n🚀 Starting FitCoach AI - WhatsApp Fitness Coach...');
console.log('📦 Loading modules...\n');
client.initialize();
