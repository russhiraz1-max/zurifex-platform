// ============================================================
//  ███████╗██╗░░░██╗██████╗░██╗███████╗███████╗██╗░░██╗
//  ╚══███╔╝██║░░░██║██╔══██╗██║██╔════╝██╔════╝╚██╗██╔╝
//  ░░██╔╝░██║░░░██║██████╔╝██║█████╗░░█████╗░░░╚███╔╝░
//  ░██╔╝░░██║░░░██║██╔══██╗██║██╔══╝░░██╔══╝░░░██╔██╗░
//  ███████╗╚██████╔╝██║░░██║██║███████╗███████╗██╔╝╚██╗
//  ╚══════╝░╚═════╝░╚═╝░░╚═╝╚═╝╚══════╝╚══════╝╚═╝░░╚═╝
// ============================================================
// ZURIFEX PLATFORM - COMPLETE BACKEND
// Full API + Telegram Bot + Admin + Deposit Management
// Version: 9.0.0 (ULTIMATE FINAL EDITION)
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
// TELEGRAM BOT INTEGRATION
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
                break;
            }
        } catch (e) { /* try next */ }
    }
    if (botConnected) {
        console.log('✅ Telegram bot integration loaded successfully');
    } else {
        console.warn('⚠️ Telegram bot not available');
    }
} catch (error) {
    console.warn('⚠️ Telegram bot integration not available:', error.message);
}

function notifyBot(functionName, ...args) {
    if (!botConnected || !botFunctions[functionName]) return;
    try {
        botFunctions[functionName](...args);
    } catch (error) {
        console.error('❌ Bot notification failed:', error.message);
    }
}

// ============================================================
// MIDDLEWARE
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
// LOGGING
// ============================================================
app.use((req, res, next) => {
    const start = Date.now();
    res.on('finish', () => {
        const duration = Date.now() - start;
        console.log(`[${new Date().toISOString()}] ${req.method} ${req.path} - ${res.statusCode} - ${duration}ms`);
    });
    next();
});

// ============================================================
// SUPABASE CLIENTS
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
// GOOGLE AUTH CLIENT
// ============================================================
const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

// ============================================================
// UTILITY FUNCTIONS
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
function isValidEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}
function daysAgo(days) {
    const d = new Date();
    d.setDate(d.getDate() - days);
    return d.toISOString();
}

// ============================================================
// TEST ROUTES
// ============================================================
app.get('/', (req, res) => {
    res.json({
        name: 'Zurifex API',
        version: '9.0.0',
        message: 'Zurifex API is running 🇰🇪',
        status: 'online',
        bot: botConnected ? 'connected ✅' : 'disabled ⚠️',
        timestamp: new Date().toISOString()
    });
});

app.get('/api/health', (req, res) => {
    res.json({
        status: 'healthy',
        bot: botConnected,
        uptime: process.uptime(),
        timestamp: new Date().toISOString()
    });
});

app.get('/api/test/notification', async (req, res) => {
    try {
        const message = req.query.message || 'Test notification';
        if (!botConnected) return res.status(400).json({ error: 'Bot not connected' });
        notifyBot('notifyTest', message);
        res.json({ success: true, message: 'Test notification sent' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/test/notification', async (req, res) => {
    try {
        const message = req.body.message || 'Test notification';
        if (!botConnected) return res.status(400).json({ error: 'Bot not connected' });
        notifyBot('notifyTest', message);
        res.json({ success: true, message: 'Test notification sent' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ============================================================
// PUBLIC STATS
// ============================================================
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

// ============================================================
// ADMIN ANALYTICS
// ============================================================
app.get('/api/admin/analytics', async (req, res) => {
    try {
        const { count: totalUsers } = await supabase.from('users').select('*', { count: 'exact', head: true });
        const { count: totalTasks } = await supabase.from('tasks').select('*', { count: 'exact', head: true });
        const { count: activeTasks } = await supabase.from('tasks').select('*', { count: 'exact', head: true }).eq('status', 'active');
        const { count: pendingTasks } = await supabase.from('tasks').select('*', { count: 'exact', head: true }).eq('status', 'pending');
        const { count: completedTasks } = await supabase.from('tasks').select('*', { count: 'exact', head: true }).eq('status', 'completed');
        const { count: totalCompletions } = await supabase.from('task_completions').select('*', { count: 'exact', head: true });
        const { count: pendingCompletions } = await supabase.from('task_completions').select('*', { count: 'exact', head: true }).eq('status', 'pending');
        const { count: approvedCompletions } = await supabase.from('task_completions').select('*', { count: 'exact', head: true }).eq('status', 'approved');
        const { data: usersByRole } = await supabase.from('users').select('role');
        let freelancers = 0, advertisers = 0, admins = 0;
        if (usersByRole) {
            usersByRole.forEach(u => {
                if (u.role === 'freelancer') freelancers++;
                else if (u.role === 'advertisor') advertisers++;
                else if (u.role === 'admin') admins++;
            });
        }
        const { data: earnings } = await supabase.from('transactions').select('amount').eq('type', 'task_payment').eq('status', 'completed');
        let totalEarnings = 0;
        if (earnings) earnings.forEach(t => { totalEarnings += t.amount || 0; });
        const { data: withdrawn } = await supabase.from('transactions').select('amount').eq('type', 'withdrawal').eq('status', 'completed');
        let totalWithdrawn = 0;
        if (withdrawn) withdrawn.forEach(t => { totalWithdrawn += Math.abs(t.amount) || 0; });
        const { count: pendingWithdrawals } = await supabase.from('withdrawal_requests').select('*', { count: 'exact', head: true }).eq('status', 'pending');
        const { count: pendingDeposits } = await supabase.from('transactions').select('*', { count: 'exact', head: true }).eq('type', 'deposit').eq('status', 'pending');
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
                pending_withdrawals: pendingWithdrawals || 0,
                pending_deposits: pendingDeposits || 0
            },
            daily_stats: dailyStats,
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ============================================================
// GOOGLE AUTH (FIXED – UPSERT)
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

        // 1. Check public.users
        let { data: existingUser, error: fetchError } = await supabase
            .from('users')
            .select('*')
            .eq('email', email)
            .single();

        if (existingUser) {
            // Update and return
            const { data: updatedUser, error: updateError } = await supabase
                .from('users')
                .update({ full_name: name, profile_photo_url: picture, is_verified: true })
                .eq('id', existingUser.id)
                .select()
                .single();
            if (updateError) {
                // Still return existing user
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

        // 2. Find auth user or create
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

        // 3. Insert profile – but handle duplicate keys
        let userData;
        let isNew = false;
        // Check if profile already exists for this authUserId
        const { data: existingProfile, error: profileCheck } = await supabase
            .from('users')
            .select('*')
            .eq('id', authUserId)
            .single();

        if (existingProfile) {
            // Update
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
            // Insert
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
                // If duplicate key, fetch existing
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
// USER ROUTES
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
// TRANSACTION ROUTES
// ============================================================
app.get('/api/transactions/user/:userId', async (req, res) => {
    try {
        const { userId } = req.params;
        const { data: transactions, error } = await supabase
            .from('transactions')
            .select('*')
            .eq('user_id', userId)
            .order('created_at', { ascending: false });
        if (error) return res.status(400).json({ error: 'Failed to fetch transactions' });
        res.json({ transactions: transactions || [] });
    } catch (error) {
        res.status(500).json({ error: 'Server error' });
    }
});

// ============================================================
// DEPOSIT REQUEST
// ============================================================
app.post('/api/deposit/request', async (req, res) => {
    try {
        const { user_id, amount, method, reference } = req.body;
        if (!user_id || !amount || amount <= 0 || !reference) {
            return res.status(400).json({ error: 'Invalid deposit request' });
        }
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
// ADMIN DEPOSIT MANAGEMENT
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

        // Update transaction
        const { error: updateError } = await supabase
            .from('transactions')
            .update({ status: 'completed' })
            .eq('id', deposit_id)
            .eq('type', 'deposit');
        if (updateError) return res.status(400).json({ error: 'Failed to update deposit' });

        // Add funds
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
// TASK ROUTES
// ============================================================
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
        if (error) return res.status(400).json({ error: 'Failed to fetch tasks' });
        res.json({ tasks: tasks || [] });
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

app.post('/api/tasks', async (req, res) => {
    try {
        const { title, description, category, budget_per_completion, total_budget, max_completions, advertisor_id, instructions, completion_requirements } = req.body;
        if (!title || !description || !category || !budget_per_completion || !total_budget || !max_completions || !advertisor_id) {
            return res.status(400).json({ error: 'Missing required fields' });
        }
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
                title, description, category, budget_per_completion, total_budget,
                remaining_budget: total_budget, max_completions, advertisor_id,
                instructions, completion_requirements, status: 'pending'
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

// ============================================================
// COMPLETION ROUTES
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
                task_id, freelancer_id,
                submission_text: submission_text || 'No submission text provided',
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

        // Update completion
        const { data: updated, error: updateError } = await supabase
            .from('task_completions')
            .update({ status: 'approved', completed_at: new Date().toISOString() })
            .eq('id', id)
            .select()
            .single();
        if (updateError) return res.status(400).json({ error: 'Failed to approve' });

        // Add to freelancer wallet
        const newBalance = (freelancer.wallet_balance || 0) + completion.amount_earned;
        const newTotalEarned = (freelancer.total_earned || 0) + completion.amount_earned;
        await supabase
            .from('users')
            .update({ wallet_balance: newBalance, total_earned: newTotalEarned })
            .eq('id', completion.freelancer_id);

        // Update task remaining
        const newRemaining = (task.remaining_budget || 0) - completion.amount_earned;
        await supabase
            .from('tasks')
            .update({ remaining_budget: newRemaining < 0 ? 0 : newRemaining, completed_count: supabase.raw('completed_count + 1') })
            .eq('id', completion.task_id);

        // Check if task complete
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

        // Transaction
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

// ============================================================
// WITHDRAWAL ROUTES
// ============================================================
app.post('/api/withdrawals', async (req, res) => {
    try {
        const { user_id, amount, payment_method, payment_details } = req.body;
        if (!user_id || !amount || !payment_method || !payment_details) {
            return res.status(400).json({ error: 'Missing required fields' });
        }
        const { data: user, error: userError } = await supabase
            .from('users')
            .select('wallet_balance, full_name, email')
            .eq('id', user_id)
            .single();
        if (userError) return res.status(404).json({ error: 'User not found' });
        if (user.wallet_balance < amount) return res.status(400).json({ error: 'Insufficient balance' });
        if (amount < 3) return res.status(400).json({ error: 'Minimum withdrawal is $3' });

        const fee = amount * 0.10;
        const netAmount = amount - fee;
        const { data: withdrawal, error } = await supabase
            .from('withdrawal_requests')
            .insert({
                user_id, amount, fee, net_amount: netAmount,
                payment_method, payment_details: payment_details,
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
// ADMIN ROUTES
// ============================================================
app.get('/api/admin/users', async (req, res) => {
    try {
        const { data: users, error } = await supabase
            .from('users')
            .select('*')
            .order('created_at', { ascending: false });
        if (error) return res.status(400).json({ error: 'Failed to fetch users' });
        res.json({ users });
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
        const { limit = 50, offset = 0 } = req.query;
        const { data: logs, error } = await supabase
            .from('admin_logs')
            .select('*, admin:admin_id(full_name, email)')
            .order('created_at', { ascending: false })
            .range(parseInt(offset), parseInt(offset) + parseInt(limit) - 1);
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
// DASHBOARD ROUTES
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
        res.json({
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
        res.json({
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
        res.status(500).json({ error: 'Server error' });
    }
});

// ============================================================
// ERROR HANDLING
// ============================================================
app.use((err, req, res, next) => {
    console.error('Global error:', err);
    notifyBot('notifyError', err, 'global');
    res.status(500).json({ error: 'Internal server error', message: err.message });
});

app.use((req, res) => {
    res.status(404).json({ error: 'Route not found', path: req.path });
});

// ============================================================
// START SERVER
// ============================================================
app.listen(PORT, () => {
    console.log('🔥 Zurifex API running on http://localhost:' + PORT);
    console.log('🇰🇪 Environment: ' + (process.env.NODE_ENV || 'development'));
    console.log('🤖 Telegram Bot: ' + (botConnected ? '✅ Connected' : '⚠️ Disabled'));
    console.log('✅ All systems operational. Ready for requests.');
});
