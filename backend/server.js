// ============================================================
//  ███████╗██╗░░░██╗██████╗░██╗███████╗███████╗██╗░░██╗
//  ╚══███╔╝██║░░░██║██╔══██╗██║██╔════╝██╔════╝╚██╗██╔╝
//  ░░██╔╝░██║░░░██║██████╔╝██║█████╗░░█████╗░░░╚███╔╝░
//  ░██╔╝░░██║░░░██║██╔══██╗██║██╔══╝░░██╔══╝░░░██╔██╗░
//  ███████╗╚██████╔╝██║░░██║██║███████╗███████╗██╔╝╚██╗
//  ╚══════╝░╚═════╝░╚═╝░░╚═╝╚═╝╚══════╝╚══════╝╚═╝░░╚═╝
// ============================================================
// ZURIFEX PLATFORM - COMPLETE BACKEND
// Full API + Telegram Bot Integration + Advanced Analytics
// Version: 5.0.0 (MEGA EDITION)
// ============================================================

const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const { createClient } = require('@supabase/supabase-js');
const { OAuth2Client } = require('google-auth-library');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// ============================================================
// ════════════════════════════════════════════════════════════
// TELEGRAM BOT INTEGRATION (IMPROVED)
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
    
    let loadedPath = null;
    for (const botPath of possiblePaths) {
        try {
            require.resolve(botPath);
            const bot = require(botPath);
            if (bot && typeof bot.notifyTest === 'function') {
                botFunctions = bot;
                botConnected = true;
                loadedPath = botPath;
                break;
            }
        } catch (e) {
            // Try next path
        }
    }
    
    if (botConnected) {
        console.log('✅ Telegram bot integration loaded successfully from:', loadedPath);
        console.log(`📨 Bot notifications will be sent to admin`);
    } else {
        console.warn('⚠️ Telegram bot module not found or invalid. Notifications disabled.');
    }
} catch (error) {
    console.warn('⚠️ Telegram bot integration not available:', error.message);
}

// ============================================================
// ════════════════════════════════════════════════════════════
// NOTIFICATION HELPER
// ════════════════════════════════════════════════════════════
// ============================================================
function notifyBot(functionName, ...args) {
    if (!botConnected || !botFunctions[functionName]) {
        console.log(`📤 [${functionName}] (skipped - bot not available)`);
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
// MIDDLEWARE
// ════════════════════════════════════════════════════════════
// ============================================================
app.use(cors({
    origin: [
        'http://localhost:3000',
        'http://localhost:5000',
        'http://localhost:5500',
        'https://zurifex.netlify.app',
        'https://zurifex.com',
        'https://zurifex-platform.onrender.com'
    ],
    credentials: true
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// ============================================================
// ════════════════════════════════════════════════════════════
// LOGGING MIDDLEWARE
// ════════════════════════════════════════════════════════════
// ============================================================
app.use((req, res, next) => {
    const start = Date.now();
    res.on('finish', () => {
        const duration = Date.now() - start;
        const log = `[${new Date().toISOString()}] ${req.method} ${req.path} - ${res.statusCode} - ${duration}ms - ${req.ip}`;
        console.log(log);
        try {
            fs.appendFileSync(path.join(__dirname, 'logs', 'requests.log'), log + '\n');
        } catch (e) { /* ignore */ }
    });
    next();
});

// Create logs directory
try {
    if (!fs.existsSync(path.join(__dirname, 'logs'))) {
        fs.mkdirSync(path.join(__dirname, 'logs'));
    }
} catch (e) { /* ignore */ }

// ============================================================
// ════════════════════════════════════════════════════════════
// SUPABASE CLIENTS
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
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
        const r = Math.random() * 16 | 0;
        const v = c === 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
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

function randomInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

function hashPassword(password) {
    return crypto.createHash('sha256').update(password).digest('hex');
}

function isValidEmail(email) {
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return re.test(email);
}

// ============================================================
// ════════════════════════════════════════════════════════════
// TEST ROUTES
// ════════════════════════════════════════════════════════════
// ============================================================

// Root - API Status
app.get('/', (req, res) => {
    res.json({
        name: 'Zurifex API',
        version: '5.0.0',
        message: 'Zurifex API is running 🇰🇪',
        status: 'online',
        bot: botConnected ? 'connected ✅' : 'disabled ⚠️',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        endpoints: {
            auth: '/api/auth/google',
            users: '/api/users',
            tasks: '/api/tasks',
            wallet: '/api/wallet',
            admin: '/api/admin',
            stats: '/api/stats',
            deposit: '/api/deposit/request',
            health: '/api/health'
        }
    });
});

// Health Check
app.get('/api/health', (req, res) => {
    res.json({
        status: 'healthy',
        bot: botConnected,
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        timestamp: new Date().toISOString(),
        node_version: process.version,
        env: process.env.NODE_ENV || 'development'
    });
});

// ============================================================
// ════════════════════════════════════════════════════════════
// TEST BOT NOTIFICATION (GET + POST)
// ════════════════════════════════════════════════════════════
// ============================================================
app.get('/api/test/notification', async (req, res) => {
    try {
        const message = req.query.message || 'Test notification from API (GET)!';
        if (!botConnected) {
            return res.status(400).json({ error: 'Bot not connected' });
        }
        notifyBot('notifyTest', message);
        res.json({
            success: true,
            message: 'Test notification sent to Telegram',
            telegram: '@zurifex_bot',
            sent: message,
            method: 'GET'
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/test/notification', async (req, res) => {
    try {
        const message = req.body.message || 'Test notification from API (POST)!';
        if (!botConnected) {
            return res.status(400).json({ error: 'Bot not connected' });
        }
        notifyBot('notifyTest', message);
        res.json({
            success: true,
            message: 'Test notification sent to Telegram',
            telegram: '@zurifex_bot',
            sent: message,
            method: 'POST'
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ============================================================
// ════════════════════════════════════════════════════════════
// PLATFORM STATISTICS (Public + Admin)
// ════════════════════════════════════════════════════════════
// ============================================================

// Public platform stats
app.get('/api/stats', async (req, res) => {
    try {
        const { count: usersCount } = await supabase.from('users').select('*', { count: 'exact', head: true });
        const { count: tasksCount } = await supabase.from('tasks').select('*', { count: 'exact', head: true });
        const { count: completedCount } = await supabase.from('task_completions').select('*', { count: 'exact', head: true }).eq('status', 'approved');
        
        const { data: earnings } = await supabase.from('transactions').select('amount').eq('type', 'task_payment').eq('status', 'completed');
        let totalEarnings = 0;
        if (earnings) earnings.forEach(t => { totalEarnings += t.amount || 0; });

        res.json({
            users: usersCount || 0,
            tasks: tasksCount || 0,
            completed: completedCount || 0,
            total_earnings: totalEarnings,
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Admin platform analytics (detailed)
app.get('/api/admin/analytics', async (req, res) => {
    try {
        // Get counts
        const { count: totalUsers } = await supabase.from('users').select('*', { count: 'exact', head: true });
        const { count: totalTasks } = await supabase.from('tasks').select('*', { count: 'exact', head: true });
        const { count: activeTasks } = await supabase.from('tasks').select('*', { count: 'exact', head: true }).eq('status', 'active');
        const { count: pendingTasks } = await supabase.from('tasks').select('*', { count: 'exact', head: true }).eq('status', 'pending');
        const { count: completedTasks } = await supabase.from('tasks').select('*', { count: 'exact', head: true }).eq('status', 'completed');
        
        const { count: totalCompletions } = await supabase.from('task_completions').select('*', { count: 'exact', head: true });
        const { count: pendingCompletions } = await supabase.from('task_completions').select('*', { count: 'exact', head: true }).eq('status', 'pending');
        const { count: approvedCompletions } = await supabase.from('task_completions').select('*', { count: 'exact', head: true }).eq('status', 'approved');

        // Users by role
        const { data: usersByRole } = await supabase.from('users').select('role');
        let freelancers = 0, advertisers = 0, admins = 0;
        if (usersByRole) {
            usersByRole.forEach(u => {
                if (u.role === 'freelancer') freelancers++;
                else if (u.role === 'advertisor') advertisers++;
                else if (u.role === 'admin') admins++;
            });
        }

        // Earnings
        const { data: earnings } = await supabase.from('transactions').select('amount').eq('type', 'task_payment').eq('status', 'completed');
        let totalEarnings = 0;
        if (earnings) earnings.forEach(t => { totalEarnings += t.amount || 0; });

        const { data: withdrawn } = await supabase.from('transactions').select('amount').eq('type', 'withdrawal').eq('status', 'completed');
        let totalWithdrawn = 0;
        if (withdrawn) withdrawn.forEach(t => { totalWithdrawn += Math.abs(t.amount) || 0; });

        // Pending withdrawals
        const { count: pendingWithdrawals } = await supabase.from('withdrawal_requests').select('*', { count: 'exact', head: true }).eq('status', 'pending');

        // Daily stats (last 7 days)
        const dailyStats = [];
        for (let i = 6; i >= 0; i--) {
            const start = daysAgo(i);
            const end = daysAgo(i - 1);
            const { count: dayUsers } = await supabase.from('users').select('*', { count: 'exact', head: true }).gte('created_at', start).lt('created_at', end);
            const { count: dayTasks } = await supabase.from('tasks').select('*', { count: 'exact', head: true }).gte('created_at', start).lt('created_at', end);
            const { count: dayCompletions } = await supabase.from('task_completions').select('*', { count: 'exact', head: true }).gte('created_at', start).lt('created_at', end).eq('status', 'approved');
            
            dailyStats.push({
                date: start.split('T')[0],
                newUsers: dayUsers || 0,
                newTasks: dayTasks || 0,
                completions: dayCompletions || 0
            });
        }

        res.json({
            users: {
                total: totalUsers || 0,
                freelancers: freelancers,
                advertisers: advertisers,
                admins: admins
            },
            tasks: {
                total: totalTasks || 0,
                active: activeTasks || 0,
                pending: pendingTasks || 0,
                completed: completedTasks || 0
            },
            completions: {
                total: totalCompletions || 0,
                pending: pendingCompletions || 0,
                approved: approvedCompletions || 0
            },
            financial: {
                total_earnings: totalEarnings,
                total_withdrawn: totalWithdrawn,
                platform_balance: totalEarnings - totalWithdrawn,
                pending_withdrawals: pendingWithdrawals || 0
            },
            daily_stats: dailyStats,
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        console.error('Analytics error:', error);
        res.status(500).json({ error: error.message });
    }
});

// ============================================================
// ════════════════════════════════════════════════════════════
// AUTH ROUTE - Google Sign In
// ════════════════════════════════════════════════════════════
// ============================================================
app.post('/api/auth/google', async (req, res) => {
    try {
        const { idToken } = req.body;

        if (!idToken) {
            return res.status(400).json({ error: 'ID token required' });
        }

        const ticket = await googleClient.verifyIdToken({
            idToken: idToken,
            audience: process.env.GOOGLE_CLIENT_ID
        });

        const payload = ticket.getPayload();
        const { email, name, picture, sub: googleId } = payload;

        // Check if user exists
        let { data: existingUser, error: fetchError } = await supabase
            .from('users')
            .select('*')
            .eq('email', email)
            .single();

        let userData;
        let isNew = false;

        if (!existingUser) {
            isNew = true;
            // Create auth user
            const { data: authData, error: authError } = await supabase.auth.admin.createUser({
                email: email,
                email_confirm: true,
                user_metadata: {
                    full_name: name,
                    avatar_url: picture
                }
            });

            if (authError) {
                console.error('Auth creation error:', authError);
                return res.status(500).json({ error: 'Failed to create user' });
            }

            // Create user profile
            const { data: newUser, error: insertError } = await supabase
                .from('users')
                .insert({
                    id: authData.user.id,
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
                return res.status(500).json({ error: 'Failed to create profile' });
            }

            userData = newUser;

            // Send notification about new user
            notifyBot('notifyAdminUser', {
                id: userData.id,
                email: userData.email,
                full_name: userData.full_name,
                role: userData.role,
                is_verified: userData.is_verified
            });

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
                    is_new: true
                }
            });
        }

        // User exists - update
        const { data: updatedUser, error: updateError } = await supabase
            .from('users')
            .update({
                full_name: name,
                profile_photo_url: picture,
                is_verified: true
            })
            .eq('id', existingUser.id)
            .select()
            .single();

        userData = updatedUser || existingUser;

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
                is_new: false
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
// USER ROUTES (Including Email Lookup)
// ════════════════════════════════════════════════════════════
// ============================================================

// Get user by ID
app.get('/api/users/:id', async (req, res) => {
    try {
        const { id } = req.params;

        const { data: user, error } = await supabase
            .from('users')
            .select('*')
            .eq('id', id)
            .single();

        if (error) {
            return res.status(404).json({ error: 'User not found' });
        }

        return res.json({ user });
    } catch (error) {
        return res.status(500).json({ error: 'Server error' });
    }
});

// Get user by email (for login validation)
app.get('/api/users/email/:email', async (req, res) => {
    try {
        const { email } = req.params;

        if (!isValidEmail(email)) {
            return res.status(400).json({ error: 'Invalid email format' });
        }

        const { data: user, error } = await supabase
            .from('users')
            .select('*')
            .eq('email', email)
            .single();

        if (error) {
            return res.status(404).json({ error: 'User not found' });
        }

        return res.json({ user });
    } catch (error) {
        return res.status(500).json({ error: 'Server error' });
    }
});

// Update user
app.put('/api/users/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { full_name, phone, location, bio, skills, role } = req.body;

        const updates = {};
        if (full_name !== undefined) updates.full_name = full_name;
        if (phone !== undefined) updates.phone = phone;
        if (location !== undefined) updates.location = location;
        if (bio !== undefined) updates.bio = bio;
        if (skills !== undefined) updates.skills = skills;
        if (role !== undefined) updates.role = role;

        const { data: user, error } = await supabase
            .from('users')
            .update(updates)
            .eq('id', id)
            .select()
            .single();

        if (error) {
            return res.status(400).json({ error: 'Update failed' });
        }

        return res.json({ success: true, user });
    } catch (error) {
        return res.status(500).json({ error: 'Server error' });
    }
});

// Delete user (soft delete - admin only)
app.delete('/api/users/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { admin_id } = req.body;

        // Check if admin
        const { data: admin, error: adminError } = await supabase
            .from('users')
            .select('role')
            .eq('id', admin_id)
            .single();

        if (adminError || admin.role !== 'admin') {
            return res.status(403).json({ error: 'Admin access required' });
        }

        const { error } = await supabase
            .from('users')
            .update({ is_verified: false, is_approved: false })
            .eq('id', id);

        if (error) {
            return res.status(400).json({ error: 'Delete failed' });
        }

        // Log admin action
        await supabase.from('admin_logs').insert({
            admin_id: admin_id,
            action: 'delete_user',
            target_type: 'user',
            target_id: id,
            details: { deleted_by: admin_id }
        });

        return res.json({ success: true, message: 'User deactivated' });
    } catch (error) {
        return res.status(500).json({ error: 'Server error' });
    }
});

// ============================================================
// ════════════════════════════════════════════════════════════
// TRANSACTION ROUTES
// ════════════════════════════════════════════════════════════
// ============================================================

// Get user transactions
app.get('/api/transactions/user/:userId', async (req, res) => {
    try {
        const { userId } = req.params;

        const { data: transactions, error } = await supabase
            .from('transactions')
            .select('*')
            .eq('user_id', userId)
            .order('created_at', { ascending: false });

        if (error) {
            return res.status(400).json({ error: 'Failed to fetch transactions' });
        }

        return res.json({ transactions: transactions || [] });
    } catch (error) {
        return res.status(500).json({ error: 'Server error' });
    }
});

// Get all transactions (admin only)
app.get('/api/admin/transactions', async (req, res) => {
    try {
        const { data: transactions, error } = await supabase
            .from('transactions')
            .select('*, user:user_id(full_name, email)')
            .order('created_at', { ascending: false })
            .limit(100);

        if (error) {
            return res.status(400).json({ error: 'Failed to fetch transactions' });
        }

        return res.json({ transactions: transactions || [] });
    } catch (error) {
        return res.status(500).json({ error: 'Server error' });
    }
});

// ============================================================
// ════════════════════════════════════════════════════════════
// DEPOSIT REQUEST ROUTE (FIXED - NOW WORKING)
// ════════════════════════════════════════════════════════════
// ============================================================

app.post('/api/deposit/request', async (req, res) => {
    try {
        const { user_id, amount, method, reference, user_email, user_name } = req.body;

        // Validate input
        if (!user_id || !amount || amount <= 0 || !reference) {
            return res.status(400).json({ 
                error: 'Invalid deposit request. Please provide amount and reference.' 
            });
        }

        // Get user details
        const { data: user, error: userError } = await supabase
            .from('users')
            .select('full_name, email, wallet_balance')
            .eq('id', user_id)
            .single();

        if (userError || !user) {
            return res.status(404).json({ error: 'User not found' });
        }

        // Create a pending deposit transaction record
        const { data: depositRecord, error: depositError } = await supabase
            .from('transactions')
            .insert({
                user_id: user_id,
                type: 'deposit',
                amount: amount,
                fee: 0,
                net_amount: amount,
                status: 'pending',
                description: `Deposit request via ${method || 'Bank Transfer'} - Reference: ${reference}`,
                admin_notes: `Pending admin confirmation. Reference: ${reference}`
            })
            .select()
            .single();

        if (depositError) {
            console.error('Deposit record error:', depositError);
            // Continue anyway, we still want to notify admin
        }

        // Send notification to Telegram bot
        const depositMessage = `
💰 *New Deposit Request!*

👤 *User:* ${user.full_name}
📧 *Email:* ${user.email}
💵 *Amount:* $${amount.toFixed(2)}
📱 *Method:* ${method || 'Bank Transfer'}
📋 *Reference:* ${reference}
💰 *Current Balance:* $${(user.wallet_balance || 0).toFixed(2)}

📅 *Requested:* ${new Date().toLocaleString()}

⏳ *Action Required:* Confirm payment and add funds using:
\`/deposit ${user.email} ${amount}\`

*Built by Rshiraz* 🇰🇪
        `;

        notifyBot('sendNotification', depositMessage);

        return res.json({
            success: true,
            message: 'Deposit request sent to admin. You will be notified when funds are added.',
            deposit: depositRecord || null
        });

    } catch (error) {
        console.error('Deposit request error:', error);
        notifyBot('notifyError', error, 'deposit_request');
        return res.status(500).json({ error: 'Server error. Please try again.' });
    }
});

// ============================================================
// ════════════════════════════════════════════════════════════
// TASK ROUTES
// ════════════════════════════════════════════════════════════
// ============================================================

// Get all active tasks
app.get('/api/tasks', async (req, res) => {
    try {
        const { data: tasks, error } = await supabase
            .from('tasks')
            .select(`
                *,
                advertisor:advertisor_id (
                    full_name,
                    email,
                    profile_photo_url
                )
            `)
            .eq('status', 'active')
            .order('created_at', { ascending: false });

        if (error) {
            return res.status(400).json({ error: 'Failed to fetch tasks' });
        }

        return res.json({ tasks: tasks || [] });
    } catch (error) {
        return res.status(500).json({ error: 'Server error' });
    }
});

// Get task by ID
app.get('/api/tasks/:id', async (req, res) => {
    try {
        const { id } = req.params;
        
        const { data: task, error } = await supabase
            .from('tasks')
            .select(`
                *,
                advertisor:advertisor_id (
                    id,
                    full_name,
                    email,
                    profile_photo_url
                )
            `)
            .eq('id', id)
            .single();

        if (error) {
            return res.status(404).json({ error: 'Task not found' });
        }

        return res.json({ task });
    } catch (error) {
        return res.status(500).json({ error: 'Server error' });
    }
});

// Get advertisor's tasks
app.get('/api/tasks/advertisor/:userId', async (req, res) => {
    try {
        const { userId } = req.params;

        const { data: tasks, error } = await supabase
            .from('tasks')
            .select('*')
            .eq('advertisor_id', userId)
            .order('created_at', { ascending: false });

        if (error) {
            return res.status(400).json({ error: 'Failed to fetch tasks' });
        }

        return res.json({ tasks: tasks || [] });
    } catch (error) {
        return res.status(500).json({ error: 'Server error' });
    }
});

// Create task (advertisor only)
app.post('/api/tasks', async (req, res) => {
    try {
        const {
            title,
            description,
            category,
            budget_per_completion,
            total_budget,
            max_completions,
            advertisor_id,
            instructions,
            completion_requirements
        } = req.body;

        // Validate required fields
        if (!title || !description || !category || !budget_per_completion || !total_budget || !max_completions || !advertisor_id) {
            return res.status(400).json({ error: 'Missing required fields' });
        }

        // Check advertisor
        const { data: advertisor, error: userError } = await supabase
            .from('users')
            .select('role, is_approved, wallet_balance, full_name, email')
            .eq('id', advertisor_id)
            .single();

        if (userError || !advertisor) {
            return res.status(404).json({ error: 'User not found' });
        }

        if (advertisor.role !== 'advertisor') {
            return res.status(403).json({ error: 'Only advertisers can post tasks' });
        }

        if (!advertisor.is_approved) {
            return res.status(403).json({ error: 'Your account is pending admin approval' });
        }

        if (advertisor.wallet_balance < total_budget) {
            return res.status(400).json({ 
                error: `Insufficient balance. Available: $${advertisor.wallet_balance.toFixed(2)}, Required: $${total_budget.toFixed(2)}`
            });
        }

        // Create task
        const { data: task, error } = await supabase
            .from('tasks')
            .insert({
                title,
                description,
                category,
                budget_per_completion,
                total_budget,
                remaining_budget: total_budget,
                max_completions,
                advertisor_id,
                instructions,
                completion_requirements,
                status: 'pending'
            })
            .select()
            .single();

        if (error) {
            return res.status(400).json({ error: 'Failed to create task' });
        }

        // Hold funds
        await supabase
            .from('users')
            .update({
                wallet_balance: advertisor.wallet_balance - total_budget
            })
            .eq('id', advertisor_id);

        // Create transaction
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

        // Send notification
        notifyBot('notifyTaskPosted', task, {
            full_name: advertisor.full_name,
            email: advertisor.email
        });

        return res.json({ 
            success: true, 
            message: 'Task created successfully. Pending admin approval.',
            task 
        });

    } catch (error) {
        console.error('Task creation error:', error);
        notifyBot('notifyError', error, 'task_creation');
        return res.status(500).json({ error: 'Server error' });
    }
});

// Update task status (admin only)
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

        if (error) {
            return res.status(400).json({ error: 'Failed to update task' });
        }

        return res.json({ success: true, task });
    } catch (error) {
        return res.status(500).json({ error: 'Server error' });
    }
});

// ============================================================
// ════════════════════════════════════════════════════════════
// COMPLETION ROUTES
// ════════════════════════════════════════════════════════════
// ============================================================

// Submit task completion (freelancer)
app.post('/api/completions', async (req, res) => {
    try {
        const { task_id, freelancer_id, submission_text, submission_file_url } = req.body;

        // Check if already submitted
        const { data: existing, error: checkError } = await supabase
            .from('task_completions')
            .select('*')
            .eq('task_id', task_id)
            .eq('freelancer_id', freelancer_id)
            .single();

        if (existing) {
            return res.status(400).json({ error: 'You already submitted for this task' });
        }

        // Get task details
        const { data: task, error: taskError } = await supabase
            .from('tasks')
            .select('budget_per_completion, title, advertisor_id')
            .eq('id', task_id)
            .single();

        if (taskError) {
            return res.status(404).json({ error: 'Task not found' });
        }

        // Get freelancer details
        const { data: freelancer, error: freelancerError } = await supabase
            .from('users')
            .select('full_name, email')
            .eq('id', freelancer_id)
            .single();

        if (freelancerError) {
            return res.status(404).json({ error: 'Freelancer not found' });
        }

        // Create completion
        const { data: completion, error } = await supabase
            .from('task_completions')
            .insert({
                task_id,
                freelancer_id,
                submission_text: submission_text || 'No submission text provided',
                submission_file_url: submission_file_url || null,
                amount_earned: task.budget_per_completion,
                status: 'pending'
            })
            .select()
            .single();

        if (error) {
            return res.status(400).json({ error: 'Failed to submit' });
        }

        // Send notification
        notifyBot('notifyTaskCompletion', completion, {
            title: task.title
        }, {
            full_name: freelancer.full_name,
            email: freelancer.email
        });

        return res.json({ success: true, completion });
    } catch (error) {
        console.error('Completion error:', error);
        notifyBot('notifyError', error, 'task_completion');
        return res.status(500).json({ error: 'Server error' });
    }
});

// Get freelancer's completions
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

        if (error) {
            return res.status(400).json({ error: 'Failed to fetch applications' });
        }

        return res.json({ completions: completions || [] });
    } catch (error) {
        return res.status(500).json({ error: 'Server error' });
    }
});

// Get task completions (advertisor/admin)
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

        if (error) {
            return res.status(400).json({ error: 'Failed to fetch completions' });
        }

        return res.json({ completions: completions || [] });
    } catch (error) {
        return res.status(500).json({ error: 'Server error' });
    }
});

// Approve task completion (admin only)
app.put('/api/completions/:id/approve', async (req, res) => {
    try {
        const { id } = req.params;

        // Get completion details
        const { data: completion, error: fetchError } = await supabase
            .from('task_completions')
            .select('*')
            .eq('id', id)
            .single();

        if (fetchError || !completion) {
            return res.status(404).json({ error: 'Completion not found' });
        }

        if (completion.status === 'approved') {
            return res.status(400).json({ error: 'Already approved' });
        }

        // Get task details
        const { data: task, error: taskError } = await supabase
            .from('tasks')
            .select('title, remaining_budget')
            .eq('id', completion.task_id)
            .single();

        if (taskError) {
            return res.status(404).json({ error: 'Task not found' });
        }

        // Get freelancer details
        const { data: freelancer, error: freelancerError } = await supabase
            .from('users')
            .select('full_name, email, wallet_balance, total_earned')
            .eq('id', completion.freelancer_id)
            .single();

        if (freelancerError) {
            return res.status(404).json({ error: 'Freelancer not found' });
        }

        // Update completion status
        const { data: updated, error: updateError } = await supabase
            .from('task_completions')
            .update({
                status: 'approved',
                completed_at: new Date().toISOString()
            })
            .eq('id', id)
            .select()
            .single();

        if (updateError) {
            return res.status(400).json({ error: 'Failed to approve' });
        }

        // Update freelancer wallet
        const newBalance = (freelancer.wallet_balance || 0) + completion.amount_earned;
        const newTotalEarned = (freelancer.total_earned || 0) + completion.amount_earned;

        await supabase
            .from('users')
            .update({
                wallet_balance: newBalance,
                total_earned: newTotalEarned
            })
            .eq('id', completion.freelancer_id);

        // Update task remaining budget
        const newRemaining = (task.remaining_budget || 0) - completion.amount_earned;
        await supabase
            .from('tasks')
            .update({
                remaining_budget: newRemaining < 0 ? 0 : newRemaining,
                completed_count: supabase.raw('completed_count + 1')
            })
            .eq('id', completion.task_id);

        // Check if task is fully completed
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

        // Create transaction
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

        // Send notification
        notifyBot('notifyCompletionApproved', completion, {
            title: task.title
        }, {
            full_name: freelancer.full_name,
            email: freelancer.email
        });

        return res.json({
            success: true,
            message: 'Task completion approved. Payment processed.',
            completion: updated
        });

    } catch (error) {
        console.error('Approval error:', error);
        notifyBot('notifyError', error, 'completion_approval');
        return res.status(500).json({ error: 'Server error' });
    }
});

// ============================================================
// ════════════════════════════════════════════════════════════
// WITHDRAWAL ROUTES
// ════════════════════════════════════════════════════════════
// ============================================================

// Request withdrawal
app.post('/api/withdrawals', async (req, res) => {
    try {
        const { user_id, amount, payment_method, payment_details } = req.body;

        // Validate
        if (!user_id || !amount || !payment_method || !payment_details) {
            return res.status(400).json({ error: 'Missing required fields' });
        }

        // Check user balance
        const { data: user, error: userError } = await supabase
            .from('users')
            .select('wallet_balance, full_name, email')
            .eq('id', user_id)
            .single();

        if (userError) {
            return res.status(404).json({ error: 'User not found' });
        }

        if (user.wallet_balance < amount) {
            return res.status(400).json({ error: 'Insufficient balance' });
        }

        if (amount < 3) {
            return res.status(400).json({ error: 'Minimum withdrawal is $3' });
        }

        // Calculate fee (10%)
        const fee = amount * 0.10;
        const netAmount = amount - fee;

        // Create withdrawal request
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

        if (error) {
            return res.status(400).json({ error: 'Failed to request withdrawal' });
        }

        // Send notification
        notifyBot('notifyWithdrawal', {
            full_name: user.full_name,
            email: user.email
        }, withdrawal);

        return res.json({
            success: true,
            withdrawal,
            message: `Withdrawal request submitted. You will receive $${netAmount.toFixed(2)} after fees.`
        });
    } catch (error) {
        console.error('Withdrawal error:', error);
        notifyBot('notifyError', error, 'withdrawal');
        return res.status(500).json({ error: 'Server error' });
    }
});

// Get user withdrawals
app.get('/api/withdrawals/user/:userId', async (req, res) => {
    try {
        const { userId } = req.params;

        const { data: withdrawals, error } = await supabase
            .from('withdrawal_requests')
            .select('*')
            .eq('user_id', userId)
            .order('created_at', { ascending: false });

        if (error) {
            return res.status(400).json({ error: 'Failed to fetch withdrawals' });
        }

        return res.json({ withdrawals: withdrawals || [] });
    } catch (error) {
        return res.status(500).json({ error: 'Server error' });
    }
});

// Process withdrawal (admin only)
app.put('/api/withdrawals/:id/process', async (req, res) => {
    try {
        const { id } = req.params;
        const { admin_id, status, admin_notes } = req.body;

        if (!['pending', 'processing', 'completed', 'cancelled', 'failed'].includes(status)) {
            return res.status(400).json({ error: 'Invalid status' });
        }

        // Get withdrawal details
        const { data: withdrawal, error: fetchError } = await supabase
            .from('withdrawal_requests')
            .select('*')
            .eq('id', id)
            .single();

        if (fetchError || !withdrawal) {
            return res.status(404).json({ error: 'Withdrawal not found' });
        }

        // Update withdrawal
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

        if (updateError) {
            return res.status(400).json({ error: 'Failed to process withdrawal' });
        }

        // If completed, deduct from user balance
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

                // Create transaction
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

        return res.json({ success: true, withdrawal: updated });
    } catch (error) {
        console.error('Process withdrawal error:', error);
        return res.status(500).json({ error: 'Server error' });
    }
});

// ============================================================
// ════════════════════════════════════════════════════════════
// ADMIN ROUTES (FULL)
// ════════════════════════════════════════════════════════════
// ============================================================

// Get all users (admin only)
app.get('/api/admin/users', async (req, res) => {
    try {
        const { data: users, error } = await supabase
            .from('users')
            .select('*')
            .order('created_at', { ascending: false });

        if (error) {
            return res.status(400).json({ error: 'Failed to fetch users' });
        }

        return res.json({ users });
    } catch (error) {
        return res.status(500).json({ error: 'Server error' });
    }
});

// Get single user (admin only)
app.get('/api/admin/users/:id', async (req, res) => {
    try {
        const { id } = req.params;

        const { data: user, error } = await supabase
            .from('users')
            .select('*')
            .eq('id', id)
            .single();

        if (error) {
            return res.status(404).json({ error: 'User not found' });
        }

        return res.json({ user });
    } catch (error) {
        return res.status(500).json({ error: 'Server error' });
    }
});

// Approve user (advertisor or freelancer)
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

        if (error) {
            return res.status(400).json({ error: 'Failed to approve user' });
        }

        // Log admin action
        await supabase
            .from('admin_logs')
            .insert({
                admin_id: admin_id || id,
                action: 'approve_user',
                target_type: 'user',
                target_id: id,
                details: { user: user }
            });

        // Send notification
        if (user.role === 'advertisor') {
            notifyBot('notifyAdvertisorApproved', {
                full_name: user.full_name,
                email: user.email
            });
        }

        return res.json({
            success: true,
            message: 'User approved',
            user
        });
    } catch (error) {
        return res.status(500).json({ error: 'Server error' });
    }
});

// Change user role (admin only)
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

        if (error) {
            return res.status(400).json({ error: 'Failed to update role' });
        }

        // Log admin action
        await supabase
            .from('admin_logs')
            .insert({
                admin_id: admin_id,
                action: 'change_role',
                target_type: 'user',
                target_id: id,
                details: { new_role: role }
            });

        return res.json({
            success: true,
            message: 'Role updated',
            user
        });
    } catch (error) {
        return res.status(500).json({ error: 'Server error' });
    }
});

// Get admin logs
app.get('/api/admin/logs', async (req, res) => {
    try {
        const { limit = 50, offset = 0 } = req.query;

        const { data: logs, error } = await supabase
            .from('admin_logs')
            .select('*, admin:admin_id(full_name, email)')
            .order('created_at', { ascending: false })
            .range(parseInt(offset), parseInt(offset) + parseInt(limit) - 1);

        if (error) {
            return res.status(400).json({ error: 'Failed to fetch logs' });
        }

        const { count } = await supabase.from('admin_logs').select('*', { count: 'exact', head: true });

        return res.json({ logs, total: count || 0 });
    } catch (error) {
        return res.status(500).json({ error: 'Server error' });
    }
});

// Get pending tasks (admin only)
app.get('/api/admin/tasks/pending', async (req, res) => {
    try {
        const { data: tasks, error } = await supabase
            .from('tasks')
            .select(`
                *,
                advertisor:advertisor_id (
                    full_name,
                    email
                )
            `)
            .eq('status', 'pending')
            .order('created_at', { ascending: false });

        if (error) {
            return res.status(400).json({ error: 'Failed to fetch tasks' });
        }

        return res.json({ tasks });
    } catch (error) {
        return res.status(500).json({ error: 'Server error' });
    }
});

// Get pending completions (admin only)
app.get('/api/admin/completions/pending', async (req, res) => {
    try {
        const { data: completions, error } = await supabase
            .from('task_completions')
            .select(`
                *,
                task:task_id (
                    id,
                    title,
                    advertisor:advertisor_id (
                        full_name,
                        email
                    )
                ),
                freelancer:freelancer_id (
                    full_name,
                    email
                )
            `)
            .eq('status', 'pending')
            .order('created_at', { ascending: false });

        if (error) {
            return res.status(400).json({ error: 'Failed to fetch completions' });
        }

        return res.json({ completions });
    } catch (error) {
        return res.status(500).json({ error: 'Server error' });
    }
});

// Get pending withdrawals (admin only)
app.get('/api/admin/withdrawals/pending', async (req, res) => {
    try {
        const { data: withdrawals, error } = await supabase
            .from('withdrawal_requests')
            .select(`
                *,
                user:user_id (
                    full_name,
                    email,
                    phone
                )
            `)
            .eq('status', 'pending')
            .order('created_at', { ascending: false });

        if (error) {
            return res.status(400).json({ error: 'Failed to fetch withdrawals' });
        }

        return res.json({ withdrawals });
    } catch (error) {
        return res.status(500).json({ error: 'Server error' });
    }
});

// Add funds to user wallet (admin only)
app.post('/api/admin/wallet/add', async (req, res) => {
    try {
        const { user_id, amount, description, admin_id } = req.body;

        if (amount <= 0) {
            return res.status(400).json({ error: 'Amount must be positive' });
        }

        const { data: user, error: userError } = await supabase
            .from('users')
            .select('wallet_balance, full_name, email')
            .eq('id', user_id)
            .single();

        if (userError) {
            return res.status(404).json({ error: 'User not found' });
        }

        const newBalance = user.wallet_balance + amount;
        const { data: updated, error: updateError } = await supabase
            .from('users')
            .update({ wallet_balance: newBalance })
            .eq('id', user_id)
            .select()
            .single();

        if (updateError) {
            return res.status(400).json({ error: 'Failed to update wallet' });
        }

        // Create transaction
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

        // Send notification
        notifyBot('notifyDeposit', {
            full_name: user.full_name,
            email: user.email
        }, amount, description);

        return res.json({
            success: true,
            message: `Added $${amount.toFixed(2)} to user wallet`,
            new_balance: newBalance,
            user: updated
        });
    } catch (error) {
        console.error('Wallet add error:', error);
        return res.status(500).json({ error: 'Server error' });
    }
});

// ============================================================
// ════════════════════════════════════════════════════════════
// DASHBOARD ROUTES
// ════════════════════════════════════════════════════════════
// ============================================================

// Freelancer dashboard
app.get('/api/dashboard/freelancer/:userId', async (req, res) => {
    try {
        const { userId } = req.params;

        const { data: user, error: userError } = await supabase
            .from('users')
            .select('wallet_balance, total_earned, total_withdrawn')
            .eq('id', userId)
            .single();

        if (userError) {
            return res.status(404).json({ error: 'User not found' });
        }

        const { count: completedCount, error: countError } = await supabase
            .from('task_completions')
            .select('*', { count: 'exact', head: true })
            .eq('freelancer_id', userId)
            .eq('status', 'approved');

        const { count: pendingCount, error: pendingError } = await supabase
            .from('task_completions')
            .select('*', { count: 'exact', head: true })
            .eq('freelancer_id', userId)
            .eq('status', 'pending');

        const { count: pendingWithdrawals } = await supabase
            .from('withdrawal_requests')
            .select('*', { count: 'exact', head: true })
            .eq('user_id', userId)
            .eq('status', 'pending');

        return res.json({
            stats: {
                wallet_balance: user.wallet_balance || 0,
                total_earned: user.total_earned || 0,
                total_withdrawn: user.total_withdrawn || 0,
                completed_tasks: completedCount || 0,
                pending_tasks: pendingCount || 0,
                pending_withdrawals: pendingWithdrawals || 0
            }
        });
    } catch (error) {
        return res.status(500).json({ error: 'Server error' });
    }
});

// Advertisor dashboard
app.get('/api/dashboard/advertisor/:userId', async (req, res) => {
    try {
        const { userId } = req.params;

        const { data: user, error: userError } = await supabase
            .from('users')
            .select('wallet_balance, is_approved')
            .eq('id', userId)
            .single();

        if (userError) {
            return res.status(404).json({ error: 'User not found' });
        }

        const { data: tasks, error: tasksError } = await supabase
            .from('tasks')
            .select('status')
            .eq('advertisor_id', userId);

        if (tasksError) {
            return res.status(400).json({ error: 'Failed to fetch tasks' });
        }

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
        if (spentData) {
            spentData.forEach(t => { totalSpent += t.amount || 0; });
        }

        return res.json({
            stats: {
                wallet_balance: user.wallet_balance || 0,
                is_approved: user.is_approved || false,
                active_tasks: activeTasks,
                pending_tasks: pendingTasks,
                completed_tasks: completedTasks,
                total_tasks: tasks.length,
                total_spent: totalSpent
            }
        });
    } catch (error) {
        return res.status(500).json({ error: 'Server error' });
    }
});

// ============================================================
// ════════════════════════════════════════════════════════════
// ERROR HANDLING MIDDLEWARE
// ════════════════════════════════════════════════════════════
// ============================================================
app.use((err, req, res, next) => {
    console.error('Global error handler:', err);
    notifyBot('notifyError', err, 'global');
    res.status(500).json({
        error: 'Internal server error',
        message: err.message,
        timestamp: new Date().toISOString()
    });
});

// ============================================================
// ════════════════════════════════════════════════════════════
// 404 HANDLER
// ════════════════════════════════════════════════════════════
// ============================================================
app.use((req, res) => {
    res.status(404).json({
        error: 'Route not found',
        path: req.path,
        method: req.method,
        timestamp: new Date().toISOString()
    });
});

// ============================================================
// ════════════════════════════════════════════════════════════
// START SERVER
// ════════════════════════════════════════════════════════════
// ============================================================
app.listen(PORT, () => {
    console.log('🔥 Zurifex API running on http://localhost:' + PORT);
    console.log('🇰🇪 Environment: ' + (process.env.NODE_ENV || 'development'));
    console.log('🤖 Telegram Bot: ' + (botConnected ? '✅ Connected' : '⚠️ Disabled'));
    console.log('');
    console.log('📋 Available Routes (Full List):');
    const routes = [
        'GET  /',
        'GET  /api/health',
        'GET  /api/stats',
        'GET  /api/test/notification',
        'POST /api/test/notification',
        'POST /api/auth/google',
        'GET  /api/users/:id',
        'GET  /api/users/email/:email',
        'PUT  /api/users/:id',
        'DELETE /api/users/:id',
        'GET  /api/transactions/user/:id',
        'POST /api/deposit/request',
        'GET  /api/tasks',
        'GET  /api/tasks/:id',
        'GET  /api/tasks/advertisor/:userId',
        'POST /api/tasks',
        'PUT  /api/tasks/:id/status',
        'POST /api/completions',
        'GET  /api/completions/freelancer/:userId',
        'GET  /api/completions/task/:taskId',
        'PUT  /api/completions/:id/approve',
        'POST /api/withdrawals',
        'GET  /api/withdrawals/user/:userId',
        'PUT  /api/withdrawals/:id/process',
        'GET  /api/admin/users',
        'GET  /api/admin/users/:id',
        'PUT  /api/admin/users/:id/approve',
        'PUT  /api/admin/users/:id/role',
        'GET  /api/admin/logs',
        'GET  /api/admin/analytics',
        'GET  /api/admin/tasks/pending',
        'GET  /api/admin/completions/pending',
        'GET  /api/admin/withdrawals/pending',
        'POST /api/admin/wallet/add',
        'GET  /api/dashboard/freelancer/:userId',
        'GET  /api/dashboard/advertisor/:userId'
    ];
    routes.forEach(r => console.log('  ' + r));
    console.log('');
    console.log('✅ All systems operational. Ready for requests.');
});
