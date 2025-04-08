const vscode = require('vscode');
const net = require('net');
const { spawn } = require('child_process');

let imeProcess = null;

/**
 * @param {vscode.ExtensionContext} context
 */
function activate(context) {
    console.log('"Caret InputTip" is now active!');

    // Default triangle color
    let triangleColor = 'red';

    // Create a decoration type for the triangle
    let triangleDecorationType = vscode.window.createTextEditorDecorationType({
        before: {
            contentText: '■', // The triangle symbol
            color: triangleColor, // Triangle color
            margin: '0 0 0 5px', // Adjust position to place it above the cursor
            textDecoration: `
                font-size: 20px;
            `,
        },
    });

    // Function to update the triangle decoration
    function updateTriangleDecoration() {
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
            return;
        }

        const cursorPosition = editor.selection.active; // Get the cursor position
        const decorationRange = new vscode.Range(cursorPosition, cursorPosition); // Create a range at the cursor position

        editor.setDecorations(triangleDecorationType, [
            { range: decorationRange },
        ]);
    }

    // Function to detect input method and caps lock state via IPC
    function detectInputMethodState() {
        const pipeName = '\\\\.\\pipe\\ime_pipe';

        const client = net.createConnection(pipeName, () => {
            // Listen for incoming data from the Python process
            client.on('data', (data) => {
                const response = data.toString().trim();
                const [inputMode, capsLockState] = response.split(',');

                // Handle input mode (1: Chinese, 0: English)
                let newColor = triangleColor;
                if (inputMode === '1') {
                    newColor = 'yellow'; // Chinese input method
                } else if (inputMode === '0') {
                    newColor = 'pink'; // English input method
                }

                // Handle caps lock state
                if (capsLockState === 'True') {
                    newColor = 'blue'; // Caps lock is on
                }

                // Update decoration type only if the color has changed
                if (newColor !== triangleColor) {
                    triangleColor = newColor;
                    triangleDecorationType.dispose();
                    triangleDecorationType = vscode.window.createTextEditorDecorationType({
                        before: {
                            contentText: '■',
                            color: triangleColor,
                            margin: '0 0 0 5px',
                            textDecoration: `
                                font-size: 20px;
                            `,
                        },
                    });

                    updateTriangleDecoration();
                }
            });
        });

        client.on('error', (err) => {
            console.error('Error detecting input method or caps lock state:', err);
            if (err.code === 'ENOENT') {
                // Retry after 1 second if the pipe is not found
                console.log('Retrying connection to pipe...');
                setTimeout(detectInputMethodState, 1000);
            }
        });
    }

    // Initial setup: Listen for input method and caps lock state
    detectInputMethodState();

    // Listen to cursor position changes
    const cursorChangeListener = vscode.window.onDidChangeTextEditorSelection(() => {
        updateTriangleDecoration();
    });

    // Listen to active editor changes
    const activeEditorChangeListener = vscode.window.onDidChangeActiveTextEditor(() => {
        updateTriangleDecoration();
    });

    // Push listeners to context subscriptions
    context.subscriptions.push(cursorChangeListener, activeEditorChangeListener);
    context.subscriptions.push(triangleDecorationType);

    // Start ime_checker.exe when the extension is activated
    startImeChecker();
}

/**
 * Function to start ime_checker.exe
 */
function startImeChecker() {
    if (imeProcess) return; // If the process is already running, don't start it again
    const path = require('path');
    const imePath = path.join(__dirname, 'ime_checker.exe');
    imeProcess = spawn(imePath, []);
    // imeProcess = spawn('ime_checker.exe', []);

    imeProcess.on('exit', (code) => {
        console.log(`ime_checker.exe exited with code ${code}`);
        imeProcess = null;
        // Restart ime_checker.exe if it crashes
        setTimeout(startImeChecker, 1000);
    });

    imeProcess.on('error', (err) => {
        console.error('Error starting ime_checker.exe:', err);
    });
}

/**
 * Function to stop ime_checker.exe
 */
function stopImeChecker() {
    if (imeProcess) {
        imeProcess.kill();
        imeProcess = null;
    }
}

/**
 * This method is called when your extension is deactivated
 */
function deactivate() {
    stopImeChecker();
}

module.exports = {
    activate,
    deactivate,
};
