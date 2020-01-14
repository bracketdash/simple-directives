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

`reference` above can be a function, string, or number using object dot and bracket notation.

Refresh directives:
    directives.refresh()

*/
interface ArrayConstructor {
    from(arrayLike: any, mapFn?, thisArg?): Array<any>;
}
interface Directives {
    refreshRate: number;
    register: Function;
    unregister: Function;
}
interface SdForContext {
    element: HTMLElement,
    itemName: string,
    reference: string,
    value: Object | any[]
}
interface Window {
    directives: Directives;
}
(function() {
    let elCount = 1;
    let runBinds: Function;
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
        // TODO: if this reference is inside of an sd-for, we also need to allow access to `(itemName)` as though it's on `window`
            // add a note to the docs saying references will have access to items in sd-for as though they are on `window`
            // we'll need to pass additional data to getRef()
        let hasBrackets = refStr.indexOf("[") !== -1;
        let hasDots = refStr.indexOf(".") !== -1;
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
    const unregisterDirectives = function(el: HTMLElement, ignore?: string) {
        let indexToRemove: number;
        ["attr", "class", "for", "html", "if", "on"].forEach(function(directiveName) {
            if (binds[directiveName].length) {
                if (el === document.body) {
                    if (directiveName === "on") {
                        binds.on.forEach(function(bindObj) {
                            bindObj.element.removeEventListener(bindObj.eventName, bindObj.listener);
                        });
                    }
                    binds[directiveName].length = 0;
                } else {
                    binds[directiveName].map(function(bindObj) {
                        if (el.contains(bindObj.element)) {
                            return false;
                        }
                        return bindObj;
                    });
                    if (binds[directiveName].indexOf(false) !== -1) {
                        while ((indexToRemove = binds[directiveName].indexOf(false)) !== -1) {
                            binds[directiveName].splice(indexToRemove, 1);
                        }
                    }
                }
            }
        });
    };
    const registerDirectives = function(el: HTMLElement, sdForContext?: SdForContext, sdForIndex?: number) {
        let isFalsyIf = false;
        let isLoop = false;
        if (!elCount) {
            elCount = 1;
        }
        unregisterDirectives(el);
        ["if", "for", "html", "attr", "class", "on"].some(function(directiveName) {
            if (!el.hasAttribute("sd-" + directiveName)) {
                return false;
            }
            let toBind: any[];
            if (["attr"].indexOf(directiveName) !== 1 && el.getAttribute("sd-attr").indexOf(";") !== -1) {
                toBind = el.getAttribute("sd-" + directiveName).split(";");
            } else {
                toBind = [el.getAttribute("sd-" + directiveName)];
            }
            toBind.forEach(function(attrParts) {
                let bindObj: any = {element: el};
                if (["if", "html"].indexOf(directiveName) !== -1) {
                    bindObj.reference = attrParts;
                } else {
                    attrParts = attrParts.split(':');
                    switch (directiveName) {
                        case "attr": bindObj.attributeName = attrParts[0]; break;
                        case "class": bindObj.className = attrParts[0]; break;
                        case "for": bindObj.itemName = attrParts[0]; break;
                        case "on": bindObj.eventName = attrParts[0]; break;
                    }
                    bindObj.reference = attrParts[1];
                }
                if (directiveName === "on") {
                    bindObj.listener = function(event) {
                        // TODO: will need to add sd-for item to getRef *AND the call object* here if !!sdForContext
                        getRef(bindObj.reference).call({
                            element: el,
                            event
                        });
                    };
                    el.addEventListener(bindObj.eventName, bindObj.listener);
                }
                if (sdForContext) {
                    if (Array.isArray(sdForContext.value)) {
                        bindObj[sdForContext.itemName] = {
                            key: sdForIndex,
                            index: sdForIndex,
                            item: sdForContext.value[sdForIndex],
                            value: sdForContext.value[sdForIndex]
                        };
                    } else {
                        let key = Object.keys(sdForContext.value)[sdForIndex];
                        bindObj[sdForContext.itemName] = {
                            key: key,
                            index: sdForIndex,
                            item: sdForContext.value[key],
                            value: sdForContext.value[key]
                        };
                    }
                }
                binds[directiveName].push(bindObj);
                if (directiveName === "if") {
                    // TODO: will need to add sd-for item to getRef here if !!sdForContext
                    bindObj.value = getRef(bindObj.reference);
                    if (!bindObj.value) {
                        el.style.display = "none";
                        isFalsyIf = true;
                        return true;
                    } else {
                        el.style.display = null;
                    }
                } else if (directiveName === "for") {
                    isLoop = true;
                }
            });
        });
        if (isFalsyIf) {
            return;
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
    runBinds = function() {
        let indexToRemove: number;
        runBindsRunning = true;
        ["if", "for", "attr", "class", "html"].forEach(function(directiveName) {
            binds[directiveName].forEach(function(bindObj, bindIndex) {
                if (!bindObj.element.parentElement) {
                    binds[directiveName][bindIndex] = false;
                    return;
                }
                // TODO: will need to add sd-for item to getRef here if bindObj.element is a child of an sd-for
                let value = getRef(bindObj.reference);
                if (typeof value === "function") {
                    // TODO: will need to add sd-for item to the call object here if bindObj.element is a child of an sd-for
                    value = value.call({
                    });
                }
                if (["if", "class"].indexOf(directiveName) !== -1 && typeof value !== "boolean") {
                    value = !!value;
                }
                if (bindObj.value && bindObj.value === value) {
                    return;
                }
                if (directiveName === "for") {
                    value = bindObj.innerHTML.repeat(Array.isArray(bindObj.value) ? bindObj.value.length : Object.keys(bindObj.value).length);
                }
                bindObj.value = value;
                switch (directiveName) {
                    case "if":
                        if (value) {
                            bindObj.element.style.display = null;
                            registerDirectives(bindObj.element);
                        } else {
                            bindObj.element.style.display = "none";
                            unregisterDirectives(bindObj.element, "if");
                        }
                        break;
                    case "for":
                    case "html":
                        Array.from(bindObj.element.children).forEach(function(child) {
                            unregisterDirectives(child);
                        });
                        bindObj.element.innerHTML = value;
                        Array.from(bindObj.element.children).forEach(function(child, index) {
                            if (directiveName === "for") {
                                registerDirectives(child, bindObj, index);
                            } else {
                                registerDirectives(child);
                            }
                        });
                        break;
                    case "attr":
                        if (typeof value === "undefined") {
                            if (bindObj.element.hasAttribute(bindObj.attributeName)) {
                                bindObj.element.removeAttribute(bindObj.attributeName);
                            }
                        } else {
                            bindObj.element.setAttribute(bindObj.attributeName, value);
                        }
                        break;
                    case "class":
                        if (!value) {
                            if (bindObj.element.classList.contains(bindObj.className)) {
                                bindObj.element.classList.remove(bindObj.className);
                            }
                        } else if (!bindObj.element.classList.contains(bindObj.className)) {
                            bindObj.element.classList.add(bindObj.className);
                        }
                        break;
                }
            });
            if (binds[directiveName].indexOf(false) !== -1) {
                while ((indexToRemove = binds[directiveName].indexOf(false)) !== -1) {
                    binds[directiveName].splice(indexToRemove, 1);
                }
            }
        });
        setTimeout(runBinds, window.directives.refreshRate);
    };
    if (document.readyState != "loading") {
        registerDirectives(document.body);
    } else {
        document.addEventListener("DOMContentLoaded", function() {
            registerDirectives(document.body);
        });
    }
    window.directives = {
        refreshRate: 100,
        register: () => registerDirectives(document.body),
        unregister: () => unregisterDirectives(document.body)
    };
})();
