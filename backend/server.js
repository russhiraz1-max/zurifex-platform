// ============================================================
// ZURIFEX PLATFORM - COMPLETE BACKEND
// Full API + Telegram Bot Integration
// ============================================================

const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const { createClient } = require('@supabase/supabase-js');
const { OAuth2Client } = require('google-auth-library');
const path = require('path');

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// ============================================================
// TELEGRAM BOT INTEGRATION (IMPROVED)
// ============================================================
let botFunctions = {};
let botConnected = false;

try {
    // Try multiple possible paths for the bot module
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
        console.warn('   To enable: Create telegram-bot/bot.js with your bot configuration');
    }
} catch (error) {
    console.warn('⚠️ Telegram bot integration not available:', error.message);
}

// ============================================================
// NOTIFICATION HELPER
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
// MIDDLEWARE
// ============================================================
app.use(cors({
    origin: [
        'http://localhost:3000',
        'http://localhost:5000',
        'http://localhost:5500',
        'https://zurifex.netlify.app',
        'https://zurifex.com'
    ],
    credentials: true
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

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
// TEST ROUTE
// ============================================================
app.get('/', (req, res) => {
    res.json({
        message: 'Zurifex API is running 🇰🇪',
        status: 'online',
        bot: botConnected ? 'connected ✅' : 'disabled ⚠️',
        timestamp: new Date().toISOString()
    });
});

// ============================================================
// HEALTH CHECK
// ============================================================
app.get('/api/health', (req, res) => {
    res.json({
        status: 'healthy',
        bot: botConnected,
        uptime: process.uptime(),
        timestamp: new Date().toISOString()
    });
});

// ============================================================
// TEST BOT NOTIFICATION (GET + POST)
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
// AUTH ROUTE - Google Sign In
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

        if (error) {
            return res.status(404).json({ error: 'User not found' });
        }

        return res.json({ user });
    } catch (error) {
        return res.status(500).json({ error: 'Server error' });
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

        if (error) {
            return res.status(400).json({ error: 'Update failed' });
        }

        return res.json({ success: true, user });
    } catch (error) {
        return res.status(500).json({ error: 'Server error' });
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

        if (error) {
            return res.status(400).json({ error: 'Failed to fetch transactions' });
        }

        return res.json({ transactions: transactions || [] });
    } catch (error) {
        return res.status(500).json({ error: 'Server error' });
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

        if (error) {
            return res.status(400).json({ error: 'Failed to fetch tasks' });
        }

        return res.json({ tasks: tasks || [] });
    } catch (error) {
        return res.status(500).json({ error: 'Server error' });
    }
});

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
// COMPLETION ROUTES
// ============================================================
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
// WITHDRAWAL ROUTES
// ============================================================
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
// ADMIN ROUTES
// ============================================================
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

app.put('/api/admin/users/:id/approve', async (req, res) => {
    try {
        const { id } = req.params;
        const { admin_id } = req.body;

        const { data: user, error } = await supabase
            .from('users')
            .update({
                is_approved: true
            })
            .eq('id', id)
            .eq('role', 'advertisor')
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
                action: 'approve_advertisor',
                target_type: 'user',
                target_id: id,
                details: { user: user }
            });

        // Send notification
        notifyBot('notifyAdvertisorApproved', {
            full_name: user.full_name,
            email: user.email
        });

        return res.json({
            success: true,
            message: 'Advertisor approved',
            user
        });
    } catch (error) {
        return res.status(500).json({ error: 'Server error' });
    }
});

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

app.post('/api/admin/wallet/add', async (req, res) => {
    try {
        const { user_id, amount, description, admin_id } = req.body;

        if (amount <= 0) {
            return res.status(400).json({ error: 'Amount must be positive' });
        }

        // Get user
        const { data: user, error: userError } = await supabase
            .from('users')
            .select('wallet_balance, full_name, email')
            .eq('id', user_id)
            .single();

        if (userError) {
            return res.status(404).json({ error: 'User not found' });
        }

        // Update balance
        const newBalance = user.wallet_balance + amount;
        const { data: updated, error: updateError } = await supabase
            .from('users')
            .update({
                wallet_balance: newBalance
            })
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

        return res.json({
            stats: {
                wallet_balance: user.wallet_balance || 0,
                total_earned: user.total_earned || 0,
                total_withdrawn: user.total_withdrawn || 0,
                completed_tasks: completedCount || 0,
                pending_tasks: pendingCount || 0
            }
        });
    } catch (error) {
        return res.status(500).json({ error: 'Server error' });
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

        return res.json({
            stats: {
                wallet_balance: user.wallet_balance || 0,
                is_approved: user.is_approved || false,
                active_tasks: activeTasks,
                pending_tasks: pendingTasks,
                completed_tasks: completedTasks,
                total_tasks: tasks.length
            }
        });
    } catch (error) {
        return res.status(500).json({ error: 'Server error' });
    }
});

// ============================================================
// ERROR HANDLING MIDDLEWARE
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
// 404 HANDLER
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
// START SERVER
// ============================================================
app.listen(PORT, () => {
    console.log('🔥 Zurifex API running on http://localhost:' + PORT);
    console.log('🇰🇪 Environment: ' + (process.env.NODE_ENV || 'development'));
    console.log('🤖 Telegram Bot: ' + (botConnected ? '✅ Connected' : '⚠️ Disabled'));
    console.log('');
    console.log('📋 Available Routes:');
    console.log('  GET  /                          - API Status');
    console.log('  GET  /api/health                - Health Check');
    console.log('  GET  /api/test/notification     - Test Bot Notification (GET)');
    console.log('  POST /api/test/notification     - Test Bot Notification (POST)');
    console.log('  POST /api/auth/google           - Google Sign In');
    console.log('  GET  /api/users/:id             - Get User');
    console.log('  PUT  /api/users/:id             - Update User');
    console.log('  GET  /api/tasks                 - Get All Tasks');
    console.log('  GET  /api/tasks/:id             - Get Task');
    console.log('  POST /api/tasks                 - Create Task');
    console.log('  GET  /api/tasks/advertisor/:id  - Get Advertisor Tasks');
    console.log('  POST /api/completions           - Submit Completion');
    console.log('  GET  /api/completions/freelancer/:id - Get Freelancer Completions');
    console.log('  PUT  /api/completions/:id/approve - Approve Completion');
    console.log('  POST /api/withdrawals           - Request Withdrawal');
    console.log('  GET  /api/withdrawals/user/:id  - Get Withdrawals');
    console.log('  PUT  /api/withdrawals/:id/process - Process Withdrawal');
    console.log('  GET  /api/admin/users           - Get All Users (Admin)');
    console.log('  PUT  /api/admin/users/:id/approve - Approve Advertisor');
    console.log('  GET  /api/admin/tasks/pending   - Get Pending Tasks');
    console.log('  GET  /api/admin/completions/pending - Get Pending Completions');
    console.log('  GET  /api/admin/withdrawals/pending - Get Pending Withdrawals');
    console.log('  POST /api/admin/wallet/add      - Add Funds (Admin)');
    console.log('');
    console.log('✅ All systems operational. Ready for requests.');
});