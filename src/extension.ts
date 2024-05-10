import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { ollamaFetchStream } from './ollama';

function wrapInBackticks(s: string): string {
    return "```\n" + s + "\n```";
}
export function activate(context: vscode.ExtensionContext) {
    let copyFileNamesAndContentDisposable = vscode.commands.registerCommand('llamachat.copyFileNamesAndContent', (currentFile: vscode.Uri, selectedFiles: vscode.Uri[]) => {
        if (!selectedFiles.some(fileUri => fileUri.path === currentFile.path)) {
            selectedFiles = [currentFile];
        }

        let clipboardContent: string[] = [];
        selectedFiles.forEach((fileUri: vscode.Uri) => {
            let fileName = path.basename(fileUri.fsPath);
            let fileContent = fs.readFileSync(fileUri.fsPath, 'utf-8');
            clipboardContent.push(`File: \`${fileName}\`\n\`\`\`\n${fileContent}\n\`\`\`` + '\n\n');
        });

        vscode.env.clipboard.writeText(clipboardContent.join(''));

        let numFilesCopied = selectedFiles.length;
        let message = `Copied ${numFilesCopied} file${numFilesCopied > 1 ? 's' : ''} to clipboard.`;
        vscode.window.showInformationMessage(message);
    });

    let copyOneFileDisposable = vscode.commands.registerCommand('llamachat.copyOneFile', () => {
        let editor = vscode.window.activeTextEditor;
        if (!editor) {
            vscode.window.showErrorMessage('No active editor.');
            return;
        }

        let fileName = path.basename(editor.document.fileName);
        let fileContent = editor.document.getText();
        let clipboardContent = `File: \`${fileName}\`\n\`\`\`\n${fileContent}\n\`\`\`\n\n`;

        vscode.env.clipboard.writeText(clipboardContent);

        vscode.window.showInformationMessage('Copied one file to clipboard.');
    });

    let copySelectedTextDisposable = vscode.commands.registerCommand('llamachat.copySelectedText', () => {
        let editor = vscode.window.activeTextEditor;
        if (!editor) {
            vscode.window.showErrorMessage('No active editor.');
            return;
        }

        let selection = editor.selection;
        if (selection.isEmpty) {
            vscode.window.showErrorMessage('No text selected.');
            return;
        }

        let selectedText = editor.document.getText(selection);
        let clipboardContent = `\`\`\`\n${selectedText}\n\`\`\`\n\n`;

        vscode.env.clipboard.writeText(clipboardContent);

        vscode.window.showInformationMessage('Copied selected text to clipboard.');
    });

    context.subscriptions.push(copySelectedTextDisposable);

    context.subscriptions.push(copyFileNamesAndContentDisposable, copyOneFileDisposable);

    let disposablePanel = vscode.commands.registerCommand('llamachat.openPanel', () => {
        const panel = vscode.window.createWebviewPanel(
            'customPanel', // Identifies the type of the webview. Used internally
            'AI Chat', // Title of the panel displayed to the user
            vscode.ViewColumn.Two, // Editor column to show the new webview panel in.
            {
                enableScripts: true // Enable scripts in the webview
            }
        );

        panel.webview.onDidReceiveMessage(message => {
            console.log('Received message from webview:', message);
            // Find the text editor in the desired panel (ViewColumn.One)
            const targetEditor = vscode.window.visibleTextEditors.find(editor => editor.viewColumn === vscode.ViewColumn.One);

            if (message.command === 'prepare') {
                ollamaFetchStream(message.model, [], (data) => { });
            } else if (message.command === 'run') {
                // get seleted text from the text editor
                let selectedText = "";
                if (targetEditor) {
                    selectedText = targetEditor.document.getText(targetEditor.selection);
                }
                const messages = message.messages;
                if (message.containSeletedText) {
                    const lastIndex = messages.length - 1;
                    messages[lastIndex].content += `\n${wrapInBackticks(selectedText)}\n`;
                    panel.webview.postMessage({
                        command: 'appendCode',
                        data: messages[lastIndex].content,
                        currentTextareaId: message.currentTextareaId
                    });
                }
                ollamaFetchStream(message.model, messages, (data) => {
                    panel.webview.postMessage({ command: 'append', data: data });
                });
            } else if (message.command === 'insert') {
                const text = message.text;
                if (targetEditor) {
                    // If there is selected text, replace it with the new text
                    if (!targetEditor.selection.isEmpty) {
                        targetEditor.edit(editBuilder => {
                            editBuilder.replace(targetEditor.selection, text);
                        });
                    } else {
                        // If no text is selected, insert text at the current cursor position
                        targetEditor.edit(editBuilder => {
                            editBuilder.insert(targetEditor.selection.active, text);
                        });
                    }
                } else {
                    vscode.window.showErrorMessage('No text editor found in the specified panel.');
                }
            }            
        });

        // Read and load HTML content
        const htmlPath = vscode.Uri.file(path.join(context.extensionPath, 'webview', 'panel.html'));
        const htmlContent = fs.readFileSync(htmlPath.fsPath, 'utf-8');

        function replaceLinksAndScripts(htmlContent: string) {
            // 替换<link>标签的href属性
            const linkRegex = /<link[^>]*?href=['"]([^'"]+)['"][^>]*?>/g;
            htmlContent = htmlContent.replace(linkRegex, (match, href) => {
                const cssPath = vscode.Uri.file(path.join(context.extensionPath, 'webview', href));
                const cssContent = fs.readFileSync(cssPath.fsPath, 'utf-8');
                return `<style>${cssContent}</style>`;
            });

            // 替换<script>标签的src属性
            const scriptRegex = /<script[^>]*?src=['"]([^'"]+)['"][^>]*?><\/script>/g;
            htmlContent = htmlContent.replace(scriptRegex, (match, src) => {
                const jsPath = vscode.Uri.file(path.join(context.extensionPath, 'webview', src));
                const jsContent = fs.readFileSync(jsPath.fsPath, 'utf-8');
                return `<script>${jsContent}</script>`;
            });

            return htmlContent;
        }

        const replacedHtmlContent = replaceLinksAndScripts(htmlContent);
        panel.webview.html = replacedHtmlContent;

    });

    context.subscriptions.push(disposablePanel);
}

export function deactivate() { }
