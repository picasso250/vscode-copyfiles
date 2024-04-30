function createElement(config) {
    const { tag, classes, attributes, events, styles, children, text, html } = config;
    
    // Create the element
    const element = document.createElement(tag);
    
    // Add classes
    if (classes && Array.isArray(classes)) {
        element.classList.add(...classes);
    }
    
    // Add attributes
    if (attributes && typeof attributes === 'object') {
        for (const key in attributes) {
            if (attributes.hasOwnProperty(key)) {
                element.setAttribute(key, attributes[key]);
            }
        }
    }
    
    // Add styles
    if (styles && typeof styles === 'object') {
        for (const key in styles) {
            if (styles.hasOwnProperty(key)) {
                element.style[key] = styles[key];
            }
        }
    }
    
    // Add textContent or innerHTML
    if (text && typeof text === 'string') {
        element.textContent = text;
    }
    if (html && typeof html === 'string') {
        element.innerHTML = html;
    }
    
    // Add children
    if (children && Array.isArray(children)) {
        children.forEach(child => {
            if (typeof child === 'string') {
                element.appendChild(document.createTextNode(child));
            } else if (child instanceof HTMLElement) {
                element.appendChild(child);
            } else if (typeof child === 'object') {
                const childElement = createElement(child);
                element.appendChild(childElement);
            }
        });
    }
    
    // Add events
    if (events && typeof events === 'object') {
        for (const key in events) {
            if (events.hasOwnProperty(key)) {
                element.addEventListener(key, events[key]);
            }
        }
    }
    
    return element;
}
