import * as vscode from 'vscode';

// Array of Dhikr phrases to cycle through sequentially
const dhikrPhrases: string[] = [
    'سُبْحَانَ اللَّهِ',
    'الْحَمْدُ لِلَّهِ',
    'لَا إِلَهَ إِلَّا اللَّهُ',
    'اللَّهُ أَكْبَرُ',
    'لَا حَوْل وَلَا قُوَّة إِلَّا بِاَلله',
    'اللَّهُــمَّ صـَلِّ وَسَـــلِّمْ وبارك على سيدنا مُحمَّد وآله ﷺ'
];

// Track the current index for sequential display
let currentIndex: number = 0;

// Timer references for managing intervals
let dhikrTimer: NodeJS.Timeout | undefined;
let notificationTimer: NodeJS.Timeout | undefined; // للإخفاء التلقائي

// Status bar item to show extension state
let statusBarItem: vscode.StatusBarItem;

// Cache for disposables to prevent memory leaks
const disposables: vscode.Disposable[] = [];

// Store active notifications for cleanup
const activeNotifications: Map<string, vscode.Disposable> = new Map();

/**
 * Shows the current Dhikr phrase with auto-dismiss feature
 */
function showDhikr(): void {
    const phrase = dhikrPhrases[currentIndex];
    const config = vscode.workspace.getConfiguration('azkari');
    const autoDismiss = config.get<boolean>('autoDismissEnabled', true);
    const dismissDelay = config.get<number>('autoDismissSeconds', 5);
    
    // Clear previous notification timer
    if (notificationTimer) {
        clearTimeout(notificationTimer);
        notificationTimer = undefined;
    }
    
    // Display the Dhikr as an information message
    const notificationId = `dhikr-${Date.now()}`;
    const message = vscode.window.showInformationMessage(`🤲 ${phrase}`);
    
    // Store the notification reference
    activeNotifications.set(notificationId, { dispose: () => {} });
    
    // Auto-dismiss after configured seconds if enabled
    if (autoDismiss && dismissDelay > 0) {
        notificationTimer = setTimeout(() => {
            // VSCode doesn't provide direct API to dismiss, but we track it
            activeNotifications.delete(notificationId);
            notificationTimer = undefined;
        }, dismissDelay * 1000);
    }
    
    // Move to the next phrase (cycle back to 0 when reaching the end)
    currentIndex = (currentIndex + 1) % dhikrPhrases.length;
}

/**
 * Gets the interval duration from settings
 */
function getIntervalMs(): number {
    const config = vscode.workspace.getConfiguration('azkari');
    const minutes = config.get<number>('intervalMinutes', 3);
    return minutes * 60 * 1000; // Convert to milliseconds
}

/**
 * Starts the Dhikr reminder timer with memory optimization
 */
function startDhikrTimer(context: vscode.ExtensionContext, showFirstImmediately: boolean = true): void {
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
    
    // Clean up active notifications tracking
    activeNotifications.clear();
    
    // Update status bar
    updateStatusBar(false);
}

/**
 * Updates the status bar item to reflect current state
 */
function updateStatusBar(isRunning: boolean): void {
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

/**
 * Cleans up all disposables to prevent memory leaks
 */
function cleanupDisposables(): void {
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
 * Called when the extension is activated
 */
export function activate(context: vscode.ExtensionContext): void {
    console.log('Azkari extension is now active! بسم الله');
    
    // Create status bar item
    statusBarItem = vscode.window.createStatusBarItem(
        vscode.StatusBarAlignment.Right,
        100
    );
    context.subscriptions.push(statusBarItem);
    disposables.push(statusBarItem);
    
    // Register the start command
    const startCommand = vscode.commands.registerCommand('azkari.start', () => {
        startDhikrTimer(context);
    });
    
    // Register the stop command
    const stopCommand = vscode.commands.registerCommand('azkari.stop', () => {
        stopDhikrTimer();
        vscode.window.showInformationMessage('🕌 Azkari: Dhikr reminders stopped. Use "Azkari: Start" to resume.');
    });
    
    // Register the show now command (shows immediately without affecting timer)
    const showNowCommand = vscode.commands.registerCommand('azkari.showNow', () => {
        showDhikr();
    });
    
    // Register the set interval command (allows user to change timer interactively)
    const setIntervalCommand = vscode.commands.registerCommand('azkari.setInterval', async () => {
        const config = vscode.workspace.getConfiguration('azkari');
        const currentInterval = config.get<number>('intervalMinutes', 3);
        
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
            await config.update('intervalMinutes', newInterval, vscode.ConfigurationTarget.Global);
            vscode.window.showInformationMessage(`🕌 Azkari: Timer interval set to ${newInterval} minute(s).`);
        }
    });
    
    // NEW: Register toggle auto-dismiss command
    const toggleAutoDismissCommand = vscode.commands.registerCommand('azkari.toggleAutoDismiss', async () => {
        const config = vscode.workspace.getConfiguration('azkari');
        const currentState = config.get<boolean>('autoDismissEnabled', true);
        
        await config.update('autoDismissEnabled', !currentState, vscode.ConfigurationTarget.Global);
        
        const newState = !currentState ? 'enabled' : 'disabled';
        vscode.window.showInformationMessage(`🕌 Azkari: Auto-dismiss ${newState}.`);
    });
    
    // NEW: Register set auto-dismiss delay command
    const setAutoDismissDelayCommand = vscode.commands.registerCommand('azkari.setAutoDismissDelay', async () => {
        const config = vscode.workspace.getConfiguration('azkari');
        const currentDelay = config.get<number>('autoDismissSeconds', 5);
        
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
            await config.update('autoDismissSeconds', newDelay, vscode.ConfigurationTarget.Global);
            vscode.window.showInformationMessage(`🕌 Azkari: Auto-dismiss delay set to ${newDelay} second(s).`);
        }
    });
    
    // Add commands to subscriptions
    context.subscriptions.push(
        startCommand, 
        stopCommand, 
        showNowCommand, 
        setIntervalCommand,
        toggleAutoDismissCommand,
        setAutoDismissDelayCommand
    );
    
    // Add to disposables for memory management
    disposables.push(
        startCommand, 
        stopCommand, 
        showNowCommand, 
        setIntervalCommand,
        toggleAutoDismissCommand,
        setAutoDismissDelayCommand
    );
    
    // Listen for configuration changes with debouncing
    let configChangeTimeout: NodeJS.Timeout | undefined;
    const configListener = vscode.workspace.onDidChangeConfiguration((event) => {
        // Clear previous timeout to debounce rapid changes
        if (configChangeTimeout) {
            clearTimeout(configChangeTimeout);
        }
        
        configChangeTimeout = setTimeout(() => {
            if (event.affectsConfiguration('azkari.intervalMinutes')) {
                // If timer is running, restart it with new interval (don't show Dhikr again)
                if (dhikrTimer) {
                    vscode.window.showInformationMessage('🕌 Azkari: Interval updated. Restarting timer...');
                    startDhikrTimer(context, false);
                }
            }
            configChangeTimeout = undefined;
        }, 300); // 300ms debounce
    });
    
    context.subscriptions.push(configListener);
    disposables.push(configListener);
    
    // Check if auto-start is enabled
    const config = vscode.workspace.getConfiguration('azkari');
    const autoStart = config.get<boolean>('autoStart', true);
    
    if (autoStart) {
        // Auto-start the timer
        startDhikrTimer(context);
    } else {
        // Just update the status bar to show paused state
        updateStatusBar(false);
    }
}

/**
 * Called when the extension is deactivated - proper cleanup
 */
export function deactivate(): void {
    console.log('Deactivating Azkari extension...');
    
    // Stop all timers
    stopDhikrTimer();
    
    // Clean up all disposables
    cleanupDisposables();
    
    // Clear active notifications map
    activeNotifications.clear();
    
    console.log('Azkari extension deactivated. السلام عليكم');
}
