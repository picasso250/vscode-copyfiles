### LLM Code Copier

这是一个为 VS Code 设计的扩展，旨在简化代码片段和文件内容的复制过程，特别针对与大型语言模型（LLM）的交互场景进行了优化。它允许用户以结构化的方式，快速将选定的代码、文件内容、甚至整个文件夹内容复制到剪贴板，并可选择性地在复制内容前包含一个根目录下的 `prompt.txt` 文件的内容。

### 特性 (Features)

该扩展提供了以下功能：

1.  **复制选定文本 (Copy Selected Text)**
    *   **描述**: 将当前编辑器中选定的文本复制到剪贴板。在复制前，如果配置启用，会优先包含工作区根目录下的 `prompt.txt` 内容。
    *   **触发方式**: 在编辑器中选中代码后，右键点击选择 "LLM Code Copier: Copy Selected Text"。

2.  **复制当前活动文件内容 (Copy Active File Name And Content)**
    *   **描述**: 将当前活动编辑器的文件内容（包括文件名和路径）以 `---FILE: <路径>---` 的格式复制到剪贴板。对于未保存的无标题文件，则只复制其内容。同样支持在前面包含 `prompt.txt` 内容。
    *   **触发方式**: 在编辑器中右键点击选择 "LLM Code Copier: Copy Active File Name And Content"。

3.  **复制选定文件内容 (Copy File Name And Content)**
    *   **描述**: 从文件资源管理器中选择一个或多个文件，将它们的名称、相对路径和内容以 `---FILE: <路径>---` 的格式复制。此命令非常适合将多个相关文件一次性提供给 LLM。
    *   **触发方式**: 在文件资源管理器中选中文件后，右键点击选择 "LLM Code Copier: Copy File Name And Content"。

4.  **递归复制文件夹内容 (Copy Folder Content Recursively)**
    *   **描述**: 复制选定文件夹及其所有子文件夹中文件的内容。每个文件都将以 `---FILE: <相对路径>---` 的格式呈现。这个功能在向 LLM 提供整个项目或模块的上下文时特别有用。为了避免循环，此功能会跳过位于被复制文件夹内的 `prompt.txt` 文件，但会包含工作区根目录下的 `prompt.txt`。
    *   **触发方式**: 在文件资源管理器中选中文件夹后，右键点击选择 "LLM Code Copier: Copy Folder Content Recursively"。

5.  **复制所有已打开文件内容 (Copy All Open Files Content)**
    *   **描述**: 将所有当前在 VS Code 中打开的、基于文件系统的文档（非无标题文件）的内容复制到剪贴板。每个文件都将以 `---FILE: <相对路径>---` 的格式呈现。
    *   **触发方式**: 通过 VS Code 菜单：`文件 (File)` -> `LLM Code Copier: Copy All Open Files Content`。

### 配置 (Configuration)

该扩展提供一个配置选项，允许用户控制是否在复制内容前包含 `prompt.txt`。

*   `llamachat.includePromptFile`:
    *   **类型**: `boolean`
    *   **默认值**: `true`
    *   **描述**: 是否在复制内容的开头包含工作区根目录下的 `prompt.txt` 文件的内容。如果启用且 `prompt.txt` 存在，其内容将被添加到剪贴板内容的顶部。

您可以在 VS Code 的设置 (Ctrl+, 或 Cmd+,) 中搜索 "LLM Code Copier" 来修改此配置。

### 用法 (Usage)

安装扩展后，您可以通过以下方式使用其功能：

1.  **右键菜单**: 在编辑器中选中文本或在文件资源管理器中选中文件/文件夹，然后右键点击，从上下文菜单中选择相应的 "LLM Code Copier" 命令。
2.  **命令面板**: 打开命令面板 (Ctrl+Shift+P 或 Cmd+Shift+P)，然后搜索 "LLM Code Copier"，选择您想要执行的命令。
3.  **文件菜单**: 对于 "Copy All Open Files Content" 命令，可以通过 `文件 (File)` 菜单访问。

### 安装 (Installation)

1.  打开 VS Code。
2.  进入扩展视图 (快捷键 `Ctrl+Shift+X` 或 `Cmd+Shift+X`)。
3.  搜索 "LLM Code Copier"。
4.  点击安装。

### 仓库 (Repository)

您可以在 GitHub 上找到此扩展的源代码：[https://github.com/picasso250/vscode-copyfiles](https://github.com/picasso250/vscode-copyfiles)
