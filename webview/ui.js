window.vscode = acquireVsCodeApi();

function autoResizeHeight(textarea) {
    textarea.style.height = 'auto';
    textarea.style.height = (textarea.scrollHeight) + "px";
}

document.body.addEventListener('input', function (event) {
    const target = event.target;
    if (target && target.classList.contains('autoResizeTextarea')) {
        autoResizeHeight(target);
    }
});

function createLabelAndTextareaGroup(role, receivedContent) {
    const randomId = "ta-" + generateRandomId();
    const div = createElement({
        tag: 'div',
        classes: ['input-container'],
        children: [
            {
                tag: 'div',
                classes: ['left-main'],
                children: [
                    {
                        tag: 'label',
                        attributes: { 'data-role': role, 'for': randomId },
                        text: role + ":"
                    },
                    {
                        tag: 'textarea',
                        attributes: { 'id': randomId },
                        classes: ['autoResizeTextarea'],
                        text: receivedContent
                    }
                ]
            },
            {
                tag: 'button',
                text: '×',
                attributes: { 'type': 'button' },
                classes: ['delete-button'],
                events: {
                    click: function () {
                        div.parentNode.removeChild(div);
                    }
                }
            }
        ]
    });

    const inputForm = document.getElementById('inputForm');
    inputForm.appendChild(div);

    return div;
}

const currentDate = new Date().toISOString().slice(0, 10);
const systemGroup = createLabelAndTextareaGroup('system', "You are ChatGPT, a large language model trained by OpenAI, based on the GPT-3.5 architecture.\nKnowledge cutoff: 2022-01\nCurrent date: " + currentDate + "\n\n已设置默认语言为中文.");

autoResizeHeight(systemGroup.querySelector('textarea'));
createLabelAndTextareaGroup('user', 'write python code to add 2 numbers');

function showLoading() {
    const runButton = document.getElementById('runButton');

    if (runButton) {
        runButton.disabled = true;
    }
}

function hideLoading() {
    const runButton = document.getElementById('runButton');

    if (runButton) {
        runButton.disabled = false;
    }
}

function buildMessagesArray() {
    const editorElements = document.querySelectorAll('#inputForm label');
    const messages = [];

    editorElements.forEach(function (element) {
        const role = element.getAttribute('data-role');
        const contentTextarea = element.nextElementSibling;
        const content = contentTextarea.value;
        messages.push({ role: role, content: content });
    });

    return messages;
}

function createLabelAndTextarea() {
    const assistantGroup = createLabelAndTextareaGroup('assistant');
    createLabelAndTextareaGroup('user');
    return assistantGroup;
}

let textarea;
let receivedContent = "";

// Listen for messages from the extension
window.addEventListener('message', event => {
    const message = event.data; // Message sent from the extension
    if (message.command === 'append') {
        console.log('Received message from extension:', message.data);
        const jsonLine = message.data;
        console.log(jsonLine)
        hideLoading();

        if (jsonLine && jsonLine.done === true) {
            const div = renderMarkdown(textarea, receivedContent);
            console.log('done');
            div.scrollIntoView();
            receivedContent = "";
        } else if (jsonLine && jsonLine.hasOwnProperty("message")) {
            const message = jsonLine.message;
            const content = message.content;
            if (content !== undefined) {
                receivedContent += content;
                textarea.textContent += content;
                autoResizeHeight(textarea);
                textarea.scrollIntoView();
            }
        } else {
            console.error("Invalid JSON data received:", jsonLine);
        }

    }
});

function run() {
    showLoading();
    const messages = buildMessagesArray();

    const assistantGroup = createLabelAndTextarea();
    textarea = assistantGroup.querySelector('textarea');

    // Post messages to the VS Code extension
    vscode.postMessage({
        command: 'run',
        messages: messages
    });
    hideLoading();
    return;
}

function renderMarkdown(placeholder, receivedContent) {
    const remarkable = new Remarkable();
    const html = remarkable.render(receivedContent);

    const div = document.createElement('div');
    div.innerHTML = html;
    div.setAttribute('data-text', receivedContent);
    placeholder.parentNode.insertAdjacentElement('beforeend', div);
    placeholder.style.display = 'none';

    // Add code block highlighting and copy button
    addCodeBlockFeatures(div);

    return div;
}

function addCodeBlockFeatures(parentElement) {
    parentElement.querySelectorAll("pre code").forEach((block) => {
        hljs.highlightBlock(block);

        const copyButton = createElement({
            tag: 'i',
            classes: ['copy-btn', 'icon-btn'],
            attributes: {
                'title': 'Copy'
            },
            html: '<svg data-slot="icon" fill="none" stroke-width="1.5" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 0 0 2.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 0 0-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 0 0 .75-.75 2.25 2.25 0 0 0-.1-.664m-5.8 0A2.251 2.251 0 0 1 13.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25ZM6.75 12h.008v.008H6.75V12Zm0 3h.008v.008H6.75V15Zm0 3h.008v.008H6.75V18Z"></path></svg>'
        });

        copyButton.addEventListener('click', () => {
            copyTextToClipboard(block.textContent);
        });

        block.parentNode.insertAdjacentElement("beforeend", copyButton);

        const insertButton = createElement({
            tag: 'i',
            classes: ['insert-btn', 'icon-btn'],
            attributes: {
                'title': 'Insert'
            },
            html: '<svg data-slot="icon" fill="none" stroke-width="1.5" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"> <path stroke-linecap="round" stroke-linejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0 0 13.5 3h-6a2.25 2.25 0 0 0-2.25 2.25v13.5A2.25 2.25 0 0 0 7.5 21h6a2.25 2.25 0 0 0 2.25-2.25V15M12 9l-3 3m0 0 3 3m-3-3h12.75"></path> </svg>'
        });

        insertButton.addEventListener('click', () => {
            insertTo(block.textContent);
        });

        block.parentNode.insertAdjacentElement("beforeend", insertButton);
    });

    // Add copy button for the div's content
    const divContent = parentElement.getAttribute('data-text');
    const divCopyButton = createElement({
        tag: 'i',
        classes: ['copy-btn', 'icon-btn'],
        attributes: {
            'title': 'Copy'
        },
        html: '<svg data-slot="icon" fill="none" stroke-width="1.5" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 0 0 2.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 0 0-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 0 0 .75-.75 2.25 2.25 0 0 0-.1-.664m-5.8 0A2.251 2.251 0 0 1 13.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25ZM6.75 12h.008v.008H6.75V12Zm0 3h.008v.008H6.75V15Zm0 3h.008v.008H6.75V18Z"></path></svg>'
    });

    divCopyButton.addEventListener('click', () => {
        copyTextToClipboard(divContent);
    });

    parentElement.insertAdjacentElement("beforeend", divCopyButton);
}

function insertTo(text) {
    vscode.postMessage({
        command: 'insert',
        text: text
    });
}

function generateRandomId() {
    return Math.random().toString(36).slice(2, 11);
}

function copyTextToClipboard(text) {
    navigator.clipboard.writeText(text)
        .then(() => {
            console.log('Text copied to clipboard');
        })
        .catch((error) => {
            console.error('Could not copy text: ', error);
        });
}
