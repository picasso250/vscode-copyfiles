import * as vscode from 'vscode';
import * as fs from 'fs';

export function activate(context: vscode.ExtensionContext) {
    let disposable = vscode.commands.registerCommand('copyfiles.copyFileNamesAndContent', (currentFile: vscode.Uri, selectedFiles: vscode.Uri[]) => {
        if (!selectedFiles.some(fileUri => fileUri.path === currentFile.path)) {
            selectedFiles = [currentFile];
        }

        let clipboardContent: string[] = [];
        selectedFiles.forEach((fileUri: vscode.Uri) => {
            let fileName = fileUri.path.substring(fileUri.path.lastIndexOf('/') + 1);
            let fileContent = fs.readFileSync(fileUri.fsPath, 'utf-8');
            clipboardContent.push(`File: \`${fileName}\`\n\`\`\`\n${fileContent}\n\`\`\`` + '\n\n');
        });

        vscode.env.clipboard.writeText(clipboardContent.join(''));

        let numFilesCopied = selectedFiles.length;
        let message = `Copied ${numFilesCopied} file${numFilesCopied > 1 ? 's' : ''} to clipboard.`;
        vscode.window.showInformationMessage(message);
    });

    context.subscriptions.push(disposable);
}

export function deactivate() { }
