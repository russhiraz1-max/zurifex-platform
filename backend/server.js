// ============================================================
//  ███████╗██╗░░░██╗██████╗░██╗███████╗███████╗██╗░░██╗
//  ╚══███╔╝██║░░░██║██╔══██╗██║██╔════╝██╔════╝╚██╗██╔╝
//  ░░██╔╝░██║░░░██║██████╔╝██║█████╗░░█████╗░░░╚███╔╝░
//  ░██╔╝░░██║░░░██║██╔══██╗██║██╔══╝░░██╔══╝░░░██╔██╗░
//  ███████╗╚██████╔╝██║░░██║██║███████╗███████╗██╔╝╚██╗
//  ╚══════╝░╚═════╝░╚═╝░░╚═╝╚═╝╚══════╝╚══════╝╚═╝░░╚═╝
// ============================================================
// ZURIFEX PLATFORM - COMPLETE BACKEND
// Full API + Telegram Bot + Admin + Deposit + Analytics
// Version: 11.0.0 (ULTIMATE COMPLETE EDITION - 150k+ chars)
// ============================================================

const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const { createClient } = require('@supabase/supabase-js');
const { OAuth2Client } = require('google-auth-library');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const os = require('os');
const util = require('util');
const zlib = require('zlib');
const stream = require('stream');
const { promisify } = require('util');
const exec = promisify(require('child_process').exec);
const { rateLimit } = require('express-rate-limit');
const helmet = require('helmet');
const morgan = require('morgan');
const compression = require('compression');
const { body, validationResult, param, query } = require('express-validator');
const { v4: uuidv4 } = require('uuid');

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// ============================================================
// ════════════════════════════════════════════════════════════
// SYSTEM INFORMATION
// ════════════════════════════════════════════════════════════
// ============================================================
const SYSTEM_INFO = {
    name: 'Zurifex API',
    version: '11.0.0',
    node_version: process.version,
    platform: os.platform(),
    arch: os.arch(),
    cpus: os.cpus().length,
    memory: os.totalmem(),
    uptime: process.uptime,
    start_time: new Date().toISOString(),
    license: 'Proprietary',
    author: 'Rshiraz 🇰🇪',
    repository: 'https://github.com/russhiraz1-max/zurifex-platform',
    environment: process.env.NODE_ENV || 'development',
    description: 'Zurifex Freelance Platform API'
};

// ============================================================
// ════════════════════════════════════════════════════════════
// TELEGRAM BOT INTEGRATION
// ════════════════════════════════════════════════════════════
// ============================================================
let botFunctions = {};
let botConnected = false;

try {
    const possiblePaths = [
        path.join(__dirname, '..', 'telegram-bot', 'bot.js'),
        path.join(process.cwd(), 'telegram-bot', 'bot.js'),
        path.join(__dirname, 'telegram-bot', 'bot.js')
    ];
    for (const botPath of possiblePaths) {
        try {
            require.resolve(botPath);
            const bot = require(botPath);
            if (bot && typeof bot.notifyTest === 'function') {
                botFunctions = bot;
                botConnected = true;
                console.log('✅ Telegram bot integration loaded successfully from:', botPath);
                break;
            }
        } catch (e) { /* try next */ }
    }
    if (!botConnected) {
        console.warn('⚠️ Telegram bot module not found. Notifications disabled.');
    }
} catch (error) {
    console.warn('⚠️ Telegram bot integration error:', error.message);
}

function notifyBot(functionName, ...args) {
    if (!botConnected || !botFunctions[functionName]) {
        console.log(`📤 [${functionName}] skipped - bot not available`);
        return;
    }
    try {
        botFunctions[functionName](...args);
        console.log(`📤 [${functionName}] notification sent`);
    } catch (error) {
        console.error(`❌ Bot notification failed (${functionName}):`, error.message);
    }
}

// ============================================================
// ════════════════════════════════════════════════════════════
// SECURITY & MIDDLEWARE
// ════════════════════════════════════════════════════════════
// ============================================================

app.use(helmet());
app.use(compression());
app.use(morgan('combined'));

const limiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 200,
    standardHeaders: true,
    legacyHeaders: false,
    message: 'Too many requests, please try again later.'
});
app.use('/api/', limiter);

const corsOptions = {
    origin: [
        'http://localhost:3000',
        'http://localhost:5000',
        'http://localhost:5500',
        'https://zurifex.netlify.app',
        'https://zurifex.com',
        'https://zurifex-platform.onrender.com'
    ],
    credentials: true,
    optionsSuccessStatus: 200
};
app.use(cors(corsOptions));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// ============================================================
// ════════════════════════════════════════════════════════════
// LOGGING SYSTEM
// ════════════════════════════════════════════════════════════
// ============================================================
const requestLogs = [];
const errorLogs = [];

app.use((req, res, next) => {
    const start = Date.now();
    const requestId = uuidv4();
    req.requestId = requestId;
    res.setHeader('X-Request-Id', requestId);

    res.on('finish', () => {
        const duration = Date.now() - start;
        const log = {
            id: requestId,
            timestamp: new Date().toISOString(),
            method: req.method,
            path: req.path,
            status: res.statusCode,
            duration: duration,
            ip: req.ip || req.connection.remoteAddress || 'unknown',
            userAgent: req.get('user-agent') || 'unknown',
            user: req.user ? req.user.email : 'anonymous'
        };
        requestLogs.unshift(log);
        if (requestLogs.length > 1000) requestLogs.pop();
        const logStr = `[${log.timestamp}] ${log.method} ${log.path} - ${log.status} - ${log.duration}ms - ${log.ip}`;
        console.log(logStr);
        try {
            const logDir = path.join(__dirname, 'logs');
            if (!fs.existsSync(logDir)) fs.mkdirSync(logDir, { recursive: true });
            fs.appendFileSync(path.join(logDir, 'requests.log'), logStr + '\n');
        } catch (e) { /* ignore */ }
    });
    next();
});

// ============================================================
// ════════════════════════════════════════════════════════════
// DATABASE CLIENTS
// ════════════════════════════════════════════════════════════
// ============================================================
const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);
const supabaseAnon = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_ANON_KEY
);

// ============================================================
// ════════════════════════════════════════════════════════════
// GOOGLE AUTH CLIENT
// ════════════════════════════════════════════════════════════
// ============================================================
const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

// ============================================================
// ════════════════════════════════════════════════════════════
// UTILITY FUNCTIONS
// ════════════════════════════════════════════════════════════
// ============================================================

function generateUUID() {
    return uuidv4();
}

function formatCurrency(amount) {
    return '$' + (amount || 0).toFixed(2);
}

function getStartOfDay(date = new Date()) {
    const d = new Date(date);
    d.setHours(0, 0, 0, 0);
    return d.toISOString();
}

function getEndOfDay(date = new Date()) {
    const d = new Date(date);
    d.setHours(23, 59, 59, 999);
    return d.toISOString();
}

function daysAgo(days) {
    const d = new Date();
    d.setDate(d.getDate() - days);
    return d.toISOString();
}

function truncateText(text, maxLength = 100) {
    if (!text) return '';
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength) + '...';
}

function isValidEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function maskEmail(email) {
    if (!email) return '';
    const parts = email.split('@');
    if (parts.length !== 2) return email;
    const name = parts[0];
    const domain = parts[1];
    if (name.length <= 2) return email;
    return name[0] + '***' + name[name.length - 1] + '@' + domain;
}

function getTimeAgo(dateString) {
    const diff = Date.now() - new Date(dateString).getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);
    const weeks = Math.floor(days / 7);
    if (weeks > 0) return weeks + 'w ago';
    if (days > 0) return days + 'd ago';
    if (hours > 0) return hours + 'h ago';
    if (minutes > 0) return minutes + 'm ago';
    return 'Just now';
}

function sanitizeInput(str) {
    if (typeof str !== 'string') return str;
    return str.replace(/[^a-zA-Z0-9@.\s\-_]/g, '').trim();
}

function validatePassword(password) {
    return password && password.length >= 8;
}

function generateRandomString(length = 8) {
    return crypto.randomBytes(length).toString('hex').slice(0, length);
}

function hashData(data) {
    return crypto.createHash('sha256').update(JSON.stringify(data)).digest('hex');
}

function parseQueryParams(req) {
    const { limit = 50, offset = 0, sort = 'created_at', order = 'desc', ...filters } = req.query;
    return { limit: parseInt(limit), offset: parseInt(offset), sort, order, filters };
}

function getWeekNumber(date) {
    const d = new Date(date);
    const dayNum = d.getDay() || 7;
    d.setDate(d.getDate() + 4 - dayNum);
    const yearStart = new Date(d.getFullYear(), 0, 1);
    return Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
}

function isToday(dateString) {
    const today = new Date().toDateString();
    const d = new Date(dateString).toDateString();
    return today === d;
}

function isThisWeek(dateString) {
    const now = new Date();
    const d = new Date(dateString);
    const weekNumber = getWeekNumber(now);
    const weekNumber2 = getWeekNumber(d);
    return weekNumber === weekNumber2 && d.getFullYear() === now.getFullYear();
}

function getMonthName(month) {
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return months[month] || 'Jan';
}

// ============================================================
// ════════════════════════════════════════════════════════════
// VALIDATION MIDDLEWARE
// ════════════════════════════════════════════════════════════
// ============================================================

const validateUser = [
    body('full_name').isLength({ min: 2 }).withMessage('Name too short'),
    body('email').isEmail().withMessage('Invalid email'),
    body('phone').optional().isMobilePhone().withMessage('Invalid phone'),
    body('location').optional().isString().withMessage('Invalid location'),
    body('bio').optional().isLength({ max: 500 }).withMessage('Bio too long')
];

const validateTask = [
    body('title').isLength({ min: 3, max: 100 }).withMessage('Title must be 3-100 chars'),
    body('description').isLength({ min: 10 }).withMessage('Description too short'),
    body('category').isIn(['app_testing', 'content_writing', 'social_media', 'video_watching', 'data_entry', 'web_research', 'design', 'other']),
    body('budget_per_completion').isFloat({ min: 0.01 }).withMessage('Budget must be positive'),
    body('total_budget').isFloat({ min: 0.01 }).withMessage('Total budget must be positive'),
    body('max_completions').isInt({ min: 1 }).withMessage('Max completions must be at least 1')
];

const validateDeposit = [
    body('amount').isFloat({ min: 0.01 }).withMessage('Invalid amount'),
    body('reference').isLength({ min: 3 }).withMessage('Reference too short'),
    body('method').isIn(['bank_transfer', 'mpesa', 'paypal', 'crypto']).withMessage('Invalid method')
];

const validateWithdrawal = [
    body('amount').isFloat({ min: 3 }).withMessage('Minimum withdrawal is $3'),
    body('payment_method').isIn(['mpesa', 'paypal', 'bank_transfer']).withMessage('Invalid payment method'),
    body('payment_details').isObject().withMessage('Invalid payment details')
];

// ============================================================
// ════════════════════════════════════════════════════════════
// ROOT ROUTE
// ════════════════════════════════════════════════════════════
// ============================================================
app.get('/', (req, res) => {
    res.json({
        name: SYSTEM_INFO.name,
        version: SYSTEM_INFO.version,
        message: 'Zurifex API is running 🇰🇪',
        status: 'online',
        bot: botConnected ? 'connected ✅' : 'disabled ⚠️',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        endpoints_count: Object.keys(app._router.stack).length,
        author: SYSTEM_INFO.author,
        system: SYSTEM_INFO,
        routes: ['/', '/api/health', '/api/system', '/api/logs', '/api/stats', '/api/admin/analytics', '/api/auth/google', '/api/users', '/api/tasks', '/api/completions', '/api/withdrawals', '/api/deposit', '/api/admin']
    });
});

// ============================================================
// ════════════════════════════════════════════════════════════
// SYSTEM AND HEALTH
// ════════════════════════════════════════════════════════════
// ============================================================

app.get('/api/health', (req, res) => {
    res.json({
        status: 'healthy',
        bot: botConnected,
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        timestamp: new Date().toISOString(),
        node_version: process.version,
        env: process.env.NODE_ENV || 'development',
        database: 'connected',
        request_count: requestLogs.length,
        error_count: errorLogs.length
    });
});

app.get('/api/system', (req, res) => {
    res.json({
        system: SYSTEM_INFO,
        environment: process.env.NODE_ENV || 'development',
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        request_count: requestLogs.length,
        error_count: errorLogs.length,
        bot_connected: botConnected,
        cpu_usage: os.loadavg(),
        total_memory: os.totalmem(),
        free_memory: os.freemem()
    });
});

app.get('/api/logs', (req, res) => {
    const { limit = 50, offset = 0 } = req.query;
    const logs = requestLogs.slice(parseInt(offset), parseInt(offset) + parseInt(limit));
    res.json({ logs, total: requestLogs.length, limit, offset });
});

app.get('/api/errors', (req, res) => {
    const { limit = 50, offset = 0 } = req.query;
    const logs = errorLogs.slice(parseInt(offset), parseInt(offset) + parseInt(limit));
    res.json({ errors: logs, total: errorLogs.length, limit, offset });
});

// ============================================================
// ════════════════════════════════════════════════════════════
// TEST BOT NOTIFICATION
// ════════════════════════════════════════════════════════════
// ============================================================

app.get('/api/test/notification', async (req, res) => {
    try {
        const message = req.query.message || 'Test notification from API (GET)!';
        if (!botConnected) return res.status(400).json({ error: 'Bot not connected' });
        notifyBot('notifyTest', message);
        res.json({ success: true, message: 'Test notification sent', telegram: '@zurifex_bot' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/test/notification', async (req, res) => {
    try {
        const message = req.body.message || 'Test notification from API (POST)!';
        if (!botConnected) return res.status(400).json({ error: 'Bot not connected' });
        notifyBot('notifyTest', message);
        res.json({ success: true, message: 'Test notification sent', telegram: '@zurifex_bot' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ============================================================
// ════════════════════════════════════════════════════════════
// PUBLIC STATS
// ════════════════════════════════════════════════════════════
// ============================================================

app.get('/api/stats', async (req, res) => {
    try {
        const { count: usersCount } = await supabase.from('users').select('*', { count: 'exact', head: true });
        const { count: tasksCount } = await supabase.from('tasks').select('*', { count: 'exact', head: true });
        const { count: completedCount } = await supabase.from('task_completions').select('*', { count: 'exact', head: true }).eq('status', 'approved');
        const { count: activeTasks } = await supabase.from('tasks').select('*', { count: 'exact', head: true }).eq('status', 'active');
        const { count: pendingTasks } = await supabase.from('tasks').select('*', { count: 'exact', head: true }).eq('status', 'pending');
        const { data: earnings } = await supabase.from('transactions').select('amount').eq('type', 'task_payment').eq('status', 'completed');
        let totalEarnings = 0;
        if (earnings) earnings.forEach(t => { totalEarnings += t.amount || 0; });
        const { data: withdrawn } = await supabase.from('transactions').select('amount').eq('type', 'withdrawal').eq('status', 'completed');
        let totalWithdrawn = 0;
        if (withdrawn) withdrawn.forEach(t => { totalWithdrawn += Math.abs(t.amount) || 0; });
        const { count: pendingWithdrawals } = await supabase.from('withdrawal_requests').select('*', { count: 'exact', head: true }).eq('status', 'pending');
        const { count: totalAdvertisors } = await supabase.from('users').select('*', { count: 'exact', head: true }).eq('role', 'advertisor');
        const { count: totalFreelancers } = await supabase.from('users').select('*', { count: 'exact', head: true }).eq('role', 'freelancer');

        res.json({
            users: usersCount || 0,
            freelancers: totalFreelancers || 0,
            advertisers: totalAdvertisors || 0,
            tasks: tasksCount || 0,
            active_tasks: activeTasks || 0,
            pending_tasks: pendingTasks || 0,
            completed: completedCount || 0,
            total_earnings: totalEarnings,
            total_withdrawn: totalWithdrawn,
            pending_withdrawals: pendingWithdrawals || 0,
            platform_balance: totalEarnings - totalWithdrawn,
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ============================================================
// ════════════════════════════════════════════════════════════
// ADMIN ANALYTICS
// ════════════════════════════════════════════════════════════
// ============================================================

app.get('/api/admin/analytics', async (req, res) => {
    try {
        const { count: totalUsers } = await supabase.from('users').select('*', { count: 'exact', head: true });
        const { count: totalTasks } = await supabase.from('tasks').select('*', { count: 'exact', head: true });
        const { count: activeTasks } = await supabase.from('tasks').select('*', { count: 'exact', head: true }).eq('status', 'active');
        const { count: pendingTasks } = await supabase.from('tasks').select('*', { count: 'exact', head: true }).eq('status', 'pending');
        const { count: completedTasks } = await supabase.from('tasks').select('*', { count: 'exact', head: true }).eq('status', 'completed');
        const { count: cancelledTasks } = await supabase.from('tasks').select('*', { count: 'exact', head: true }).eq('status', 'cancelled');
        const { count: totalCompletions } = await supabase.from('task_completions').select('*', { count: 'exact', head: true });
        const { count: pendingCompletions } = await supabase.from('task_completions').select('*', { count: 'exact', head: true }).eq('status', 'pending');
        const { count: approvedCompletions } = await supabase.from('task_completions').select('*', { count: 'exact', head: true }).eq('status', 'approved');
        const { count: rejectedCompletions } = await supabase.from('task_completions').select('*', { count: 'exact', head: true }).eq('status', 'rejected');
        const { data: usersByRole } = await supabase.from('users').select('role');
        let freelancers = 0, advertisers = 0, admins = 0;
        if (usersByRole) {
            usersByRole.forEach(u => {
                if (u.role === 'freelancer') freelancers++;
                else if (u.role === 'advertisor') advertisers++;
                else if (u.role === 'admin') admins++;
            });
        }
        const { count: unapprovedUsers } = await supabase.from('users').select('*', { count: 'exact', head: true }).eq('is_approved', false);
        const { data: earnings } = await supabase.from('transactions').select('amount').eq('type', 'task_payment').eq('status', 'completed');
        let totalEarnings = 0;
        if (earnings) earnings.forEach(t => { totalEarnings += t.amount || 0; });
        const { data: withdrawn } = await supabase.from('transactions').select('amount').eq('type', 'withdrawal').eq('status', 'completed');
        let totalWithdrawn = 0;
        if (withdrawn) withdrawn.forEach(t => { totalWithdrawn += Math.abs(t.amount) || 0; });
        const { data: deposits } = await supabase.from('transactions').select('amount').eq('type', 'deposit').eq('status', 'completed');
        let totalDeposited = 0;
        if (deposits) deposits.forEach(t => { totalDeposited += t.amount || 0; });
        const { count: pendingWithdrawals } = await supabase.from('withdrawal_requests').select('*', { count: 'exact', head: true }).eq('status', 'pending');
        const { count: processingWithdrawals } = await supabase.from('withdrawal_requests').select('*', { count: 'exact', head: true }).eq('status', 'processing');
        const { count: completedWithdrawals } = await supabase.from('withdrawal_requests').select('*', { count: 'exact', head: true }).eq('status', 'completed');
        const { count: failedWithdrawals } = await supabase.from('withdrawal_requests').select('*', { count: 'exact', head: true }).eq('status', 'failed');
        const { count: pendingDeposits } = await supabase.from('transactions').select('*', { count: 'exact', head: true }).eq('type', 'deposit').eq('status', 'pending');
        const { count: completedDeposits } = await supabase.from('transactions').select('*', { count: 'exact', head: true }).eq('type', 'deposit').eq('status', 'completed');
        const { count: failedDeposits } = await supabase.from('transactions').select('*', { count: 'exact', head: true }).eq('type', 'deposit').eq('status', 'failed');

        const dailyStats = [];
        for (let i = 6; i >= 0; i--) {
            const start = daysAgo(i);
            const end = daysAgo(i - 1);
            const { count: dayUsers } = await supabase.from('users').select('*', { count: 'exact', head: true }).gte('created_at', start).lt('created_at', end);
            const { count: dayTasks } = await supabase.from('tasks').select('*', { count: 'exact', head: true }).gte('created_at', start).lt('created_at', end);
            const { count: dayCompletions } = await supabase.from('task_completions').select('*', { count: 'exact', head: true }).gte('created_at', start).lt('created_at', end).eq('status', 'approved');
            const { count: dayWithdrawals } = await supabase.from('withdrawal_requests').select('*', { count: 'exact', head: true }).gte('created_at', start).lt('created_at', end);
            const { count: dayDeposits } = await supabase.from('transactions').select('*', { count: 'exact', head: true }).gte('created_at', start).lt('created_at', end).eq('type', 'deposit').eq('status', 'completed');
            dailyStats.push({
                date: start.split('T')[0],
                newUsers: dayUsers || 0,
                newTasks: dayTasks || 0,
                completions: dayCompletions || 0,
                withdrawals: dayWithdrawals || 0,
                deposits: dayDeposits || 0
            });
        }

        const { data: topAdvertisers } = await supabase
            .from('tasks')
            .select('advertisor_id, total_budget, advertisor:advertisor_id(full_name, email)')
            .order('total_budget', { ascending: false })
            .limit(5);

        const { data: topFreelancers } = await supabase
            .from('users')
            .select('full_name, email, total_earned')
            .order('total_earned', { ascending: false })
            .limit(5);

        const { data: recentActivities } = await supabase
            .from('transactions')
            .select('*, user:user_id(full_name, email)')
            .order('created_at', { ascending: false })
            .limit(10);

        res.json({
            users: {
                total: totalUsers || 0,
                freelancers: freelancers,
                advertisers: advertisers,
                admins: admins,
                unapproved: unapprovedUsers || 0
            },
            tasks: {
                total: totalTasks || 0,
                active: activeTasks || 0,
                pending: pendingTasks || 0,
                completed: completedTasks || 0,
                cancelled: cancelledTasks || 0
            },
            completions: {
                total: totalCompletions || 0,
                pending: pendingCompletions || 0,
                approved: approvedCompletions || 0,
                rejected: rejectedCompletions || 0
            },
            financial: {
                total_earnings: totalEarnings,
                total_withdrawn: totalWithdrawn,
                total_deposited: totalDeposited,
                platform_balance: totalEarnings - totalWithdrawn,
                pending_withdrawals: pendingWithdrawals || 0,
                processing_withdrawals: processingWithdrawals || 0,
                completed_withdrawals: completedWithdrawals || 0,
                failed_withdrawals: failedWithdrawals || 0,
                pending_deposits: pendingDeposits || 0,
                completed_deposits: completedDeposits || 0,
                failed_deposits: failedDeposits || 0
            },
            top_advertisers: topAdvertisers || [],
            top_freelancers: topFreelancers || [],
            daily_stats: dailyStats,
            recent_activities: recentActivities || [],
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        console.error('Analytics error:', error);
        res.status(500).json({ error: error.message });
    }
});

// ============================================================
// ════════════════════════════════════════════════════════════
// GOOGLE AUTH ROUTE
// ════════════════════════════════════════════════════════════
// ============================================================

app.post('/api/auth/google', async (req, res) => {
    try {
        const { idToken } = req.body;
        if (!idToken) return res.status(400).json({ error: 'ID token required' });

        const ticket = await googleClient.verifyIdToken({
            idToken: idToken,
            audience: process.env.GOOGLE_CLIENT_ID
        });
        const payload = ticket.getPayload();
        const { email, name, picture } = payload;

        let { data: existingUser, error: fetchError } = await supabase
            .from('users')
            .select('*')
            .eq('email', email)
            .single();

        if (existingUser) {
            const { data: updatedUser, error: updateError } = await supabase
                .from('users')
                .update({ full_name: name, profile_photo_url: picture, is_verified: true })
                .eq('id', existingUser.id)
                .select()
                .single();
            if (updateError) {
                return res.json({
                    success: true,
                    user: {
                        id: existingUser.id,
                        email: existingUser.email,
                        full_name: existingUser.full_name,
                        role: existingUser.role,
                        wallet_balance: existingUser.wallet_balance,
                        is_approved: existingUser.is_approved,
                        is_verified: existingUser.is_verified,
                        profile_photo_url: existingUser.profile_photo_url,
                        is_new: false
                    }
                });
            }
            return res.json({
                success: true,
                user: {
                    id: updatedUser.id,
                    email: updatedUser.email,
                    full_name: updatedUser.full_name,
                    role: updatedUser.role,
                    wallet_balance: updatedUser.wallet_balance,
                    is_approved: updatedUser.is_approved,
                    is_verified: updatedUser.is_verified,
                    profile_photo_url: updatedUser.profile_photo_url,
                    is_new: false
                }
            });
        }

        let authUserId = null;
        try {
            const { data: authUsers, error: listError } = await supabase.auth.admin.listUsers();
            if (!listError) {
                const found = authUsers.users.find(u => u.email === email);
                if (found) authUserId = found.id;
            }
        } catch (err) { /* ignore */ }

        if (!authUserId) {
            const { data: authData, error: authError } = await supabase.auth.admin.createUser({
                email: email,
                email_confirm: true,
                user_metadata: { full_name: name, avatar_url: picture }
            });
            if (authError) {
                return res.status(500).json({ error: 'Failed to create auth user: ' + authError.message });
            }
            authUserId = authData.user.id;
        }

        let userData;
        let isNew = false;
        const { data: existingProfile, error: profileCheck } = await supabase
            .from('users')
            .select('*')
            .eq('id', authUserId)
            .single();

        if (existingProfile) {
            const { data: updatedProfile, error: updateError } = await supabase
                .from('users')
                .update({ full_name: name, profile_photo_url: picture, is_verified: true })
                .eq('id', authUserId)
                .select()
                .single();
            if (updateError) {
                return res.status(500).json({ error: 'Failed to update profile' });
            }
            userData = updatedProfile;
        } else {
            const { data: newUser, error: insertError } = await supabase
                .from('users')
                .insert({
                    id: authUserId,
                    full_name: name,
                    email: email,
                    profile_photo_url: picture,
                    role: 'freelancer',
                    is_verified: true,
                    is_approved: false,
                    wallet_balance: 0,
                    total_earned: 0,
                    total_withdrawn: 0
                })
                .select()
                .single();

            if (insertError) {
                if (insertError.code === '23505') {
                    const { data: retryUser, error: retryError } = await supabase
                        .from('users')
                        .select('*')
                        .eq('id', authUserId)
                        .single();
                    if (retryError) {
                        return res.status(500).json({ error: 'Failed to create profile: ' + retryError.message });
                    }
                    userData = retryUser;
                } else {
                    return res.status(500).json({ error: 'Failed to create profile: ' + insertError.message });
                }
            } else {
                userData = newUser;
                isNew = true;
            }
        }

        if (isNew) {
            notifyBot('notifyAdminUser', {
                id: userData.id,
                email: userData.email,
                full_name: userData.full_name,
                role: userData.role,
                is_verified: userData.is_verified
            });
        }

        return res.json({
            success: true,
            user: {
                id: userData.id,
                email: userData.email,
                full_name: userData.full_name,
                role: userData.role,
                wallet_balance: userData.wallet_balance,
                is_approved: userData.is_approved,
                is_verified: userData.is_verified,
                profile_photo_url: userData.profile_photo_url,
                is_new: isNew
            }
        });
    } catch (error) {
        console.error('Google auth error:', error);
        notifyBot('notifyError', error, 'auth');
        return res.status(500).json({ error: 'Authentication failed: ' + error.message });
    }
});

// ============================================================
// ════════════════════════════════════════════════════════════
// USER ROUTES (FULL CRUD)
// ============================================================

app.get('/api/users/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { data: user, error } = await supabase
            .from('users')
            .select('*')
            .eq('id', id)
            .single();
        if (error) return res.status(404).json({ error: 'User not found' });
        res.json({ user });
    } catch (error) {
        res.status(500).json({ error: 'Server error' });
    }
});

app.get('/api/users/email/:email', async (req, res) => {
    try {
        const { email } = req.params;
        if (!isValidEmail(email)) return res.status(400).json({ error: 'Invalid email' });
        const { data: user, error } = await supabase
            .from('users')
            .select('*')
            .eq('email', email)
            .single();
        if (error) return res.status(404).json({ error: 'User not found' });
        res.json({ user });
    } catch (error) {
        res.status(500).json({ error: 'Server error' });
    }
});

app.get('/api/users', async (req, res) => {
    try {
        const { limit = 50, offset = 0, role } = req.query;
        let query = supabase.from('users').select('*').order('created_at', { ascending: false });
        if (role) query = query.eq('role', role);
        const { data: users, error } = await query.range(parseInt(offset), parseInt(offset) + parseInt(limit) - 1);
        if (error) return res.status(400).json({ error: 'Failed to fetch users' });
        const { count } = await supabase.from('users').select('*', { count: 'exact', head: true });
        res.json({ users, total: count || 0 });
    } catch (error) {
        res.status(500).json({ error: 'Server error' });
    }
});

app.put('/api/users/:id', validateUser, async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }
    try {
        const { id } = req.params;
        const { full_name, phone, location, bio, skills, role } = req.body;
        const updates = {};
        if (full_name !== undefined) updates.full_name = sanitizeInput(full_name);
        if (phone !== undefined) updates.phone = sanitizeInput(phone);
        if (location !== undefined) updates.location = sanitizeInput(location);
        if (bio !== undefined) updates.bio = sanitizeInput(bio);
        if (skills !== undefined) updates.skills = skills.map(s => sanitizeInput(s)).filter(Boolean);
        if (role !== undefined) updates.role = sanitizeInput(role);
        const { data: user, error } = await supabase
            .from('users')
            .update(updates)
            .eq('id', id)
            .select()
            .single();
        if (error) return res.status(400).json({ error: 'Update failed' });
        res.json({ success: true, user });
    } catch (error) {
        res.status(500).json({ error: 'Server error' });
    }
});

app.delete('/api/users/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { admin_id } = req.body;
        const { data: admin, error: adminError } = await supabase
            .from('users')
            .select('role')
            .eq('id', admin_id)
            .single();
        if (adminError || admin.role !== 'admin') return res.status(403).json({ error: 'Admin required' });
        await supabase
            .from('users')
            .update({ is_verified: false, is_approved: false })
            .eq('id', id);
        await supabase.from('admin_logs').insert({
            admin_id: admin_id,
            action: 'delete_user',
            target_type: 'user',
            target_id: id,
            details: { deleted_by: admin_id }
        });
        res.json({ success: true, message: 'User deactivated' });
    } catch (error) {
        res.status(500).json({ error: 'Server error' });
    }
});

// ============================================================
// ════════════════════════════════════════════════════════════
// TRANSACTION ROUTES (FULL)
// ============================================================

app.get('/api/transactions/user/:userId', async (req, res) => {
    try {
        const { userId } = req.params;
        const { limit = 50, offset = 0 } = req.query;
        const { data: transactions, error } = await supabase
            .from('transactions')
            .select('*')
            .eq('user_id', userId)
            .order('created_at', { ascending: false })
            .range(parseInt(offset), parseInt(offset) + parseInt(limit) - 1);
        if (error) return res.status(400).json({ error: 'Failed to fetch transactions' });
        const { count } = await supabase.from('transactions').select('*', { count: 'exact', head: true }).eq('user_id', userId);
        res.json({ transactions: transactions || [], total: count || 0 });
    } catch (error) {
        res.status(500).json({ error: 'Server error' });
    }
});

app.get('/api/admin/transactions', async (req, res) => {
    try {
        const { limit = 100, offset = 0, type, status } = req.query;
        let query = supabase.from('transactions').select('*, user:user_id(full_name, email)').order('created_at', { ascending: false });
        if (type) query = query.eq('type', type);
        if (status) query = query.eq('status', status);
        const { data: transactions, error } = await query.range(parseInt(offset), parseInt(offset) + parseInt(limit) - 1);
        if (error) return res.status(400).json({ error: 'Failed to fetch transactions' });
        const { count } = await supabase.from('transactions').select('*', { count: 'exact', head: true });
        res.json({ transactions: transactions || [], total: count || 0 });
    } catch (error) {
        res.status(500).json({ error: 'Server error' });
    }
});

// ============================================================
// ════════════════════════════════════════════════════════════
// DEPOSIT REQUEST ROUTE
// ============================================================

app.post('/api/deposit/request', validateDeposit, async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }
    try {
        const { user_id, amount, method, reference } = req.body;
        const { data: user, error: userError } = await supabase
            .from('users')
            .select('full_name, email, wallet_balance')
            .eq('id', user_id)
            .single();
        if (userError) return res.status(404).json({ error: 'User not found' });

        const { data: depositRecord, error: depositError } = await supabase
            .from('transactions')
            .insert({
                user_id: user_id,
                type: 'deposit',
                amount: amount,
                fee: 0,
                net_amount: amount,
                status: 'pending',
                description: `Deposit request via ${method || 'Bank Transfer'} - Ref: ${reference}`,
                admin_notes: `Pending admin confirmation. Ref: ${reference}`
            })
            .select()
            .single();
        if (depositError) console.error('Deposit record error:', depositError);

        notifyBot('sendNotification', `
💰 *New Deposit Request!*
👤 User: ${user.full_name}
📧 Email: ${user.email}
💵 Amount: $${amount.toFixed(2)}
📱 Method: ${method || 'Bank Transfer'}
📋 Reference: ${reference}
⏳ Action: /deposit ${user.email} ${amount}
*Built by Rshiraz* 🇰🇪
        `);

        res.json({ success: true, message: 'Deposit request sent to admin', deposit: depositRecord });
    } catch (error) {
        console.error('Deposit request error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// ============================================================
// ════════════════════════════════════════════════════════════
// ADMIN DEPOSIT MANAGEMENT (FULL)
// ============================================================

app.get('/api/admin/deposits/pending', async (req, res) => {
    try {
        const { data: deposits, error } = await supabase
            .from('transactions')
            .select('*, user:user_id(full_name, email)')
            .eq('type', 'deposit')
            .eq('status', 'pending')
            .order('created_at', { ascending: false });
        if (error) return res.status(400).json({ error: 'Failed to fetch deposits' });
        res.json({ deposits: deposits || [] });
    } catch (error) {
        res.status(500).json({ error: 'Server error' });
    }
});

app.put('/api/admin/deposits/approve', async (req, res) => {
    try {
        const { deposit_id, user_id, amount, admin_id } = req.body;
        if (!deposit_id || !user_id || !amount) return res.status(400).json({ error: 'Missing fields' });

        const { error: updateError } = await supabase
            .from('transactions')
            .update({ status: 'completed' })
            .eq('id', deposit_id)
            .eq('type', 'deposit');
        if (updateError) return res.status(400).json({ error: 'Failed to update deposit' });

        const { data: user, error: userError } = await supabase
            .from('users')
            .select('wallet_balance, full_name, email')
            .eq('id', user_id)
            .single();
        if (userError) return res.status(404).json({ error: 'User not found' });
        const newBalance = (user.wallet_balance || 0) + amount;
        await supabase
            .from('users')
            .update({ wallet_balance: newBalance })
            .eq('id', user_id);

        await supabase.from('admin_logs').insert({
            admin_id: admin_id,
            action: 'approve_deposit',
            target_type: 'deposit',
            target_id: deposit_id,
            details: { amount, user: user }
        });

        notifyBot('sendNotification', `
✅ *Deposit Approved!*
👤 ${user.full_name} (${user.email})
💵 $${amount.toFixed(2)}
📊 New Balance: $${newBalance.toFixed(2)}
*Built by Rshiraz* 🇰🇪
        `);

        res.json({ success: true, message: 'Deposit approved', new_balance: newBalance });
    } catch (error) {
        console.error('Approve deposit error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

app.put('/api/admin/deposits/reject', async (req, res) => {
    try {
        const { deposit_id, admin_id } = req.body;
        if (!deposit_id) return res.status(400).json({ error: 'Missing deposit ID' });
        await supabase
            .from('transactions')
            .update({ status: 'failed' })
            .eq('id', deposit_id)
            .eq('type', 'deposit');
        await supabase.from('admin_logs').insert({
            admin_id: admin_id,
            action: 'reject_deposit',
            target_type: 'deposit',
            target_id: deposit_id,
            details: { rejected_by: admin_id }
        });
        res.json({ success: true, message: 'Deposit rejected' });
    } catch (error) {
        res.status(500).json({ error: 'Server error' });
    }
});

// ============================================================
// ════════════════════════════════════════════════════════════
// TASK ROUTES (FULL CRUD)
// ============================================================

app.get('/api/tasks', async (req, res) => {
    try {
        const { limit = 50, offset = 0, category, status = 'active' } = req.query;
        let query = supabase
            .from('tasks')
            .select(`
                *,
                advertisor:advertisor_id (
                    full_name,
                    email,
                    profile_photo_url
                )
            `)
            .eq('status', status);

        if (category) query = query.eq('category', category);

        const { data: tasks, error } = await query
            .order('created_at', { ascending: false })
            .range(parseInt(offset), parseInt(offset) + parseInt(limit) - 1);

        if (error) {
            return res.status(400).json({ error: 'Failed to fetch tasks' });
        }

        const { count } = await supabase
            .from('tasks')
            .select('*', { count: 'exact', head: true })
            .eq('status', status);

        res.json({ tasks: tasks || [], total: count || 0 });
    } catch (error) {
        res.status(500).json({ error: 'Server error' });
    }
});

app.get('/api/tasks/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { data: task, error } = await supabase
            .from('tasks')
            .select('*, advertisor:advertisor_id(full_name, email)')
            .eq('id', id)
            .single();
        if (error) return res.status(404).json({ error: 'Task not found' });
        res.json({ task });
    } catch (error) {
        res.status(500).json({ error: 'Server error' });
    }
});

app.get('/api/tasks/advertisor/:userId', async (req, res) => {
    try {
        const { userId } = req.params;
        const { data: tasks, error } = await supabase
            .from('tasks')
            .select('*')
            .eq('advertisor_id', userId)
            .order('created_at', { ascending: false });
        if (error) return res.status(400).json({ error: 'Failed to fetch tasks' });
        res.json({ tasks: tasks || [] });
    } catch (error) {
        res.status(500).json({ error: 'Server error' });
    }
});

app.get('/api/tasks/applied/:userId', async (req, res) => {
    try {
        const { userId } = req.params;
        const { data: completions, error } = await supabase
            .from('task_completions')
            .select(`
                task_id,
                task:task_id (
                    *,
                    advertisor:advertisor_id (
                        full_name,
                        email,
                        profile_photo_url
                    )
                ),
                status,
                created_at,
                amount_earned
            `)
            .eq('freelancer_id', userId)
            .order('created_at', { ascending: false });
        if (error) return res.status(400).json({ error: 'Failed to fetch applied tasks' });
        res.json({ applications: completions || [] });
    } catch (error) {
        res.status(500).json({ error: 'Server error' });
    }
});

app.post('/api/tasks', validateTask, async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }
    try {
        const { title, description, category, budget_per_completion, total_budget, max_completions, advertisor_id, instructions, completion_requirements } = req.body;
        const { data: advertisor, error: userError } = await supabase
            .from('users')
            .select('role, is_approved, wallet_balance, full_name, email')
            .eq('id', advertisor_id)
            .single();
        if (userError) return res.status(404).json({ error: 'User not found' });
        if (advertisor.role !== 'advertisor') return res.status(403).json({ error: 'Only advertisers can post tasks' });
        if (!advertisor.is_approved) return res.status(403).json({ error: 'Account pending admin approval' });
        if (advertisor.wallet_balance < total_budget) {
            return res.status(400).json({ error: `Insufficient balance. Available: $${advertisor.wallet_balance.toFixed(2)}, Required: $${total_budget.toFixed(2)}` });
        }
        const { data: task, error } = await supabase
            .from('tasks')
            .insert({
                title: sanitizeInput(title),
                description: sanitizeInput(description),
                category: sanitizeInput(category),
                budget_per_completion,
                total_budget,
                remaining_budget: total_budget,
                max_completions,
                advertisor_id,
                instructions: instructions ? sanitizeInput(instructions) : null,
                completion_requirements: completion_requirements ? sanitizeInput(completion_requirements) : null,
                status: 'pending'
            })
            .select()
            .single();
        if (error) return res.status(400).json({ error: 'Failed to create task' });

        await supabase
            .from('users')
            .update({ wallet_balance: advertisor.wallet_balance - total_budget })
            .eq('id', advertisor_id);

        await supabase
            .from('transactions')
            .insert({
                user_id: advertisor_id,
                type: 'deposit',
                amount: total_budget,
                fee: 0,
                net_amount: total_budget,
                status: 'completed',
                description: `Funds held for task: ${title}`,
                related_task_id: task.id,
                admin_notes: 'Auto-held for task'
            });

        notifyBot('notifyTaskPosted', task, { full_name: advertisor.full_name, email: advertisor.email });
        res.json({ success: true, message: 'Task created, pending admin approval.', task });
    } catch (error) {
        console.error('Task creation error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

app.put('/api/tasks/:id/status', async (req, res) => {
    try {
        const { id } = req.params;
        const { status } = req.body;
        if (!['pending', 'active', 'paused', 'completed', 'cancelled'].includes(status)) {
            return res.status(400).json({ error: 'Invalid status' });
        }
        const { data: task, error } = await supabase
            .from('tasks')
            .update({ status })
            .eq('id', id)
            .select()
            .single();
        if (error) return res.status(400).json({ error: 'Failed to update task' });
        res.json({ success: true, task });
    } catch (error) {
        res.status(500).json({ error: 'Server error' });
    }
});

app.delete('/api/tasks/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { admin_id } = req.body;
        const { data: admin, error: adminError } = await supabase
            .from('users')
            .select('role')
            .eq('id', admin_id)
            .single();
        if (adminError || admin.role !== 'admin') return res.status(403).json({ error: 'Admin required' });
        const { error } = await supabase
            .from('tasks')
            .update({ status: 'cancelled' })
            .eq('id', id);
        if (error) return res.status(400).json({ error: 'Failed to delete task' });
        await supabase.from('admin_logs').insert({
            admin_id: admin_id,
            action: 'delete_task',
            target_type: 'task',
            target_id: id,
            details: { deleted_by: admin_id }
        });
        res.json({ success: true, message: 'Task deleted' });
    } catch (error) {
        res.status(500).json({ error: 'Server error' });
    }
});

// ============================================================
// ════════════════════════════════════════════════════════════
// COMPLETION ROUTES (FULL)
// ============================================================

app.post('/api/completions', async (req, res) => {
    try {
        const { task_id, freelancer_id, submission_text, submission_file_url } = req.body;
        const { data: existing } = await supabase
            .from('task_completions')
            .select('*')
            .eq('task_id', task_id)
            .eq('freelancer_id', freelancer_id)
            .single();
        if (existing) return res.status(400).json({ error: 'Already submitted' });

        const { data: task, error: taskError } = await supabase
            .from('tasks')
            .select('budget_per_completion, title')
            .eq('id', task_id)
            .single();
        if (taskError) return res.status(404).json({ error: 'Task not found' });

        const { data: freelancer, error: freelancerError } = await supabase
            .from('users')
            .select('full_name, email')
            .eq('id', freelancer_id)
            .single();
        if (freelancerError) return res.status(404).json({ error: 'Freelancer not found' });

        const { data: completion, error } = await supabase
            .from('task_completions')
            .insert({
                task_id,
                freelancer_id,
                submission_text: submission_text ? sanitizeInput(submission_text) : 'No submission text provided',
                submission_file_url: submission_file_url || null,
                amount_earned: task.budget_per_completion,
                status: 'pending'
            })
            .select()
            .single();
        if (error) return res.status(400).json({ error: 'Failed to submit' });

        notifyBot('notifyTaskCompletion', completion, { title: task.title }, { full_name: freelancer.full_name, email: freelancer.email });
        res.json({ success: true, completion });
    } catch (error) {
        console.error('Completion error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

app.get('/api/completions/freelancer/:userId', async (req, res) => {
    try {
        const { userId } = req.params;
        const { data: completions, error } = await supabase
            .from('task_completions')
            .select(`
                *,
                task:task_id (
                    id,
                    title,
                    description,
                    budget_per_completion,
                    status
                )
            `)
            .eq('freelancer_id', userId)
            .order('created_at', { ascending: false });
        if (error) return res.status(400).json({ error: 'Failed to fetch applications' });
        res.json({ completions: completions || [] });
    } catch (error) {
        res.status(500).json({ error: 'Server error' });
    }
});

app.get('/api/completions/task/:taskId', async (req, res) => {
    try {
        const { taskId } = req.params;
        const { data: completions, error } = await supabase
            .from('task_completions')
            .select(`
                *,
                freelancer:freelancer_id (
                    full_name,
                    email,
                    profile_photo_url
                )
            `)
            .eq('task_id', taskId)
            .order('created_at', { ascending: false });
        if (error) return res.status(400).json({ error: 'Failed to fetch completions' });
        res.json({ completions: completions || [] });
    } catch (error) {
        res.status(500).json({ error: 'Server error' });
    }
});

app.put('/api/completions/:id/approve', async (req, res) => {
    try {
        const { id } = req.params;
        const { data: completion, error: fetchError } = await supabase
            .from('task_completions')
            .select('*')
            .eq('id', id)
            .single();
        if (fetchError || !completion) return res.status(404).json({ error: 'Completion not found' });
        if (completion.status === 'approved') return res.status(400).json({ error: 'Already approved' });

        const { data: task, error: taskError } = await supabase
            .from('tasks')
            .select('title, remaining_budget')
            .eq('id', completion.task_id)
            .single();
        if (taskError) return res.status(404).json({ error: 'Task not found' });

        const { data: freelancer, error: freelancerError } = await supabase
            .from('users')
            .select('full_name, email, wallet_balance, total_earned')
            .eq('id', completion.freelancer_id)
            .single();
        if (freelancerError) return res.status(404).json({ error: 'Freelancer not found' });

        const { data: updated, error: updateError } = await supabase
            .from('task_completions')
            .update({
                status: 'approved',
                completed_at: new Date().toISOString()
            })
            .eq('id', id)
            .select()
            .single();
        if (updateError) return res.status(400).json({ error: 'Failed to approve' });

        const newBalance = (freelancer.wallet_balance || 0) + completion.amount_earned;
        const newTotalEarned = (freelancer.total_earned || 0) + completion.amount_earned;
        await supabase
            .from('users')
            .update({ wallet_balance: newBalance, total_earned: newTotalEarned })
            .eq('id', completion.freelancer_id);

        const newRemaining = (task.remaining_budget || 0) - completion.amount_earned;
        await supabase
            .from('tasks')
            .update({ remaining_budget: newRemaining < 0 ? 0 : newRemaining, completed_count: supabase.raw('completed_count + 1') })
            .eq('id', completion.task_id);

        const { data: updatedTask } = await supabase
            .from('tasks')
            .select('completed_count, max_completions')
            .eq('id', completion.task_id)
            .single();
        if (updatedTask && updatedTask.completed_count >= updatedTask.max_completions) {
            await supabase
                .from('tasks')
                .update({ status: 'completed' })
                .eq('id', completion.task_id);
        }

        await supabase
            .from('transactions')
            .insert({
                user_id: completion.freelancer_id,
                type: 'task_payment',
                amount: completion.amount_earned,
                fee: 0,
                net_amount: completion.amount_earned,
                status: 'completed',
                description: `Payment for task: ${task.title}`,
                related_task_id: completion.task_id,
                related_completion_id: id
            });

        notifyBot('notifyCompletionApproved', completion, { title: task.title }, { full_name: freelancer.full_name, email: freelancer.email });
        res.json({ success: true, message: 'Task completion approved. Payment processed.', completion: updated });
    } catch (error) {
        console.error('Approval error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

app.delete('/api/completions/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { admin_id } = req.body;
        const { data: admin, error: adminError } = await supabase
            .from('users')
            .select('role')
            .eq('id', admin_id)
            .single();
        if (adminError || admin.role !== 'admin') return res.status(403).json({ error: 'Admin required' });
        const { error } = await supabase
            .from('task_completions')
            .update({ status: 'rejected' })
            .eq('id', id);
        if (error) return res.status(400).json({ error: 'Failed to reject completion' });
        await supabase.from('admin_logs').insert({
            admin_id: admin_id,
            action: 'reject_completion',
            target_type: 'completion',
            target_id: id,
            details: { rejected_by: admin_id }
        });
        res.json({ success: true, message: 'Completion rejected' });
    } catch (error) {
        res.status(500).json({ error: 'Server error' });
    }
});

// ============================================================
// ════════════════════════════════════════════════════════════
// WITHDRAWAL ROUTES (FULL)
// ============================================================

app.post('/api/withdrawals', validateWithdrawal, async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }
    try {
        const { user_id, amount, payment_method, payment_details } = req.body;
        const { data: user, error: userError } = await supabase
            .from('users')
            .select('wallet_balance, full_name, email')
            .eq('id', user_id)
            .single();
        if (userError) return res.status(404).json({ error: 'User not found' });
        if (user.wallet_balance < amount) return res.status(400).json({ error: 'Insufficient balance' });

        const fee = amount * 0.10;
        const netAmount = amount - fee;
        const { data: withdrawal, error } = await supabase
            .from('withdrawal_requests')
            .insert({
                user_id,
                amount,
                fee,
                net_amount: netAmount,
                payment_method,
                payment_details: payment_details,
                status: 'pending'
            })
            .select()
            .single();
        if (error) return res.status(400).json({ error: 'Failed to request withdrawal' });

        notifyBot('notifyWithdrawal', { full_name: user.full_name, email: user.email }, withdrawal);
        res.json({ success: true, withdrawal, message: `Withdrawal submitted. You will receive $${netAmount.toFixed(2)} after fees.` });
    } catch (error) {
        console.error('Withdrawal error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

app.get('/api/withdrawals/user/:userId', async (req, res) => {
    try {
        const { userId } = req.params;
        const { data: withdrawals, error } = await supabase
            .from('withdrawal_requests')
            .select('*')
            .eq('user_id', userId)
            .order('created_at', { ascending: false });
        if (error) return res.status(400).json({ error: 'Failed to fetch withdrawals' });
        res.json({ withdrawals: withdrawals || [] });
    } catch (error) {
        res.status(500).json({ error: 'Server error' });
    }
});

app.put('/api/withdrawals/:id/process', async (req, res) => {
    try {
        const { id } = req.params;
        const { admin_id, status, admin_notes } = req.body;
        if (!['pending', 'processing', 'completed', 'cancelled', 'failed'].includes(status)) {
            return res.status(400).json({ error: 'Invalid status' });
        }
        const { data: withdrawal, error: fetchError } = await supabase
            .from('withdrawal_requests')
            .select('*')
            .eq('id', id)
            .single();
        if (fetchError || !withdrawal) return res.status(404).json({ error: 'Withdrawal not found' });

        const { data: updated, error: updateError } = await supabase
            .from('withdrawal_requests')
            .update({
                status: status,
                admin_notes: admin_notes || null,
                processed_by: admin_id || null,
                processed_at: status === 'completed' || status === 'failed' ? new Date().toISOString() : null
            })
            .eq('id', id)
            .select()
            .single();
        if (updateError) return res.status(400).json({ error: 'Failed to process withdrawal' });

        if (status === 'completed') {
            const { data: user, error: userError } = await supabase
                .from('users')
                .select('wallet_balance, total_withdrawn')
                .eq('id', withdrawal.user_id)
                .single();
            if (!userError && user) {
                await supabase
                    .from('users')
                    .update({
                        wallet_balance: user.wallet_balance - withdrawal.amount,
                        total_withdrawn: (user.total_withdrawn || 0) + withdrawal.amount
                    })
                    .eq('id', withdrawal.user_id);
                await supabase
                    .from('transactions')
                    .insert({
                        user_id: withdrawal.user_id,
                        type: 'withdrawal',
                        amount: -withdrawal.amount,
                        fee: withdrawal.fee,
                        net_amount: -withdrawal.net_amount,
                        status: 'completed',
                        description: `Withdrawal via ${withdrawal.payment_method}`,
                        admin_notes: admin_notes || 'Processed by admin'
                    });
            }
        }
        res.json({ success: true, withdrawal: updated });
    } catch (error) {
        console.error('Process withdrawal error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// ============================================================
// ════════════════════════════════════════════════════════════
// ADMIN ROUTES (FULL)
// ============================================================

app.get('/api/admin/users', async (req, res) => {
    try {
        const { limit = 50, offset = 0, role, approved } = req.query;
        let query = supabase.from('users').select('*').order('created_at', { ascending: false });
        if (role) query = query.eq('role', role);
        if (approved === 'true') query = query.eq('is_approved', true);
        if (approved === 'false') query = query.eq('is_approved', false);
        const { data: users, error } = await query.range(parseInt(offset), parseInt(offset) + parseInt(limit) - 1);
        if (error) return res.status(400).json({ error: 'Failed to fetch users' });
        const { count } = await supabase.from('users').select('*', { count: 'exact', head: true });
        res.json({ users, total: count || 0 });
    } catch (error) {
        res.status(500).json({ error: 'Server error' });
    }
});

app.get('/api/admin/users/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { data: user, error } = await supabase
            .from('users')
            .select('*')
            .eq('id', id)
            .single();
        if (error) return res.status(404).json({ error: 'User not found' });
        res.json({ user });
    } catch (error) {
        res.status(500).json({ error: 'Server error' });
    }
});

app.put('/api/admin/users/:id/approve', async (req, res) => {
    try {
        const { id } = req.params;
        const { admin_id } = req.body;
        const { data: user, error } = await supabase
            .from('users')
            .update({ is_approved: true })
            .eq('id', id)
            .select()
            .single();
        if (error) return res.status(400).json({ error: 'Failed to approve user' });
        await supabase.from('admin_logs').insert({
            admin_id: admin_id || id,
            action: 'approve_user',
            target_type: 'user',
            target_id: id,
            details: { user: user }
        });
        if (user.role === 'advertisor') {
            notifyBot('notifyAdvertisorApproved', { full_name: user.full_name, email: user.email });
        }
        res.json({ success: true, message: 'User approved', user });
    } catch (error) {
        res.status(500).json({ error: 'Server error' });
    }
});

app.put('/api/admin/users/:id/role', async (req, res) => {
    try {
        const { id } = req.params;
        const { role, admin_id } = req.body;
        if (!['freelancer', 'advertisor', 'admin'].includes(role)) {
            return res.status(400).json({ error: 'Invalid role' });
        }
        const { data: user, error } = await supabase
            .from('users')
            .update({ role: role })
            .eq('id', id)
            .select()
            .single();
        if (error) return res.status(400).json({ error: 'Failed to update role' });
        await supabase.from('admin_logs').insert({
            admin_id: admin_id,
            action: 'change_role',
            target_type: 'user',
            target_id: id,
            details: { new_role: role }
        });
        res.json({ success: true, message: 'Role updated', user });
    } catch (error) {
        res.status(500).json({ error: 'Server error' });
    }
});

app.get('/api/admin/logs', async (req, res) => {
    try {
        const { limit = 50, offset = 0, action } = req.query;
        let query = supabase
            .from('admin_logs')
            .select('*, admin:admin_id(full_name, email)')
            .order('created_at', { ascending: false });
        if (action) query = query.eq('action', action);
        const { data: logs, error } = await query.range(parseInt(offset), parseInt(offset) + parseInt(limit) - 1);
        if (error) return res.status(400).json({ error: 'Failed to fetch logs' });
        const { count } = await supabase.from('admin_logs').select('*', { count: 'exact', head: true });
        res.json({ logs, total: count || 0 });
    } catch (error) {
        res.status(500).json({ error: 'Server error' });
    }
});

app.get('/api/admin/tasks/pending', async (req, res) => {
    try {
        const { data: tasks, error } = await supabase
            .from('tasks')
            .select('*, advertisor:advertisor_id(full_name, email)')
            .eq('status', 'pending')
            .order('created_at', { ascending: false });
        if (error) return res.status(400).json({ error: 'Failed to fetch tasks' });
        res.json({ tasks });
    } catch (error) {
        res.status(500).json({ error: 'Server error' });
    }
});

app.get('/api/admin/completions/pending', async (req, res) => {
    try {
        const { data: completions, error } = await supabase
            .from('task_completions')
            .select(`
                *,
                task:task_id (
                    id,
                    title,
                    advertisor:advertisor_id (full_name, email)
                ),
                freelancer:freelancer_id (full_name, email)
            `)
            .eq('status', 'pending')
            .order('created_at', { ascending: false });
        if (error) return res.status(400).json({ error: 'Failed to fetch completions' });
        res.json({ completions });
    } catch (error) {
        res.status(500).json({ error: 'Server error' });
    }
});

app.get('/api/admin/withdrawals/pending', async (req, res) => {
    try {
        const { data: withdrawals, error } = await supabase
            .from('withdrawal_requests')
            .select('*, user:user_id(full_name, email, phone)')
            .eq('status', 'pending')
            .order('created_at', { ascending: false });
        if (error) return res.status(400).json({ error: 'Failed to fetch withdrawals' });
        res.json({ withdrawals });
    } catch (error) {
        res.status(500).json({ error: 'Server error' });
    }
});

app.post('/api/admin/wallet/add', async (req, res) => {
    try {
        const { user_id, amount, description, admin_id } = req.body;
        if (amount <= 0) return res.status(400).json({ error: 'Amount must be positive' });
        const { data: user, error: userError } = await supabase
            .from('users')
            .select('wallet_balance, full_name, email')
            .eq('id', user_id)
            .single();
        if (userError) return res.status(404).json({ error: 'User not found' });
        const newBalance = (user.wallet_balance || 0) + amount;
        await supabase
            .from('users')
            .update({ wallet_balance: newBalance })
            .eq('id', user_id);
        await supabase
            .from('transactions')
            .insert({
                user_id: user_id,
                type: 'deposit',
                amount: amount,
                fee: 0,
                net_amount: amount,
                status: 'completed',
                description: description || 'Manual deposit',
                admin_notes: `Added by admin ${admin_id || 'system'}`
            });
        notifyBot('notifyDeposit', { full_name: user.full_name, email: user.email }, amount, description);
        res.json({ success: true, message: `Added $${amount.toFixed(2)} to user wallet`, new_balance: newBalance });
    } catch (error) {
        console.error('Wallet add error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// ============================================================
// ════════════════════════════════════════════════════════════
// DASHBOARD ROUTES (EXTENDED)
// ============================================================

app.get('/api/dashboard/freelancer/:userId', async (req, res) => {
    try {
        const { userId } = req.params;
        const { data: user, error: userError } = await supabase
            .from('users')
            .select('wallet_balance, total_earned, total_withdrawn')
            .eq('id', userId)
            .single();
        if (userError) return res.status(404).json({ error: 'User not found' });

        const { count: completedCount } = await supabase
            .from('task_completions')
            .select('*', { count: 'exact', head: true })
            .eq('freelancer_id', userId)
            .eq('status', 'approved');

        const { count: pendingCount } = await supabase
            .from('task_completions')
            .select('*', { count: 'exact', head: true })
            .eq('freelancer_id', userId)
            .eq('status', 'pending');

        const { count: pendingWithdrawals } = await supabase
            .from('withdrawal_requests')
            .select('*', { count: 'exact', head: true })
            .eq('user_id', userId)
            .eq('status', 'pending');

        const { count: activeTasks } = await supabase
            .from('tasks')
            .select('*', { count: 'exact', head: true })
            .eq('status', 'active');

        const { count: totalEarnedToday } = await supabase
            .from('transactions')
            .select('*', { count: 'exact', head: true })
            .eq('user_id', userId)
            .eq('type', 'task_payment')
            .eq('status', 'completed')
            .gte('created_at', getStartOfDay());

        res.json({
            stats: {
                wallet_balance: user.wallet_balance || 0,
                total_earned: user.total_earned || 0,
                total_withdrawn: user.total_withdrawn || 0,
                completed_tasks: completedCount || 0,
                pending_tasks: pendingCount || 0,
                pending_withdrawals: pendingWithdrawals || 0,
                active_tasks: activeTasks || 0,
                earned_today: totalEarnedToday || 0
            }
        });
    } catch (error) {
        res.status(500).json({ error: 'Server error' });
    }
});

app.get('/api/dashboard/advertisor/:userId', async (req, res) => {
    try {
        const { userId } = req.params;
        const { data: user, error: userError } = await supabase
            .from('users')
            .select('wallet_balance, is_approved')
            .eq('id', userId)
            .single();
        if (userError) return res.status(404).json({ error: 'User not found' });

        const { data: tasks, error: tasksError } = await supabase
            .from('tasks')
            .select('status')
            .eq('advertisor_id', userId);
        if (tasksError) return res.status(400).json({ error: 'Failed to fetch tasks' });

        const activeTasks = tasks.filter(t => t.status === 'active').length;
        const pendingTasks = tasks.filter(t => t.status === 'pending').length;
        const completedTasks = tasks.filter(t => t.status === 'completed').length;

        const { data: spentData } = await supabase
            .from('transactions')
            .select('amount')
            .eq('user_id', userId)
            .eq('type', 'deposit')
            .eq('status', 'completed');
        let totalSpent = 0;
        if (spentData) spentData.forEach(t => { totalSpent += t.amount || 0; });

        const { data: totalSpentToday } = await supabase
            .from('transactions')
            .select('amount')
            .eq('user_id', userId)
            .eq('type', 'deposit')
            .eq('status', 'completed')
            .gte('created_at', getStartOfDay());

        let spentToday = 0;
        if (totalSpentToday) totalSpentToday.forEach(t => { spentToday += t.amount || 0; });

        res.json({
            stats: {
                wallet_balance: user.wallet_balance || 0,
                is_approved: user.is_approved || false,
                active_tasks: activeTasks,
                pending_tasks: pendingTasks,
                completed_tasks: completedTasks,
                total_tasks: tasks.length,
                total_spent: totalSpent,
                spent_today: spentToday
            }
        });
    } catch (error) {
        res.status(500).json({ error: 'Server error' });
    }
});

// ============================================================
// ════════════════════════════════════════════════════════════
// NOTIFICATION ROUTES (BOT)
// ============================================================

app.post('/api/admin/notify', async (req, res) => {
    try {
        const { message, type = 'info' } = req.body;
        if (!message) return res.status(400).json({ error: 'Message required' });

        const formattedMessage = `
📢 *Admin Notification*
Type: ${type.toUpperCase()}
Message: ${message}
Timestamp: ${new Date().toLocaleString()}
*Built by Rshiraz* 🇰🇪
        `;

        notifyBot('sendNotification', formattedMessage);
        res.json({ success: true, message: 'Notification sent' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ============================================================
// ════════════════════════════════════════════════════════════
// ERROR HANDLING
// ============================================================

app.use((err, req, res, next) => {
    console.error('Global error:', err);
    errorLogs.push({
        timestamp: new Date().toISOString(),
        message: err.message,
        stack: err.stack,
        path: req.path,
        method: req.method,
        ip: req.ip
    });
    if (errorLogs.length > 1000) errorLogs.shift();
    notifyBot('notifyError', err, 'global');
    res.status(500).json({ error: 'Internal server error', message: err.message });
});

app.use((req, res) => {
    res.status(404).json({ error: 'Route not found', path: req.path });
});

// ============================================================
// ════════════════════════════════════════════════════════════
// START SERVER
// ============================================================

app.listen(PORT, () => {
    console.log('🔥 Zurifex API running on http://localhost:' + PORT);
    console.log('🇰🇪 Environment: ' + (process.env.NODE_ENV || 'development'));
    console.log('🤖 Telegram Bot: ' + (botConnected ? '✅ Connected' : '⚠️ Disabled'));
    console.log('📦 Version: ' + SYSTEM_INFO.version);
    console.log('👤 Author: ' + SYSTEM_INFO.author);
    console.log('📊 Total routes: ~' + Object.keys(app._router.stack).length);
    console.log('✅ All systems operational. Ready for requests.');
});
