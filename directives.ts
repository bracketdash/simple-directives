/*

A Simple Directives Library

Add event listeners:
    <element sd-on="event:reference">
    <element sd-on="event1:reference2;event2:reference2;...">
Bind contents:
    <element sd-html="reference">
Bind attributes:
    <element sd-attr="attribute:reference">
    <element sd-attr="attribute1:reference1;attribute2:reference2;...">
Toggle classes:
    <element sd-class="class:reference">
    <element sd-class="class1:reference2;class1:reference2;...">
Create a bound loop:
    <element sd-for="item:reference">
Add a condition:
    <element sd-if="reference">

`reference` can be a function, string, or number using object dot and bracket notation.

Note: This script does not handle misuse; onus is on the dev to make sure inputs are valid.

*/
interface ArrayConstructor {
    from(arrayLike: any, mapFn?, thisArg?): Array<any>;
}
(function() {
    let elCount = 1;
    let runBindsRunning = false;
    const binds = {
        attr: [],
        class: [],
        for: [],
        html: [],
        if: [],
        on: []
    };
    const getRef = function(refStr: string) {
        let hasBrackets = refStr.indexOf("[") > -1;
        let hasDots = refStr.indexOf(".") > -1;
        let reference;
        if (!hasBrackets && !hasDots) {
            reference = window[refStr];
        }
        if (hasBrackets) {
            let bracketsLoop = function(loopRef) {
                loopRef = loopRef.replace(/\[([^\[\]]*)\]/g, function(_, capture) {
                    return "." + getRef(capture);
                });
                if (/\[[^\[\]]*\]/.test(loopRef)) {
                    return bracketsLoop(loopRef);
                } else {
                    return loopRef;
                }
            };
            refStr = bracketsLoop(refStr);
            if (!hasDots) {
                hasDots = true;
            }
        }
        if (hasDots) {
            refStr.split(".").forEach(function(refPart, index) {
                if (!index) {
                    reference = window[refPart];
                } else if (typeof reference === "object" && reference[refPart]) {
                    reference = reference[refPart];
                } else {
                    reference = "";
                }
            });
        }
        return reference;
    };
    const getIfState = function(el: HTMLElement) {
        if (el.hasAttribute("sd-if") && !getRef(el.getAttribute("sd-if"))) {
            return false;
        } else if (el === document.body) {
            return true;
        } else {
            return getIfState(el.parentElement);
        }
    };
    // TODO: give dev ability to call this from the outside
    const registerDirectives = function(el: HTMLElement) {
        let isLoop = false;
        if (el === document.body) {
            unregisterDirectives();
            elCount = 1;
        }
        if (el.hasAttribute('sd-if')) {
            let value = getRef(el.getAttribute('sd-if'));
            binds.if.push({
                element: el,
                reference: el.getAttribute('sd-if'),
                value
            });
            if (!value) {
                el.style.display = "none";
                return;
            } else {
                el.style.display = null;
            }
        }
        if (el.hasAttribute('sd-for')) {
            let params = el.getAttribute('sd-for').split(':');
            binds.for.push({
                element: el,
                itemName: params[0],
                reference: params[1]
            });
            isLoop = true;
        }
        if (el.hasAttribute('sd-html')) {
            binds.html.push({
                element: el,
                reference: el.getAttribute('sd-if')
            });
        }
        if (el.hasAttribute('sd-attr')) {
            // TODO: support semicolon-separated values ala sd-attr"attribute:reference;attribute:reference"
            let params = el.getAttribute('sd-attr').split(':');
            binds.attr.push({
                attributeName: params[0],
                element: el,
                reference: params[1]
            });
        }
        if (el.hasAttribute('sd-class')) {
            // TODO: support semicolon-separated values ala sd-class"class:reference;class:reference"
            let params = el.getAttribute('sd-class').split(':');
            binds.class.push({
                className: params[0],
                element: el,
                reference: params[1]
            });
        }
        if (el.hasAttribute('sd-on')) {
            // TODO: support semicolon-separated values ala sd-on"event:reference;event:reference"
            let params = el.getAttribute('sd-on').split(':');
            const listener = function(event) {
                getRef(params[1]).call({
                    element: el,
                    event
                });
            };
            binds.on.push({
                element: el,
                eventName: params[0],
                listener
            });
            el.addEventListener(params[0], listener);
        }
        if (!isLoop) {
            elCount += el.children.length;
            Array.from(el.children).forEach(function(child) {
                registerDirectives(child);
            });
        }
        elCount -= 1;
        if (!elCount && !runBindsRunning) {
            runBinds();
        }
    };
    const runBinds = function() {
        runBindsRunning = true;
        // TODO: if an sd-if was previously falsy and is now truthy, show the sd-if element and run registerDirectives against it
        // TODO: if we end up building the content for an sd-for, run registerDirectives against the sd-for element
        binds.attr.forEach(function(bindObj) {
            let value = getRef(bindObj.reference);
            if (typeof value === "function") {
                value = value();
            }
            if (bindObj.value && bindObj.value === value) {
                return;
            }
            bindObj.value = value;
            if (typeof value === "undefined") {
                if (bindObj.element.hasAttribute(bindObj.attributeName)) {
                    bindObj.element.removeAttribute(bindObj.attributeName);
                }
            } else {
                bindObj.element.setAttribute(bindObj.attributeName, value);
            }
        });
        binds.class.forEach(function(bindObj) {
            let value = getRef(bindObj.reference);
            if (typeof value === "function") {
                value = value();
            }
            if (typeof value !== "boolean") {
                value = !!value;
            }
            if (bindObj.value && bindObj.value === value) {
                return;
            }
            bindObj.value = value;
            if (!value) {
                if (bindObj.element.classList.contains(bindObj.className)) {
                    bindObj.element.classList.remove(bindObj.className);
                }
            } else if (!bindObj.element.classList.contains(bindObj.className)) {
                bindObj.element.classList.add(bindObj.className);
            }
        });
        binds.html.forEach(function(bindObj) {
            let value = getRef(bindObj.reference);
            if (typeof value === "function") {
                value = value();
            }
            if (bindObj.value && bindObj.value === value) {
                return;
            }
            bindObj.value = !!value;
            bindObj.element.innerHTML = value;
        });
        setTimeout(runBinds, 100);
        // TODO: give dev ability to override refresh rate
        // TODO: give dev ability to stop the runBinds loop
    };
    const unregisterDirectives = function() {
        if (binds.attr.length) {
            binds.attr.length = 0;
        }
        if (binds.class.length) {
            binds.class.length = 0;
        }
        if (binds.for.length) {
            binds.for.length = 0;
        }
        if (binds.html.length) {
            binds.html.length = 0;
        }
        if (binds.if.length) {
            binds.if.length = 0;
        }
        if (binds.on.length) {
            binds.on.forEach(function(bindObj) {
                bindObj.element.removeEventListener(bindObj.eventName, bindObj.listener);
            });
            binds.on.length = 0;
        }
    };
    if (document.readyState != "loading") {
        registerDirectives(document.body);
    } else {
        document.addEventListener("DOMContentLoaded", function() {
            registerDirectives(document.body);
        });
    }
})();
