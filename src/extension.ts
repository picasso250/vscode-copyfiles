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
 * @returns A formatted string: "#### FILE: <relative_or_absolute_path>\n```\n{content}\n```\n\n"
 */
function formatFileContentForClipboard(fileUri: vscode.Uri, fileContent: string): string {
    const workspaceRootUri = getWorkspaceRootForUri(fileUri);
    const pathString = getRelativePathString(fileUri, workspaceRootUri);
    return `#### FILE: ${pathString}\n\`\`\`\n${fileContent}\n\`\`\`\n\n`;
}

/**
 * Reads the content of 'prompt.txt' based on configuration and priority.
 * 1. Checks 'llmCopier.includePromptFile'. If false, returns empty string.
 * 2. If true, attempts to read 'prompt.txt' from the workspace root.
 * 3. If workspace 'prompt.txt' is not found or fails to read, attempts to read from 'llmCopier.globalPromptFilePath'.
 * @returns A formatted string of the prompt.txt content, or an empty string if not found, disabled, or an error occurs.
 */
async function getPromptFileContent(): Promise<string> {
    const config = vscode.workspace.getConfiguration('llmCopier');
    const includePromptFile = config.get<boolean>('includePromptFile', true);
    const globalPromptFilePath = config.get<string>('globalPromptFilePath', '');

    // If 'includePromptFile' is false, exit early
    if (!includePromptFile) {
        return '';
    }

    let content = '';

    // 1. Try to read project-level prompt.txt (higher priority)
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (workspaceFolders && workspaceFolders.length > 0) {
        const rootUri = workspaceFolders[0].uri;
        const projectPromptFilePath = path.join(rootUri.fsPath, 'prompt.txt');
        try {
            const fileStat = await vscode.workspace.fs.stat(vscode.Uri.file(projectPromptFilePath));
            if (fileStat.type === vscode.FileType.File) {
                const contentBuffer = await vscode.workspace.fs.readFile(vscode.Uri.file(projectPromptFilePath));
                content = Buffer.from(contentBuffer).toString('utf8');
                // If project prompt.txt found, return it immediately
                return `${content}\n\n`;
            }
        } catch (error) {
            // File not found or other read error, silently ignore and proceed to global path
            // console.warn(`Could not read project prompt.txt at ${projectPromptFilePath}: ${error}`);
        }
    }

    // 2. If project prompt.txt was not found or read, try to read global prompt.txt
    if (globalPromptFilePath) {
        const absGlobalPromptFilePath = path.resolve(globalPromptFilePath); // Resolve to absolute path
        try {
            const fileStat = await vscode.workspace.fs.stat(vscode.Uri.file(absGlobalPromptFilePath));
            if (fileStat.type === vscode.FileType.File) {
                const contentBuffer = await vscode.workspace.fs.readFile(vscode.Uri.file(absGlobalPromptFilePath));
                content = Buffer.from(contentBuffer).toString('utf8');
            }
        } catch (error) {
            console.error(`Failed to read global prompt.txt at ${absGlobalPromptFilePath}: ${error}`);
            vscode.window.showWarningMessage(`Could not read global prompt file configured at "${globalPromptFilePath}". Check path and permissions.`);
        }
    }

    return content ? `${content}\n\n` : '';
}


/**
 * Updates the 'root_folder' setting in the specified config.json file.
 * Reads the JSON file, modifies the 'root_folder' key, and writes it back.
 * Handles cases where the file, or key do not exist.
 */
async function updateRootFolderInConfig() {
    const config = vscode.workspace.getConfiguration('llmCopier');
    // NOTE: The user specified 'AutoApplyConfigFile' to point to config.json
    // We will derive the full path from the VS Code setting.
    const configFilePath = config.get<string>('autoApplyConfigFile');

    if (!configFilePath) {
        // Configuration file path not set, feature disabled.
        vscode.window.showWarningMessage('llmCopier.autoApplyConfigFile is not set. Root folder sync will not occur.');
        console.warn('[AutoCodeApplier] "llmCopier.autoApplyConfigFile" is not set. Root folder sync will not occur.');
        return;
    }

    const absConfigFilePath = path.resolve(configFilePath);
    const configDir = path.dirname(absConfigFilePath);

    // Ensure the directory for the config file exists
    try {
        await fs.promises.mkdir(configDir, { recursive: true });
    } catch (error) {
        vscode.window.showErrorMessage(`Failed to create directory for config file: ${configDir}. Error: ${error}`);
        console.error(`[AutoCodeApplier] Failed to create directory ${configDir}:`, error);
        return;
    }

    let currentRootFolder = '';
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (workspaceFolders && workspaceFolders.length > 0) {
        // Use the first workspace folder as the project root
        currentRootFolder = workspaceFolders[0].uri.fsPath;
    }

    let configData: { root_folder?: string } = {}; // Use an interface or type for better safety if config grows
    let fileContent = '';

    try {
        fileContent = await fs.promises.readFile(absConfigFilePath, 'utf8');
        if (fileContent.trim()) { // Only try to parse if file is not empty
            configData = JSON.parse(fileContent);
        }
    } catch (error: any) {
        if (error.code !== 'ENOENT') { // Ignore file not found, we'll create it or overwrite
            vscode.window.showErrorMessage(`Failed to read config file: ${absConfigFilePath}. Error: ${error}`);
            console.error(`[AutoCodeApplier] Failed to read config file ${absConfigFilePath}:`, error);
            // We'll proceed with an empty configData object
        }
    }

    // Update the root_folder
    if (configData.root_folder !== currentRootFolder) {
        configData.root_folder = currentRootFolder;
        try {
            // Write back with 2-space indentation for readability
            await fs.promises.writeFile(absConfigFilePath, JSON.stringify(configData, null, 2), 'utf8');
            console.log(`[AutoCodeApplier] Updated root_folder in ${absConfigFilePath} to: ${currentRootFolder}`);
            vscode.window.showInformationMessage(`AutoCodeApplier config updated: root_folder set to ${currentRootFolder}`);
        } catch (error) {
            vscode.window.showErrorMessage(`Failed to write to config file: ${absConfigFilePath}. Error: ${error}`);
            console.error(`[AutoCodeApplier] Failed to write config file ${absConfigFilePath}:`, error);
        }
    } else {
        console.log(`[AutoCodeApplier] root_folder in ${absConfigFilePath} is already up-to-date.`);
        vscode.window.showInformationMessage('AutoCodeApplier config: root_folder is already up-to-date.');
    }
}


export function activate(context: vscode.ExtensionContext) {

    // --- Auto-update root folder in config.json ---
    // Initial call when extension activates
    updateRootFolderInConfig();

    // Listen for workspace folder changes (e.g., opening a new folder, adding/removing a multi-root folder)
    context.subscriptions.push(vscode.workspace.onDidChangeWorkspaceFolders(e => {
        console.log('[AutoCodeApplier] Workspace folders changed, updating config.json...');
        updateRootFolderInConfig();
    }));

    // Listen for configuration changes, specifically if the config file path itself changes
    context.subscriptions.push(vscode.workspace.onDidChangeConfiguration(e => {
        if (e.affectsConfiguration('llmCopier.autoApplyConfigFile')) {
            console.log('[AutoCodeApplier] Auto apply config file path changed, updating config.json...');
            updateRootFolderInConfig();
        }
    }));
    // --- End Auto-update root folder ---


    // Command: Copy selected files' names and content
    let copyFileNamesAndContentDisposable = vscode.commands.registerCommand('llmCopier.copyFileNamesAndContent', async (currentFile: vscode.Uri, selectedFiles: vscode.Uri[]) => {
        let filesToCopy: vscode.Uri[] = [];
        let itemsToCheck: vscode.Uri[] = [];

        if (selectedFiles && selectedFiles.length > 0) {
            itemsToCheck = selectedFiles;
        } else if (currentFile) {
            itemsToCheck = [currentFile];
        }

        for (const uri of itemsToCheck) {
            try {
                // Use async fs.promises.stat
                const stats = await fs.promises.stat(uri.fsPath);
                if (stats.isFile()) {
                    filesToCopy.push(uri);
                }
            } catch (error) {
                console.error(`Could not access file ${uri.fsPath}: ${error}`);
                vscode.window.showWarningMessage(`Could not access selected item "${path.basename(uri.fsPath)}".`);
            }
        }

        if (filesToCopy.length === 0) {
            vscode.window.showInformationMessage('No files selected or found to copy.');
            return;
        }

        let clipboardContent: string[] = [];
        const promptContent = await getPromptFileContent();
        if (promptContent) {
            clipboardContent.push(promptContent);
        }

        for (const fileUri of filesToCopy) {
            try {
                // Use async fs.promises.readFile
                const fileContent = await fs.promises.readFile(fileUri.fsPath, 'utf-8');
                clipboardContent.push(formatFileContentForClipboard(fileUri, fileContent));
            } catch (error) {
                console.error(`Failed to read file ${fileUri.fsPath}: ${error}`);
                vscode.window.showWarningMessage(`Could not read file ${path.basename(fileUri.fsPath)}.`);
            }
        }

        if (clipboardContent.length > 0) {
            await vscode.env.clipboard.writeText(clipboardContent.join(''));
            let numFilesCopied = filesToCopy.length;
            let message = `Copied ${numFilesCopied} file${numFilesCopied > 1 ? 's' : ''} to clipboard.`;
            vscode.window.showInformationMessage(message);
        } else {
            vscode.window.showInformationMessage('No files were copied.');
        }
    });

    // Command: Copy content of the currently active file
    let copyOneFileDisposable = vscode.commands.registerCommand('llmCopier.copyOneFile', async () => {
        let editor = vscode.window.activeTextEditor;
        if (!editor) {
            vscode.window.showErrorMessage('No active editor.');
            return;
        }

        try {
            const document = editor.document;
            const fileUri = document.uri;
            const fileContent = document.getText();
            let message: string;

            const promptContent = await getPromptFileContent();
            let finalContentParts: string[] = [];
            if (promptContent) {
                finalContentParts.push(promptContent);
            }

            if (fileUri.scheme === 'file') {
                // It's a regular file on the file system
                finalContentParts.push(formatFileContentForClipboard(fileUri, fileContent));
                message = 'Copied one file to clipboard.';
            } else if (fileUri.scheme === 'untitled') {
                // It's an unsaved untitled document, only copy content, no path for untitled
                finalContentParts.push(`\`\`\`\n${fileContent}\n\`\`\`\n\n`);
                message = 'Copied content of untitled file to clipboard.';
            } else {
                // Handle other schemes (e.g., 'git', 'output', etc.)
                vscode.window.showWarningMessage(`Cannot copy content from document with scheme "${fileUri.scheme}". Only file system or untitled documents are supported.`);
                return;
            }

            if (finalContentParts.length > 0) {
                await vscode.env.clipboard.writeText(finalContentParts.join(''));
                vscode.window.showInformationMessage(message);
            } else {
                vscode.window.showInformationMessage('Nothing was copied.');
            }

        } catch (error) {
            console.error(`Failed to copy active file/document: ${error}`);
            vscode.window.showErrorMessage('Failed to copy active file/document content.');
        }
    });

    // Command: Copy selected text from the active editor
    let copySelectedTextDisposable = vscode.commands.registerCommand('llmCopier.copySelectedText', async () => {
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
        
        const promptContent = await getPromptFileContent();
        let finalContentParts: string[] = [];
        if (promptContent) {
            finalContentParts.push(promptContent);
        }
        finalContentParts.push(`\`\`\`\n${selectedText}\n\`\`\`\n\n`); // This command's format is kept as original

        await vscode.env.clipboard.writeText(finalContentParts.join(''));
        vscode.window.showInformationMessage('Copied selected text to clipboard.');
    });

    /**
     * Recursively reads files within a folder and formats their content.
     * The path for each file is relative to its project root (或 absolute if not in a workspace).
     * @param folderUri The URI of the folder to read.
     * @returns A promise that resolves to an array of formatted file content strings.
     */
    async function readFolderRecursively(folderUri: vscode.Uri): Promise<string[]> {
        let contents: string[] = [];
        try {
            const entries = await vscode.workspace.fs.readDirectory(folderUri);

            for (const [name, type] of entries) {
                const entryUri = vscode.Uri.joinPath(folderUri, name);
                // Exclude prompt.txt itself from recursive folder copy if it's within the copied folder
                // (Note: The prompt.txt inclusion is handled by getPromptFileContent at the top level of commands)
                if (name === 'prompt.txt' && entryUri.fsPath === path.join(folderUri.fsPath, 'prompt.txt')) {
                    continue; 
                }

                if (type === vscode.FileType.File) {
                    try {
                        // Changed to async read
                        const fileContent = await fs.promises.readFile(entryUri.fsPath, 'utf8');
                        contents.push(formatFileContentForClipboard(entryUri, fileContent));
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
    let copyFolderContentDisposable = vscode.commands.registerCommand('llmCopier.copyFolderContent', async (contextUri: vscode.Uri, selectedUris: vscode.Uri[]) => {
        let foldersToCopy: vscode.Uri[] = [];

        // Prioritize selectedUris if available, otherwise fall back to contextUri
        if (selectedUris && selectedUris.length > 0) {
            foldersToCopy = selectedUris;
        } else if (contextUri) {
            foldersToCopy = [contextUri];
        }

        if (foldersToCopy.length === 0) {
            vscode.window.showErrorMessage('No folders selected.');
            return;
        }

        let allFilesCount = 0;
        const allClipboardContent: string[] = [];
        const promptContent = await getPromptFileContent();
        if (promptContent) {
            allClipboardContent.push(promptContent);
        }

        // Filter out non-directories and process each folder
        const validFolders = await Promise.all(foldersToCopy.map(async (uri) => {
            try {
                // Use async fs.promises.stat
                const stats = await fs.promises.stat(uri.fsPath);
                return stats.isDirectory() ? uri : null;
            } catch (error) {
                console.error(`Could not access "${uri.fsPath}": ${error}`);
                vscode.window.showWarningMessage(`Could not access selected item "${path.basename(uri.fsPath)}".`);
                return null;
            }
        }));

        const actualFoldersToProcess = validFolders.filter((uri): uri is vscode.Uri => uri !== null);

        if (actualFoldersToProcess.length === 0) {
            vscode.window.showInformationMessage('No valid folders found among selected items to copy.');
            return;
        }

        await vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: `Copying content from ${actualFoldersToProcess.length} folder(s)...`,
            cancellable: false
        }, async (progress) => {
            for (const folderUri of actualFoldersToProcess) {
                progress.report({ message: `Collecting files from "${path.basename(folderUri.fsPath)}"...` });
                const folderFiles = await readFolderRecursively(folderUri);
                allClipboardContent.push(...folderFiles);
                allFilesCount += folderFiles.length;
            }

            // Check if files were actually added beyond just the prompt
            if (allClipboardContent.length > (promptContent ? 1 : 0) || (promptContent && allClipboardContent.length > 0)) {
                progress.report({ message: 'Copying to clipboard...' });
                await vscode.env.clipboard.writeText(allClipboardContent.join(''));
                vscode.window.showInformationMessage(`Copied ${allFilesCount} files from ${actualFoldersToProcess.length} folder${actualFoldersToProcess.length > 1 ? 's' : ''} to clipboard.`);
            } else {
                vscode.window.showInformationMessage(`No files found in selected folder(s) to copy.`);
            }
        });
    });

    // Command: Copy content of all currently open files
    let copyAllOpenFilesDisposable = vscode.commands.registerCommand('llmCopier.copyAllOpenFiles', async () => {
        const openFilesToCopy: string[] = [];

        const promptContent = await getPromptFileContent();
        if (promptContent) {
            openFilesToCopy.push(promptContent);
        }

        let actualFilesCopiedCount = 0; // Counter for actual files, excluding prompt.txt
        // Iterate through all open TextDocuments
        for (const document of vscode.workspace.textDocuments) {
            // Only consider file system documents that are not untitled
            if (document.uri.scheme === 'file' && !document.isUntitled) {
                try {
                    const fileContent = document.getText();
                    openFilesToCopy.push(formatFileContentForClipboard(document.uri, fileContent));
                    actualFilesCopiedCount++;
                } catch (error) {
                    console.error(`Failed to copy open file ${document.uri.fsPath}: ${error}`);
                    vscode.window.showWarningMessage(`Could not copy content from open file "${path.basename(document.uri.fsPath)}".`);
                }
            }
        }

        if (openFilesToCopy.length > 0) {
            await vscode.env.clipboard.writeText(openFilesToCopy.join(''));
            vscode.window.showInformationMessage(`Copied ${actualFilesCopiedCount} open file${actualFilesCopiedCount > 1 ? 's' : ''} to clipboard.`);
        } else {
            vscode.window.showInformationMessage('No open files found to copy.');
        }
    });

    // Command: Manually trigger updateRootFolderInConfig
    let updateRootFolderConfigDisposable = vscode.commands.registerCommand('llmCopier.updateRootFolderConfig', async () => {
        vscode.window.showInformationMessage('Updating AutoCodeApplier root folder configuration...');
        await updateRootFolderInConfig();
    });

    // Command: Toggle 'llmCopier.includePromptFile' setting
    let toggleIncludePromptFileDisposable = vscode.commands.registerCommand('llmCopier.toggleIncludePromptFile', async () => {
        const config = vscode.workspace.getConfiguration('llmCopier');
        const currentSetting = config.get<boolean>('includePromptFile', true);
        const newSetting = !currentSetting;

        // Update the setting globally (or use ConfigurationTarget.Workspace if preferred)
        await config.update('includePromptFile', newSetting, vscode.ConfigurationTarget.Global);

        vscode.window.showInformationMessage(`'Include prompt.txt' is now set to: ${newSetting}`);
    });


    context.subscriptions.push(
        copySelectedTextDisposable,
        copyFileNamesAndContentDisposable,
        copyOneFileDisposable,
        copyFolderContentDisposable,
        copyAllOpenFilesDisposable,
        updateRootFolderConfigDisposable,
        toggleIncludePromptFileDisposable
    );
}

export function deactivate() { }