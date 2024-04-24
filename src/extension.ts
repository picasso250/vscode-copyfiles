import * as vscode from 'vscode';
import * as fs from 'fs';

export function activate(context: vscode.ExtensionContext) {
    let disposable = vscode.commands.registerCommand('copyfiles.copyFileNamesAndContent', (currentFile: vscode.Uri, selectedFiles: vscode.Uri[]) => {
        let clipboardContent: string[] = [];
        selectedFiles.forEach((fileUri: vscode.Uri) => {
            let fileName = fileUri.path.substring(fileUri.path.lastIndexOf('/') + 1);
            let fileContent = fs.readFileSync(fileUri.fsPath, 'utf-8');
            clipboardContent.push(`File: \`${fileName}\`\n\`\`\`\n${fileContent}\n\`\`\``);
        });

        vscode.env.clipboard.writeText(clipboardContent.join('\n\n'));

        vscode.window.showInformationMessage('File names and content copied to clipboard');
    });

    context.subscriptions.push(disposable);
}

export function deactivate() { }
