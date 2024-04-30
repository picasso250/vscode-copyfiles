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
                        textContent: role + ":"
                    },
                    {
                        tag: 'textarea',
                        attributes: { 'id': randomId },
                        classes: ['autoResizeTextarea'],
                        textContent: receivedContent
                    }
                ]
            },
            {
                tag: 'button',
                textContent: '×',
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
            tag: 'button',
            classes: ['copy-btn'],
            attributes: {
                'type': 'button'
            },
            textContent: 'Copy'
        });
    
        copyButton.addEventListener('click', () => {
            copyTextToClipboard(block.textContent);
        });
    
        block.parentNode.insertAdjacentElement("beforeend", copyButton);
    
        const insertButton = createElement({
            tag: 'button',
            classes: ['insert-btn'],
            attributes: {
                'type': 'button'
            },
            textContent: 'Insert To'
        });
    
        insertButton.addEventListener('click', () => {
            insertTo(block.textContent);
        });
    
        block.parentNode.insertAdjacentElement("beforeend", insertButton);
    });    

    // Add copy button for the div's content
    const divContent = parentElement.getAttribute('data-text');
    const divCopyButton = createElement({
        tag: 'button',
        classes: ['copy-btn'],
        attributes: {
            'type': 'button'
        },
        textContent: 'Copy'
    });

    divCopyButton.addEventListener('click', () => {
        copyTextToClipboard(divContent);
    });

    parentElement.insertAdjacentElement("beforeend", divCopyButton);
}

function insertTo(text){
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
