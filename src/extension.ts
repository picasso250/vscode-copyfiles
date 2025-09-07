import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Finds the most specific workspace folder URI that contains the given file URI.
 * @param fileUri The URI of the file.
 * @returns The URI of the containing workspace folder, or undefined if the file is not in any workspace.
 */
function getWorkspaceRootForUri(fileUri: vscode.Uri): vscode.Uri | undefined {
    if (!vscode.workspace.workspaceFolders || vscode.workspace.workspaceFolders.length === 0) {
        return undefined;
    }

    let bestMatch: vscode.Uri | undefined = undefined;
    let longestPath = -1;

    for (const workspaceFolder of vscode.workspace.workspaceFolders) {
        const workspacePath = workspaceFolder.uri.fsPath;
        const filePath = fileUri.fsPath;

        // Ensure path is within the workspace and normalize
        if (filePath.startsWith(workspacePath)) {
            if (workspacePath.length > longestPath) {
                bestMatch = workspaceFolder.uri;
                longestPath = workspacePath.length;
            }
        }
    }
    return bestMatch;
}

/**
 * Calculates a relative path string for a given fileUri.
 * Prioritizes:
 * 1. Relative to the determined workspace root (if found)
 * 2. Absolute file system path (fallback)
 * @param fileUri The URI of the file.
 * @param workspaceRootUri The URI of the workspace root to calculate the relative path against, or undefined.
 * @returns A string representing the relative or absolute path.
 */
function getRelativePathString(fileUri: vscode.Uri, workspaceRootUri: vscode.Uri | undefined): string {
    const filePath = fileUri.fsPath;

    // 1. Relative to workspace root
    if (workspaceRootUri) {
        // workspaceRootUri is guaranteed to be a directory URI
        return path.relative(workspaceRootUri.fsPath, filePath);
    }

    // 2. Absolute file system path (fallback)
    return filePath;
}

/**
 * Formats file content with its path for clipboard use.
 * The path is relative to the project root if the file is within a workspace, otherwise it's an absolute path.
 * @param fileUri The URI of the file.
 * @param fileContent The content of the file.
 * @returns A formatted string: "--- FILE: <relative_or_absolute_path> ---\n```\n{content}\n```\n\n"
 */
function formatFileContentForClipboard(fileUri: vscode.Uri, fileContent: string): string {
    const workspaceRootUri = getWorkspaceRootForUri(fileUri);
    const pathString = getRelativePathString(fileUri, workspaceRootUri);
    return `--- FILE: ${pathString} ---\n\`\`\`\n${fileContent}\n\`\`\`\n\n`;
}


export function activate(context: vscode.ExtensionContext) {

    // Command: Copy selected files' names and content
    let copyFileNamesAndContentDisposable = vscode.commands.registerCommand('llamachat.copyFileNamesAndContent', async (currentFile: vscode.Uri, selectedFiles: vscode.Uri[]) => {
        // VS Code can sometimes pass currentFile as undefined if the command is invoked from a different context
        // Ensure selectedFiles is an array and contains the currentFile if it's a file context.
        let filesToCopy: vscode.Uri[] = [];
        if (selectedFiles && selectedFiles.length > 0) {
             // Filter out directories if any are mistakenly passed.
            filesToCopy = selectedFiles.filter(uri => fs.existsSync(uri.fsPath) && fs.statSync(uri.fsPath).isFile());
        } else if (currentFile && fs.existsSync(currentFile.fsPath) && fs.statSync(currentFile.fsPath).isFile()) {
            filesToCopy = [currentFile];
        }

        if (filesToCopy.length === 0) {
            vscode.window.showInformationMessage('No files selected or found to copy.');
            return;
        }

        let clipboardContent: string[] = [];
        for (const fileUri of filesToCopy) {
            try {
                const fileContent = fs.readFileSync(fileUri.fsPath, 'utf-8');
                clipboardContent.push(formatFileContentForClipboard(fileUri, fileContent));
            } catch (error) {
                console.error(`Failed to read file ${fileUri.fsPath}: ${error}`);
                vscode.window.showWarningMessage(`Could not read file ${path.basename(fileUri.fsPath)}.`);
            }
        }

        if (clipboardContent.length > 0) {
            vscode.env.clipboard.writeText(clipboardContent.join(''));
            let numFilesCopied = clipboardContent.length;
            let message = `Copied ${numFilesCopied} file${numFilesCopied > 1 ? 's' : ''} to clipboard.`;
            vscode.window.showInformationMessage(message);
        } else {
            vscode.window.showInformationMessage('No files were copied.');
        }
    });

    // Command: Copy content of the currently active file
    let copyOneFileDisposable = vscode.commands.registerCommand('llamachat.copyOneFile', async () => {
        let editor = vscode.window.activeTextEditor;
        if (!editor) {
            vscode.window.showErrorMessage('No active editor.');
            return;
        }

        try {
            const document = editor.document;
            const fileUri = document.uri;
            const fileContent = document.getText();
            let clipboardContent: string;
            let message: string;

            if (fileUri.scheme === 'file') {
                // It's a regular file on the file system
                clipboardContent = formatFileContentForClipboard(fileUri, fileContent);
                message = 'Copied one file to clipboard.';
            } else if (fileUri.scheme === 'untitled') {
                // It's an unsaved untitled document, only copy content
                clipboardContent = `\`\`\`\n${fileContent}\n\`\`\`\n\n`;
                message = 'Copied content of untitled file to clipboard.';
            } else {
                // Handle other schemes (e.g., 'git', 'output', etc.)
                vscode.window.showWarningMessage(`Cannot copy content from document with scheme "${fileUri.scheme}". Only file system or untitled documents are supported.`);
                return;
            }

            await vscode.env.clipboard.writeText(clipboardContent);
            vscode.window.showInformationMessage(message);

        } catch (error) {
            console.error(`Failed to copy active file/document: ${error}`);
            vscode.window.showErrorMessage('Failed to copy active file/document content.');
        }
    });

    // Command: Copy selected text from the active editor
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
        let clipboardContent = `\`\`\`\n${selectedText}\n\`\`\`\n\n`; // This command's format is kept as original

        vscode.env.clipboard.writeText(clipboardContent);
        vscode.window.showInformationMessage('Copied selected text to clipboard.');
    });

    /**
     * Recursively reads files within a folder and formats their content.
     * The path for each file is relative to its project root (or absolute if not in a workspace).
     * @param folderUri The URI of the folder to read.
     * @returns A promise that resolves to an array of formatted file content strings.
     */
    async function readFolderRecursively(folderUri: vscode.Uri): Promise<string[]> {
        let contents: string[] = [];
        try {
            const entries = await vscode.workspace.fs.readDirectory(folderUri);

            for (const [name, type] of entries) {
                const entryUri = vscode.Uri.joinPath(folderUri, name);
                if (type === vscode.FileType.File) {
                    try {
                        const fileContent = fs.readFileSync(entryUri.fsPath, 'utf-8');
                        contents.push(formatFileContentForClipboard(entryUri, fileContent.toString()));
                    } catch (fileReadError) {
                        console.error(`Failed to read file ${entryUri.fsPath}: ${fileReadError}`);
                        vscode.window.showWarningMessage(`Could not read file ${name} in ${folderUri.fsPath}.`);
                    }
                } else if (type === vscode.FileType.Directory) {
                    contents.push(...await readFolderRecursively(entryUri));
                }
            }
        } catch (dirReadError) {
            console.error(`Failed to read directory ${folderUri.fsPath}: ${dirReadError}`);
            vscode.window.showErrorMessage(`Could not read directory ${path.basename(folderUri.fsPath)}. Check permissions.`);
        }
        return contents;
    }

    // Command: Copy entire folder content recursively
    let copyFolderContentDisposable = vscode.commands.registerCommand('llamachat.copyFolderContent', async (folderUri: vscode.Uri) => {
        if (!folderUri) {
            vscode.window.showErrorMessage('No folder selected.');
            return;
        }

        // Ensure the URI points to a directory
        try {
            const stats = fs.statSync(folderUri.fsPath);
            if (!stats.isDirectory()) {
                vscode.window.showErrorMessage('The selected item is not a folder. Please select a folder to copy its contents.');
                return;
            }
        } catch (error) {
            vscode.window.showErrorMessage(`Could not access "${path.basename(folderUri.fsPath)}": ${error}`);
            return;
        }


        vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: `Copying folder content from "${path.basename(folderUri.fsPath)}"`,
            cancellable: false
        }, async (progress) => {
            progress.report({ message: 'Collecting files...' });
            const allFileContents = await readFolderRecursively(folderUri);

            if (allFileContents.length > 0) {
                progress.report({ message: 'Copying to clipboard...' });
                await vscode.env.clipboard.writeText(allFileContents.join(''));
                vscode.window.showInformationMessage(`Copied ${allFileContents.length} files from folder "${path.basename(folderUri.fsPath)}" to clipboard.`);
            } else {
                vscode.window.showInformationMessage(`No files found in folder "${path.basename(folderUri.fsPath)}" to copy.`);
            }
        });
    });

    // NEW Command: Copy content of all currently open files
    let copyAllOpenFilesDisposable = vscode.commands.registerCommand('llamachat.copyAllOpenFiles', async () => {
        const openFilesToCopy: string[] = [];

        // Iterate through all open TextDocuments
        for (const document of vscode.workspace.textDocuments) {
            // Only consider file system documents that are not untitled
            if (document.uri.scheme === 'file' && !document.isUntitled) {
                try {
                    const fileContent = document.getText();
                    openFilesToCopy.push(formatFileContentForClipboard(document.uri, fileContent));
                } catch (error) {
                    console.error(`Failed to copy open file ${document.uri.fsPath}: ${error}`);
                    vscode.window.showWarningMessage(`Could not copy content from open file "${path.basename(document.uri.fsPath)}".`);
                }
            }
        }

        if (openFilesToCopy.length > 0) {
            await vscode.env.clipboard.writeText(openFilesToCopy.join(''));
            const numFilesCopied = openFilesToCopy.length;
            vscode.window.showInformationMessage(`Copied ${numFilesCopied} open file${numFilesCopied > 1 ? 's' : ''} to clipboard.`);
        } else {
            vscode.window.showInformationMessage('No open files found to copy.');
        }
    });

    context.subscriptions.push(
        copySelectedTextDisposable,
        copyFileNamesAndContentDisposable,
        copyOneFileDisposable,
        copyFolderContentDisposable,
        copyAllOpenFilesDisposable // Add the new disposable here
    );
}

export function deactivate() { }