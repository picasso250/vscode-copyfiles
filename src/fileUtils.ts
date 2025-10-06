import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Checks if a file is likely a binary file by inspecting its first bytes for null characters.
 * This is a heuristic and not 100% foolproof but effective for most common cases.
 * @param fileUri The URI of the file to check.
 * @returns A promise that resolves to true if the file is likely binary, false otherwise.
 */
export async function isLikelyBinary(fileUri: vscode.Uri): Promise<boolean> {
    // This check is only for filesystem files.
    if (fileUri.scheme !== 'file') {
        return false;
    }

    const filePath = fileUri.fsPath;
    const chunk_size = 1024; // Read the first 1KB, which is sufficient for this heuristic.
    const buffer = new Uint8Array(chunk_size); // Use Uint8Array to satisfy the type requirement.
    let fileHandle: fs.promises.FileHandle | undefined;

    try {
        fileHandle = await fs.promises.open(filePath, 'r');
        const { bytesRead } = await fileHandle.read(buffer, 0, chunk_size, 0);

        // An empty file is not binary.
        if (bytesRead === 0) {
            return false;
        }

        // Check for the existence of a null byte, which is a strong indicator of a binary file.
        // Most text file encodings (like ASCII, UTF-8) do not use null bytes for character representation.
        for (let i = 0; i < bytesRead; i++) {
            if (buffer[i] === 0) {
                return true; // Null byte found, highly likely a binary file.
            }
        }

        return false; // No null bytes found in the initial chunk.
    } catch (error) {
        console.error(`Error checking if file is binary: ${filePath}. Assuming it is.`, error);
        // Be conservative: if we can't read it for some reason (e.g., permissions),
        // it's safer to treat it as binary and skip it.
        return true;
    } finally {
        await fileHandle?.close();
    }
}

/**
 * Finds the most specific workspace folder URI that contains the given file URI.
 * @param fileUri The URI of the file.
 * @returns The URI of the containing workspace folder, or undefined if the file is not in any workspace.
 */
export function getWorkspaceRootForUri(fileUri: vscode.Uri): vscode.Uri | undefined {
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
export function getRelativePathString(fileUri: vscode.Uri, workspaceRootUri: vscode.Uri | undefined): string {
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
export function formatFileContentForClipboard(fileUri: vscode.Uri, fileContent: string): string {
    const workspaceRootUri = getWorkspaceRootForUri(fileUri);
    const pathString = getRelativePathString(fileUri, workspaceRootUri);
    return `#### FILE: ${pathString}\n\`\`\`\n${fileContent}\n\`\`\`\n\n`;
}