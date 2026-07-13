// ============================================================
// ZURIFEX TELEGRAM BOT
// Real-time notifications for platform events
// ============================================================

const TelegramBot = require('node-telegram-bot-api');

// ============================================================
// CONFIGURATION
// ============================================================
const BOT_TOKEN = '8641375901:AAFLy_is84UBOkcvqwZun7w2eLVaVN8xQok';
const ADMIN_CHAT_ID = '7508256950'; // ← Your actual chat ID from getUpdates

// ============================================================
// INITIALIZE BOT
// ============================================================
const bot = new TelegramBot(BOT_TOKEN, { polling: true });

console.log('🤖 Zurifex Telegram Bot started!');
console.log('📨 Admin Chat ID: ' + ADMIN_CHAT_ID);

// ============================================================
// COMMANDS
// ============================================================

// /start - Welcome message
bot.onText(/\/start/, (msg) => {
    const chatId = msg.chat.id;
    const firstName = msg.from.first_name || 'User';

    const welcomeMessage = `
🚀 *Welcome to Zurifex Bot, ${firstName}!*

I'm your personal assistant for the Zurifex platform. I'll send you real-time notifications about:

💰 *Deposits* - When a user deposits funds
💸 *Withdrawals* - When a user requests a withdrawal
📝 *Tasks* - When a task is created or completed
👤 *Users* - When a new user registers
✅ *Admin Actions* - When approvals are needed

*Available Commands:*
/start - Show this welcome message
/help - Show available commands
/stats - Show platform statistics
/status - Check bot status
/verify - Verify your admin status
/ping - Test bot response

*Built by Rshiraz* 🇰🇪
    `;

    bot.sendMessage(chatId, welcomeMessage, { parse_mode: 'Markdown' });
});

// /help - Show help
bot.onText(/\/help/, (msg) => {
    const chatId = msg.chat.id;
    const helpMessage = `
📚 *Available Commands:*

/start - Welcome message
/help - Show this help menu
/stats - Show platform statistics
/status - Check bot connection status
/verify - Verify admin access
/ping - Test bot response time

*Notification Types:*
💰 Deposit notifications
💸 Withdrawal requests
📝 Task creation/completion
👤 New user registrations
✅ Admin approvals
⚠️ Error alerts

*Built by Rshiraz* 🇰🇪
    `;
    bot.sendMessage(chatId, helpMessage, { parse_mode: 'Markdown' });
});

// /ping - Test bot response
bot.onText(/\/ping/, (msg) => {
    const chatId = msg.chat.id;
    const start = Date.now();
    bot.sendMessage(chatId, '🏓 Pong!').then(() => {
        const end = Date.now();
        const latency = end - start;
        bot.sendMessage(chatId, `⏱️ Response time: ${latency}ms`);
    });
});

// /status - Check bot status
bot.onText(/\/status/, (msg) => {
    const chatId = msg.chat.id;
    const statusMessage = `
✅ *Bot Status: Online*

📅 Uptime: ${process.uptime().toFixed(0)} seconds
🤖 Bot: @${bot.botInfo?.username || 'Unknown'}
👤 Admin: ${chatId === parseInt(ADMIN_CHAT_ID) ? 'Verified ✅' : 'Not verified ⚠️'}
📡 Connection: Active

*Notifications:* Ready to send
    `;
    bot.sendMessage(chatId, statusMessage, { parse_mode: 'Markdown' });
});

// /stats - Platform statistics (mock)
bot.onText(/\/stats/, (msg) => {
    const chatId = msg.chat.id;
    const statsMessage = `
📊 *Zurifex Platform Stats*

👥 *Users:* 1,245
📝 *Tasks:* 87
✅ *Completed:* 342
💰 *Total Earnings:* $12,450.00
💸 *Total Withdrawn:* $8,230.00

*Last 24 Hours:*
📈 New Users: 12
📝 New Tasks: 5
✅ Completions: 28

*Built by Rshiraz* 🇰🇪
    `;
    bot.sendMessage(chatId, statsMessage, { parse_mode: 'Markdown' });
});

// /verify - Verify admin
bot.onText(/\/verify/, (msg) => {
    const chatId = msg.chat.id;
    if (chatId.toString() === ADMIN_CHAT_ID) {
        bot.sendMessage(chatId, '✅ *Verified Admin!* You will receive all notifications.', { parse_mode: 'Markdown' });
    } else {
        bot.sendMessage(chatId, '⚠️ *Not verified.* Only the platform admin receives notifications.', { parse_mode: 'Markdown' });
    }
});

// ============================================================
// NOTIFICATION FUNCTIONS
// ============================================================

// Send notification to admin
function sendNotification(message, parseMode = 'Markdown') {
    if (!ADMIN_CHAT_ID) {
        console.error('❌ ADMIN_CHAT_ID not set!');
        return;
    }
    try {
        bot.sendMessage(ADMIN_CHAT_ID, message, { parse_mode: parseMode });
        console.log('📤 Notification sent:', message.substring(0, 50) + '...');
    } catch (error) {
        console.error('❌ Failed to send notification:', error.message);
    }
}

// ============================================================
// NOTIFICATION TYPES
// ============================================================

// 1. New User Registration
function notifyNewUser(user) {
    const message = `
👤 *New User Registered!*

📧 *Email:* ${user.email}
👤 *Name:* ${user.full_name}
🆔 *ID:* ${user.id}
📅 *Joined:* ${new Date().toISOString().split('T')[0]}

🔑 *Role:* ${user.role || 'freelancer'}
✅ *Verified:* ${user.is_verified ? 'Yes' : 'No'}

*Built by Rshiraz* 🇰🇪
    `;
    sendNotification(message);
}

// 2. New Deposit (Manual)
function notifyDeposit(user, amount, description) {
    const message = `
💰 *New Deposit!*

👤 *User:* ${user.full_name}
📧 *Email:* ${user.email}
💵 *Amount:* $${amount.toFixed(2)}
📝 *Description:* ${description || 'Manual deposit'}

📅 *Date:* ${new Date().toISOString().split('T')[0]}

*Built by Rshiraz* 🇰🇪
    `;
    sendNotification(message);
}

// 3. New Withdrawal Request
function notifyWithdrawal(user, withdrawal) {
    const message = `
💸 *New Withdrawal Request!*

👤 *User:* ${user.full_name}
📧 *Email:* ${user.email}
💵 *Amount:* $${withdrawal.amount.toFixed(2)}
💰 *Fee:* $${withdrawal.fee.toFixed(2)}
💳 *Net:* $${withdrawal.net_amount.toFixed(2)}

📱 *Method:* ${withdrawal.payment_method}
📋 *Details:* ${withdrawal.payment_details?.contact || 'N/A'}

📅 *Requested:* ${new Date(withdrawal.created_at).toLocaleString()}

⏳ *Action Required:* Process this withdrawal in admin panel.

*Built by Rshiraz* 🇰🇪
    `;
    sendNotification(message);
}

// 4. New Task Posted
function notifyTaskPosted(task, advertisor) {
    const message = `
📝 *New Task Posted!*

📋 *Title:* ${task.title}
📂 *Category:* ${task.category}
💰 *Budget:* $${task.total_budget.toFixed(2)}
🎯 *Per Completion:* $${task.budget_per_completion.toFixed(2)}
👥 *Max Completions:* ${task.max_completions}

👤 *Advertisor:* ${advertisor.full_name}
📧 *Email:* ${advertisor.email}

📅 *Posted:* ${new Date(task.created_at).toLocaleString()}

⏳ *Status:* Pending Admin Approval

*Built by Rshiraz* 🇰🇪
    `;
    sendNotification(message);
}

// 5. Task Completion Submitted
function notifyTaskCompletion(completion, task, freelancer) {
    const message = `
✅ *New Task Completion!*

📋 *Task:* ${task.title}
👤 *Freelancer:* ${freelancer.full_name}
📧 *Email:* ${freelancer.email}
💰 *Amount:* $${completion.amount_earned.toFixed(2)}

📝 *Submission:* ${completion.submission_text || 'No submission text'}

📅 *Submitted:* ${new Date(completion.created_at).toLocaleString()}

⏳ *Action Required:* Review and approve in admin panel.

*Built by Rshiraz* 🇰🇪
    `;
    sendNotification(message);
}

// 6. Task Completion Approved
function notifyCompletionApproved(completion, task, freelancer) {
    const message = `
🎉 *Task Completion Approved!*

📋 *Task:* ${task.title}
👤 *Freelancer:* ${freelancer.full_name}
💰 *Amount Paid:* $${completion.amount_earned.toFixed(2)}

📅 *Approved:* ${new Date().toLocaleString()}

💳 *Payment Status:* Processed

*Built by Rshiraz* 🇰🇪
    `;
    sendNotification(message);
}

// 7. New User Registered (Admin Alert)
function notifyAdminUser(user) {
    const message = `
👤 *New User Registered!*

📧 *Email:* ${user.email}
👤 *Name:* ${user.full_name}
🆔 *ID:* ${user.id}
📅 *Joined:* ${new Date().toISOString().split('T')[0]}

🔑 *Role:* ${user.role || 'freelancer'}

*Built by Rshiraz* 🇰🇪
    `;
    sendNotification(message);
}

// 8. Admin Approval (Advertisor Approved)
function notifyAdvertisorApproved(user) {
    const message = `
✅ *Advertisor Approved!*

👤 *User:* ${user.full_name}
📧 *Email:* ${user.email}
📅 *Approved:* ${new Date().toLocaleString()}

🔓 *Status:* Can now post tasks

*Built by Rshiraz* 🇰🇪
    `;
    sendNotification(message);
}

// 9. Error Alert
function notifyError(error, source = 'backend') {
    const message = `
⚠️ *Error Alert!*

📍 *Source:* ${source}
❌ *Error:* ${error.message || error}

📅 *Time:* ${new Date().toLocaleString()}

📋 *Details:* ${error.stack || 'No stack trace'}

*Built by Rshiraz* 🇰🇪
    `;
    sendNotification(message);
}

// 10. Platform Health Check
function notifyHealthCheck(status) {
    const message = `
📊 *Platform Health Check*

✅ *Status:* ${status ? 'All systems operational' : '⚠️ Some issues detected'}

📅 *Checked:* ${new Date().toLocaleString()}

*Built by Rshiraz* 🇰🇪
    `;
    sendNotification(message);
}

// 11. Test Notification
function notifyTest(message = 'Test notification from Zurifex bot!') {
    const testMessage = `
🧪 *Test Notification*

📝 *Message:* ${message}

📅 *Time:* ${new Date().toLocaleString()}

✅ *Bot is working correctly!*

*Built by Rshiraz* 🇰🇪
    `;
    sendNotification(testMessage);
}

// ============================================================
// EXPOSE FUNCTIONS FOR BACKEND INTEGRATION
// ============================================================
module.exports = {
    sendNotification,
    notifyNewUser,
    notifyDeposit,
    notifyWithdrawal,
    notifyTaskPosted,
    notifyTaskCompletion,
    notifyCompletionApproved,
    notifyAdminUser,
    notifyAdvertisorApproved,
    notifyError,
    notifyHealthCheck,
    notifyTest,
    bot
};

// ============================================================
// STARTUP LOG
// ============================================================
console.log('');
console.log('🤖 Bot commands registered:');
console.log('  /start  - Welcome message');
console.log('  /help   - Help menu');
console.log('  /stats  - Platform statistics');
console.log('  /status - Bot status');
console.log('  /verify - Verify admin');
console.log('  /ping   - Test response');
console.log('');
console.log('✅ Bot is ready! Notifications will be sent to admin.');
console.log(`📨 Admin Chat ID: ${ADMIN_CHAT_ID}`);
console.log('');
console.log('🎯 Commands you can use:');
console.log('  Send /start to your bot to test');
console.log('  Send /ping to test response time');
console.log('  Send /status to check bot status');
console.log('');
console.log('📤 To test notifications, open a new CMD and run:');
console.log('  node -e "const bot = require(\'./bot\'); bot.notifyTest(\'Hello from Zurifex!\');"');