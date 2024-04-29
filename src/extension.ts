import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { ollamaFetchStream } from './ollama';

export function activate(context: vscode.ExtensionContext) {
    let copyFileNamesAndContentDisposable = vscode.commands.registerCommand('copyfiles.copyFileNamesAndContent', (currentFile: vscode.Uri, selectedFiles: vscode.Uri[]) => {
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

    let copyOneFileDisposable = vscode.commands.registerCommand('copyfiles.copyOneFile', () => {
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

    let copySelectedTextDisposable = vscode.commands.registerCommand('copyfiles.copySelectedText', () => {
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

    let disposablePanel = vscode.commands.registerCommand('copyfiles.openPanel', () => {
        const panel = vscode.window.createWebviewPanel(
            'customPanel', // Identifies the type of the webview. Used internally
            'Custom Panel', // Title of the panel displayed to the user
            vscode.ViewColumn.One, // Editor column to show the new webview panel in.
            {
                enableScripts: true // Enable scripts in the webview
            }
        );

        panel.webview.onDidReceiveMessage(message => {
            if (message.command === 'run') {
                const messages = message.messages;
                console.log('Received messages from webview:', messages);
                ollamaFetchStream('llama3', messages, (data) => { 
                    console.log(data);
                    // send to webview
                    panel.webview.postMessage({ command: 'append', data: data });
                 });
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
