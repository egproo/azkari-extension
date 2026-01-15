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

// Timer reference for managing the interval
let dhikrTimer: NodeJS.Timeout | undefined;

// Status bar item to show extension state
let statusBarItem: vscode.StatusBarItem;

/**
 * Shows the current Dhikr phrase and advances to the next one
 */
function showDhikr(): void {
    const phrase = dhikrPhrases[currentIndex];
    
    // Display the Dhikr as an information message
    vscode.window.showInformationMessage(`🤲 ${phrase}`);
    
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
 * Starts the Dhikr reminder timer
 */
function startDhikrTimer(context: vscode.ExtensionContext, showFirstImmediately: boolean = true): void {
    // Clear any existing timer
    stopDhikrTimer();
    
    const intervalMs = getIntervalMs();
    
    // Show the first Dhikr immediately when starting
    if (showFirstImmediately) {
        showDhikr();
    }
    
    // Set up the recurring timer
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
 * Stops the Dhikr reminder timer
 */
function stopDhikrTimer(): void {
    if (dhikrTimer) {
        clearInterval(dhikrTimer);
        dhikrTimer = undefined;
    }
    
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
    
    // Add commands to subscriptions
    context.subscriptions.push(startCommand, stopCommand, showNowCommand, setIntervalCommand);
    
    // Listen for configuration changes
    const configListener = vscode.workspace.onDidChangeConfiguration((event) => {
        if (event.affectsConfiguration('azkari.intervalMinutes')) {
            // If timer is running, restart it with new interval (don't show Dhikr again)
            if (dhikrTimer) {
                vscode.window.showInformationMessage('🕌 Azkari: Interval updated. Restarting timer...');
                startDhikrTimer(context, false);
            }
        }
    });
    context.subscriptions.push(configListener);
    
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
 * Called when the extension is deactivated
 */
export function deactivate(): void {
    stopDhikrTimer();
    console.log('Azkari extension deactivated. السلام عليكم');
}
