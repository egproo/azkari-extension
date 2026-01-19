import * as vscode from 'vscode';

// ==================== TYPES & INTERFACES ====================

interface DhikrStats {
    totalShown: number;
    lastShownDate: string;
    todayCount: number;
    weekCount: number;
    monthCount: number;
}

// ==================== CONSTANTS ====================

const dhikrPhrases: string[] = [
    'أَسْتَغْفِرُ اللَّه',    
    'سُبْحَانَ اللَّه',
    'الْحَمْدُ لِلَّه',
    'لَا إِلَهَ إِلَّا اللَّه',
    'اللَّهُ أَكْبَر',
    'لَا حَوْل وَلَا قُوَّة إِلَّا بِاَلله',
    'اللَّهُــمَّ صـَلِّ وَسَـــلِّمْ وبارك على سيدنا مُحمَّد وآله ﷺ'
];

const STORAGE_KEY = 'azkari.statistics';

// ==================== STATE MANAGEMENT ====================

let currentIndex: number = 0;
let dhikrTimer: NodeJS.Timeout | undefined;
let notificationTimer: NodeJS.Timeout | undefined;
let statusBarItem: vscode.StatusBarItem;
let context: vscode.ExtensionContext;

// Memory management
const disposables: vscode.Disposable[] = [];
const activeNotifications = new Map<string, NodeJS.Timeout>();

// ==================== UTILITY FUNCTIONS ====================

/**
 * Get configuration value with type safety
 */
function getConfig<T>(key: string, defaultValue: T): T {
    return vscode.workspace.getConfiguration('azkari').get<T>(key, defaultValue);
}

/**
 * Update configuration value
 */
async function updateConfig(key: string, value: any): Promise<void> {
    await vscode.workspace.getConfiguration('azkari')
        .update(key, value, vscode.ConfigurationTarget.Global);
}

/**
 * Check if current time is within quiet hours
 */
function isQuietHours(): boolean {
    const quietEnabled = getConfig('quietHoursEnabled', false);
    if (!quietEnabled) return false;

    const now = new Date();
    const currentTime = now.getHours() * 60 + now.getMinutes();
    
    const startTime = parseTimeString(getConfig('quietHoursStart', '22:00'));
    const endTime = parseTimeString(getConfig('quietHoursEnd', '08:00'));

    // Handle overnight quiet hours (e.g., 22:00 to 08:00)
    if (startTime > endTime) {
        return currentTime >= startTime || currentTime < endTime;
    }
    
    return currentTime >= startTime && currentTime < endTime;
}

/**
 * Parse time string (HH:MM) to minutes since midnight
 */
function parseTimeString(timeStr: string): number {
    const [hours, minutes] = timeStr.split(':').map(Number);
    return hours * 60 + minutes;
}

/**
 * Get interval duration from settings in milliseconds
 */
function getIntervalMs(): number {
    const minutes = getConfig('intervalMinutes', 3);
    return minutes * 60 * 1000;
}

/**
 * Get random Dhikr index
 */
function getRandomIndex(): number {
    return Math.floor(Math.random() * dhikrPhrases.length);
}

/**
 * Get next Dhikr index based on mode
 */
function getNextDhikrIndex(): number {
    const mode = getConfig('dhikrMode', 'sequential');
    
    switch (mode) {
        case 'random':
            return getRandomIndex();
        case 'single-favorite':
            return 0; // Always show first one (user can customize)
        case 'sequential':
        default:
            const nextIndex = (currentIndex + 1) % dhikrPhrases.length;
            currentIndex = nextIndex;
            return currentIndex;
    }
}

// ==================== STATISTICS MANAGEMENT ====================

/**
 * Get current statistics from storage
 */
function getStats(): DhikrStats {
    const stored = context.globalState.get<DhikrStats>(STORAGE_KEY);
    
    if (!stored) {
        return {
            totalShown: 0,
            lastShownDate: new Date().toISOString(),
            todayCount: 0,
            weekCount: 0,
            monthCount: 0
        };
    }
    
    return stored;
}

/**
 * Update statistics after showing Dhikr
 */
async function updateStats(): Promise<void> {
    if (!getConfig('enableStatistics', true)) return;

    const stats = getStats();
    const now = new Date();
    const today = now.toISOString().split('T')[0];
    const lastShownDate = new Date(stats.lastShownDate).toISOString().split('T')[0];

    // Reset daily counter if it's a new day
    if (today !== lastShownDate) {
        stats.todayCount = 0;
    }

    // Calculate week and month differences
    const lastDate = new Date(stats.lastShownDate);
    const daysDiff = Math.floor((now.getTime() - lastDate.getTime()) / (1000 * 60 * 60 * 24));
    
    if (daysDiff >= 7) {
        stats.weekCount = 0;
    }
    
    if (daysDiff >= 30) {
        stats.monthCount = 0;
    }

    // Increment counters
    stats.totalShown++;
    stats.todayCount++;
    stats.weekCount++;
    stats.monthCount++;
    stats.lastShownDate = now.toISOString();

    await context.globalState.update(STORAGE_KEY, stats);
}

/**
 * Show statistics in information message
 */
function showStatistics(): void {
    const stats = getStats();
    
    const message = `
📊 **Azkari Statistics**

🔢 Total Dhikr shown: ${stats.totalShown}
📅 Today: ${stats.todayCount}
📆 This week: ${stats.weekCount}
🗓️ This month: ${stats.monthCount}

بارك الله فيك! Keep up the good work! 💚
    `.trim();

    vscode.window.showInformationMessage(message);
}

/**
 * Reset all statistics
 */
async function resetStats(): Promise<void> {
    const confirm = await vscode.window.showWarningMessage(
        'Are you sure you want to reset all statistics?',
        { modal: true },
        'Yes, Reset',
        'Cancel'
    );

    if (confirm === 'Yes, Reset') {
        await context.globalState.update(STORAGE_KEY, undefined);
        vscode.window.showInformationMessage('📊 Statistics have been reset.');
    }
}

// ==================== DHIKR DISPLAY ====================

/**
 * Shows the current Dhikr phrase with smart notification management
 */
async function showDhikr(): Promise<void> {
    // Check quiet hours
    if (isQuietHours()) {
        console.log('Azkari: Skipping notification (quiet hours)');
        return;
    }

    const index = getNextDhikrIndex();
    const phrase = dhikrPhrases[index];
    
    const autoDismiss = getConfig('autoDismissEnabled', true);
    const dismissDelay = getConfig('autoDismissSeconds', 5);
    const notificationMode = getConfig('notificationPosition', 'notification');

    // Clear previous notification timer to prevent memory buildup
    if (notificationTimer) {
        clearTimeout(notificationTimer);
        notificationTimer = undefined;
    }

    // Update statistics
    await updateStats();

    // Display based on mode
    if (notificationMode === 'notification') {
        const notificationId = `dhikr-${Date.now()}`;
        
        // Show notification
        vscode.window.showInformationMessage(`🤲 ${phrase}`);

        // Setup auto-dismiss if enabled
        if (autoDismiss && dismissDelay > 0) {
            const timer = setTimeout(() => {
                activeNotifications.delete(notificationId);
            }, dismissDelay * 1000);
            
            activeNotifications.set(notificationId, timer);
        }
    } else {
        // Status bar only mode - less intrusive
        statusBarItem.text = `🤲 ${phrase}`;
        
        // Revert to normal icon after delay
        if (autoDismiss && dismissDelay > 0) {
            notificationTimer = setTimeout(() => {
                updateStatusBar(true);
            }, dismissDelay * 1000);
        }
    }

    // Play sound if enabled (placeholder for future implementation)
    if (getConfig('playSound', false)) {
        // TODO: Implement sound playback
        console.log('🔔 Sound would play here');
    }
}

// ==================== TIMER MANAGEMENT ====================

/**
 * Starts the Dhikr reminder timer with memory optimization
 */
function startDhikrTimer(showFirstImmediately: boolean = true): void {
    // Clear any existing timer to prevent memory leaks
    stopDhikrTimer();
    
    const intervalMs = getIntervalMs();
    
    // Show the first Dhikr immediately when starting
    if (showFirstImmediately) {
        showDhikr();
    }
    
    // Set up the recurring timer with proper cleanup
    dhikrTimer = setInterval(() => {
        showDhikr();
    }, intervalMs);
    
    // Update status bar
    updateStatusBar(true);
    
    // Show confirmation message
    const minutes = intervalMs / 60000;
    vscode.window.showInformationMessage(
        `🕌 Azkari: Dhikr reminders active! Next reminder in ${minutes} minute(s). بارك الله فيك`
    );
}

/**
 * Stops the Dhikr reminder timer and cleans up resources
 */
function stopDhikrTimer(): void {
    // Clear main timer
    if (dhikrTimer) {
        clearInterval(dhikrTimer);
        dhikrTimer = undefined;
    }
    
    // Clear notification auto-dismiss timer
    if (notificationTimer) {
        clearTimeout(notificationTimer);
        notificationTimer = undefined;
    }
    
    // Clean up all active notification timers
    activeNotifications.forEach((timer) => clearTimeout(timer));
    activeNotifications.clear();
    
    // Update status bar
    updateStatusBar(false);
}

/**
 * Updates the status bar item to reflect current state
 */
function updateStatusBar(isRunning: boolean): void {
    if (!getConfig('showInStatusBar', true)) {
        statusBarItem.hide();
        return;
    }

    if (isRunning) {
        statusBarItem.text = '$(heart) Azkari';
        statusBarItem.tooltip = 'Azkari: Dhikr reminders are active. Click to stop.';
        statusBarItem.command = 'azkari.stop';
        statusBarItem.backgroundColor = undefined;
    } else {
        statusBarItem.text = '$(circle-outline) Azkari';
        statusBarItem.tooltip = 'Azkari: Dhikr reminders are paused. Click to start.';
        statusBarItem.command = 'azkari.start';
        statusBarItem.backgroundColor = new vscode.ThemeColor('statusBarItem.warningBackground');
    }
    
    statusBarItem.show();
}

// ==================== CLEANUP ====================

/**
 * Cleans up all disposables to prevent memory leaks
 */
function cleanupDisposables(): void {
    console.log(`Cleaning up ${disposables.length} disposables...`);
    
    disposables.forEach(d => {
        try {
            d.dispose();
        } catch (error) {
            console.error('Error disposing resource:', error);
        }
    });
    
    disposables.length = 0; // Clear array
}

/**
 * Clear all notification timers
 */
function clearAllNotificationTimers(): void {
    activeNotifications.forEach((timer) => {
        try {
            clearTimeout(timer);
        } catch (error) {
            console.error('Error clearing notification timer:', error);
        }
    });
    activeNotifications.clear();
}

// ==================== COMMAND HANDLERS ====================

function registerCommands(extensionContext: vscode.ExtensionContext): void {
    // Start command
    const startCommand = vscode.commands.registerCommand('azkari.start', () => {
        startDhikrTimer(true);
    });

    // Stop command
    const stopCommand = vscode.commands.registerCommand('azkari.stop', () => {
        stopDhikrTimer();
        vscode.window.showInformationMessage(
            '🕌 Azkari: Dhikr reminders stopped. Use "Azkari: Start" to resume.'
        );
    });

    // Show now command
    const showNowCommand = vscode.commands.registerCommand('azkari.showNow', () => {
        showDhikr();
    });

    // Set interval command
    const setIntervalCommand = vscode.commands.registerCommand('azkari.setInterval', async () => {
        const currentInterval = getConfig('intervalMinutes', 3);
        
        const input = await vscode.window.showInputBox({
            prompt: 'Enter the interval in minutes between Dhikr reminders',
            placeHolder: 'e.g., 3',
            value: currentInterval.toString(),
            validateInput: (value) => {
                const num = parseInt(value, 10);
                if (isNaN(num) || num < 1 || num > 60) {
                    return 'Please enter a number between 1 and 60';
                }
                return null;
            }
        });
        
        if (input !== undefined) {
            const newInterval = parseInt(input, 10);
            await updateConfig('intervalMinutes', newInterval);
            vscode.window.showInformationMessage(
                `🕌 Azkari: Timer interval set to ${newInterval} minute(s).`
            );
        }
    });

    // Toggle auto-dismiss command
    const toggleAutoDismissCommand = vscode.commands.registerCommand('azkari.toggleAutoDismiss', async () => {
        const currentState = getConfig('autoDismissEnabled', true);
        await updateConfig('autoDismissEnabled', !currentState);
        
        const newState = !currentState ? 'enabled' : 'disabled';
        vscode.window.showInformationMessage(
            `🕌 Azkari: Auto-dismiss ${newState}.`
        );
    });

    // Set auto-dismiss delay command
    const setAutoDismissDelayCommand = vscode.commands.registerCommand('azkari.setAutoDismissDelay', async () => {
        const currentDelay = getConfig('autoDismissSeconds', 5);
        
        const input = await vscode.window.showInputBox({
            prompt: 'Enter auto-dismiss delay in seconds',
            placeHolder: 'e.g., 5',
            value: currentDelay.toString(),
            validateInput: (value) => {
                const num = parseInt(value, 10);
                if (isNaN(num) || num < 1 || num > 60) {
                    return 'Please enter a number between 1 and 60';
                }
                return null;
            }
        });
        
        if (input !== undefined) {
            const newDelay = parseInt(input, 10);
            await updateConfig('autoDismissSeconds', newDelay);
            vscode.window.showInformationMessage(
                `🕌 Azkari: Auto-dismiss delay set to ${newDelay} second(s).`
            );
        }
    });

    // Show statistics command
    const showStatsCommand = vscode.commands.registerCommand('azkari.showStats', () => {
        showStatistics();
    });

    // Reset counter command
    const resetCounterCommand = vscode.commands.registerCommand('azkari.resetCounter', () => {
        resetStats();
    });

    // Register all commands
    const commands = [
        startCommand,
        stopCommand,
        showNowCommand,
        setIntervalCommand,
        toggleAutoDismissCommand,
        setAutoDismissDelayCommand,
        showStatsCommand,
        resetCounterCommand
    ];

    commands.forEach(cmd => {
        extensionContext.subscriptions.push(cmd);
        disposables.push(cmd);
    });
}

// ==================== ACTIVATION & DEACTIVATION ====================

/**
 * Called when the extension is activated
 */
export function activate(extensionContext: vscode.ExtensionContext): void {
    console.log('🕌 Azkari extension is now active! بسم الله');
    
    // Store context globally
    context = extensionContext;
    
    // Create status bar item
    statusBarItem = vscode.window.createStatusBarItem(
        vscode.StatusBarAlignment.Right,
        100
    );
    extensionContext.subscriptions.push(statusBarItem);
    disposables.push(statusBarItem);
    
    // Register all commands
    registerCommands(extensionContext);
    
    // Listen for configuration changes with debouncing
    let configChangeTimeout: NodeJS.Timeout | undefined;
    const configListener = vscode.workspace.onDidChangeConfiguration((event) => {
        // Clear previous timeout to debounce rapid changes
        if (configChangeTimeout) {
            clearTimeout(configChangeTimeout);
        }
        
        configChangeTimeout = setTimeout(() => {
            if (event.affectsConfiguration('azkari.intervalMinutes')) {
                // If timer is running, restart it with new interval
                if (dhikrTimer) {
                    vscode.window.showInformationMessage(
                        '🕌 Azkari: Interval updated. Restarting timer...'
                    );
                    startDhikrTimer(false);
                }
            }
            
            if (event.affectsConfiguration('azkari.showInStatusBar')) {
                updateStatusBar(!!dhikrTimer);
            }
            
            configChangeTimeout = undefined;
        }, 300); // 300ms debounce
    });
    
    extensionContext.subscriptions.push(configListener);
    disposables.push(configListener);
    
    // Check if auto-start is enabled
    const autoStart = getConfig('autoStart', true);
    
    if (autoStart) {
        startDhikrTimer(true);
    } else {
        updateStatusBar(false);
    }
    
    console.log('✅ Azkari extension fully activated');
}

/**
 * Called when the extension is deactivated - proper cleanup
 */
export function deactivate(): void {
    console.log('🔄 Deactivating Azkari extension...');
    
    // Stop all timers
    stopDhikrTimer();
    
    // Clear all notification timers
    clearAllNotificationTimers();
    
    // Clean up all disposables
    cleanupDisposables();
    
    console.log('✅ Azkari extension deactivated. السلام عليكم');
}
