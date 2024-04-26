import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';

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
}

export function deactivate() { }
