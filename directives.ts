// A Simple Directives Library
// https://github.com/bracketdash/simple-directives/blob/master/README.md
interface SimpleDirective {
    callbacks?: string[];
    element: HTMLElement;
    events?: string[];
    listener?: EventListenerObject;
    type: string;
}
interface SimpleReference {
    bang?: boolean;
    parent: object;
    refArgs?: string[];
    target: string;
}
const simpleDirectives = {
    add: function(element: HTMLElement, type: string, references: string[], preReferences?: string[]): boolean {
        let directive: any = { element, type };
        if (type === "rdo") {
            let existingRdoFound = false;
            this.registry.some(function(directive: SimpleDirective) {
                if (directive.type === "rdo" && directive.element === element) {
                    existingRdoFound = true;
                    return true;
                }
            });
            if (existingRdoFound) {
                return false;
            }
        }
        if (type === "on") {
            directive.listener = this.addEventListeners(element, preReferences, references);
        }
        /*
        let attrParts = attrWhole.split(":");
        // directives which do not have a value before the reference
        if (["if", "html", "rdo"].indexOf(directiveName) !== -1) {
            bindObj.reference = attrParts.shift();
            if (attrParts.length) {
                bindObj.refArgs = attrParts;
            }
        } else {
            bindObj[propMap[directiveName]] = attrParts.shift();
            bindObj.reference = attrParts.shift();
            if (attrParts.length) {
                bindObj.refArgs = attrParts;
            }
        }
        if (directiveName === "for") {
            bindObj.originalHTML = el.innerHTML;
        }
        if (sdForContext) {
            if (!bindObj.itemNames) {
                bindObj.itemNames = [];
            }
            bindObj.itemNames.push(sdForContext.itemName);
            if (Array.isArray(sdForContext.value)) {
                if (typeof sdForContext.value[sdForIndex] === "object") {
                    bindObj[sdForContext.itemName] = sdForContext.value[sdForIndex];
                } else {
                    bindObj[sdForContext.itemName] = {
                        value: sdForContext.value[sdForIndex]
                    };
                }
                bindObj[sdForContext.itemName].$key = sdForIndex;
            } else {
                let key = Object.keys(sdForContext.value)[sdForIndex];
                if (typeof sdForContext.value[key] === "object") {
                    bindObj[sdForContext.itemName] = sdForContext.value[key];
                } else {
                    bindObj[sdForContext.itemName] = {
                        value: sdForContext.value[key]
                    };
                }
                bindObj[sdForContext.itemName].$key = key;
            }
            bindObj[sdForContext.itemName].$collection = sdForContext.value;
            bindObj[sdForContext.itemName].$index = sdForIndex;
        }
        binds[directiveName].push(bindObj);
        if (directiveName === "if") {
            if (sdForContext) {
                let getRefData = {};
                getRefData[sdForContext.itemName] = bindObj[sdForContext.itemName];
                bindObj.value = getRef(bindObj.reference, getRefData);
            } else {
                bindObj.value = getRef(bindObj.reference);
            }
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
        */
        // TODO: the rest of `add`
        if (type === "if") {
            // TODO: get the scope
            const response = this.reference(references[0], {
                /* scope */
            });
            if (response.bang) {
                return !response.parent[response.target];
            } else {
                return !!response.parent[response.target];
            }
        }
        return true;
    },
    addEventListeners: function(element: HTMLElement, events: string[], references: string[]): EventListenerObject {
        // TODO
        const listener = function(event: Event) {
            // TODO
        };
        // TODO
        /*
        if (references.indexOf("$update") !== -1) {
            let attrValIndex: number;
            let refToUpdate;
            let indexToRemove: number;
            while ((indexToRemove = references.indexOf("$update")) !== -1) {
                references.splice(indexToRemove, 1);
            }
            if (bindObj.element.hasAttribute("sd-attr")) {
                if (
                    bindObj.element.tagName === "input" &&
                    ["checkbox", "radio"].indexOf(bindObj.element.getAttribute("type")) !== -1
                ) {
                    refToUpdate = bindObj.element.getAttribute("sd-attr");
                    attrValIndex = refToUpdate.indexOf("checked");
                    if (attrValIndex !== -1) {
                        refToUpdate = refToUpdate.substring(attrValIndex).split(":")[1];
                        attrValIndex = refToUpdate.indexOf(";");
                        if (attrValIndex !== -1) {
                            refToUpdate = refToUpdate.substring(0, attrValIndex);
                        }
                        refToUpdate = getRef(refToUpdate, false, true);
                        if (typeof refToUpdate[refToUpdate.$lastPart] !== "function") {
                            bindObj.updater = function() {
                                refToUpdate[refToUpdate.$lastPart] = bindObj.element.checked;
                            };
                        }
                    }
                } else {
                    refToUpdate = bindObj.element.getAttribute("sd-attr");
                    attrValIndex = refToUpdate.indexOf("value");
                    if (attrValIndex !== -1) {
                        refToUpdate = refToUpdate.substring(attrValIndex).split(":")[1];
                        attrValIndex = refToUpdate.indexOf(";");
                        if (attrValIndex !== -1) {
                            refToUpdate = refToUpdate.substring(0, attrValIndex);
                        }
                        refToUpdate = getRef(refToUpdate, false, true);
                        if (typeof refToUpdate[refToUpdate.$lastPart] !== "function") {
                            bindObj.updater = function() {
                                refToUpdate[refToUpdate.$lastPart] = bindObj.element.value;
                            };
                        }
                    }
                }
            } else if (bindObj.element.hasAttribute("sd-html") && bindObj.element.isContentEditable) {
                refToUpdate = getRef(bindObj.element.getAttribute("sd-html"), false, true);
                if (typeof refToUpdate[refToUpdate.$lastPart] !== "function") {
                    bindObj.updater = function() {
                        refToUpdate[refToUpdate.$lastPart] = bindObj.element.innerHTML;
                    };
                }
            } else if (bindObj.element.hasAttribute("sd-rdo")) {
                refToUpdate = getRef(bindObj.element.getAttribute("sd-rdo"), false, true);
                if (typeof refToUpdate[refToUpdate.$lastPart] !== "function") {
                    bindObj.updater = function() {
                        let value: any;
                        Array.from(document.getElementsByName(bindObj.element.name)).some(function(
                            rdoEl: HTMLInputElement
                        ) {
                            if (rdoEl.checked) {
                                value = rdoEl.value;
                                return true;
                            }
                        });
                        refToUpdate[refToUpdate.$lastPart] = value;
                    };
                }
            }
        }
        if (references.length) {
            bindObj.listener = function(event) {
                let getRefData: any = false;
                let callObject: any = {
                    element: el,
                    event
                };
                if (sdForContext) {
                    getRefData[sdForContext.itemName] = bindObj[sdForContext.itemName];
                    callObject[sdForContext.itemName] = getRefData[sdForContext.itemName];
                }
                references.forEach(function(reference) {
                    if (reference.indexOf("=") !== -1) {
                        let refParts = reference.split("=");
                        let leftRef = getRef(refParts[0], false, true);
                        leftRef[leftRef.$lastPart] = getRef(refParts[1], getRefData);
                    } else {
                        getRef(reference, getRefData).apply(
                            callObject,
                            bindObj.refArgs.map(refArg => getRef(refArg, getRefData) || refArg)
                        );
                    }
                });
            };
        }
        ~~~~~~~~~~~~
        let toggleListener = bindObj.element.addEventListener;
        if (bindObj.element.tagName === "input" && bindObj.element.getAttribute("type") === "radio") {
            let elements: HTMLInputElement[] = Array.from(document.getElementsByName(bindObj.element.name));
            toggleListener = function(eventName, fn) {
                elements.forEach(function(element) {
                    element.addEventListener(eventName, fn);
                });
            };
        }
        if (bindObj.eventName.indexOf(",") !== -1) {
            bindObj.eventName.split(",").forEach(function(singleEventName) {
                if (bindObj.listener) {
                    toggleListener(singleEventName, bindObj.listener);
                }
                if (bindObj.updater) {
                    toggleListener(singleEventName, bindObj.updater);
                }
            });
        } else {
            if (bindObj.listener) {
                toggleListener(bindObj.eventName, bindObj.listener);
            }
            if (bindObj.updater) {
                toggleListener(bindObj.eventName, bindObj.updater);
            }
        }
        */
        return {
            handleEvent: listener
        };
    },
    comparison: function(comparator: string, reference: string, scope: object): SimpleReference {
        const parts = reference.split(comparator);
        let left: any = this.reference(parts[0], scope);
        let right: any = this.reference(parts[1], scope);
        if (typeof left.parent[left.target] === "function") {
            left = left.parent[left.target].apply(scope);
        } else if (left.bang) {
            left = !left.parent[left.target];
        } else {
            left = left.parent[left.target];
        }
        if (typeof right.parent[right.target] === "function") {
            right = right.parent[right.target].apply(scope);
        } else if (right.bang) {
            right = !right.parent[right.target];
        } else {
            right = right.parent[right.target];
        }
        let value: boolean;
        switch (comparator) {
            case "==":
                value = left == right;
                break;
            case "===":
                value = left === right;
                break;
            case "!=":
                value = left != right;
                break;
            case "!==":
                value = left != right;
                break;
            case "<":
                value = left < right;
                break;
            case ">":
                value = left > right;
                break;
            case "<=":
                value = left <= right;
                break;
            case ">=":
                value = left >= right;
                break;
        }
        return {
            parent: { value },
            target: "value"
        };
    },
    preReferenceMap: {
        attr: "attributeName",
        class: "className",
        for: "itemName",
        on: "eventName"
    },
    reference: function(reference: string, scope: object): SimpleReference {
        const fallback = {
            parent: { value: reference },
            target: "value"
        };
        const hasBrackets = reference.indexOf("[") !== -1;
        let bang = false;
        let hasDots: boolean;
        let parent: object;
        let refArgs = reference.split(":");
        let target: string;
        reference = refArgs.shift();
        hasDots = reference.indexOf(".") !== -1;
        if (/[=<!>]/.test(reference)) {
            if (reference.indexOf("!") === 0 && !/[=<!>]/.test(reference.substring(1))) {
                reference = reference.substring(1);
                bang = true;
            } else {
                let comparator = reference.match(/([=<!>]{2,3})/)[0];
                if (["==", "===", "!=", "!==", "<", ">", "<=", ">="].indexOf(comparator) !== -1) {
                    return this.comparison(comparator, reference, scope);
                } else {
                    return fallback;
                }
            }
        }
        if (/[^a-z0-9.[\]$_]/i.test(reference)) {
            return fallback;
        }
        parent = (<any>Object).assign({}, this.root, scope);
        if (!hasBrackets && !hasDots) {
            target = reference;
        } else {
            if (hasBrackets) {
                while (/\[[^\[\]]*\]/.test(reference)) {
                    reference = reference.replace(/\[([^\[\]]*)\]/g, function(_, capture) {
                        let capRef = simpleDirectives.reference(capture, scope);
                        return "." + capRef.parent[capRef.target];
                    });
                }
                if (!hasDots) {
                    hasDots = true;
                }
            }
            if (hasDots) {
                let parts = reference.split(".");
                parts.some(function(part, index) {
                    if (index === parts.length - 1) {
                        target = part;
                    } else if (typeof parent === "object" && parent.hasOwnProperty(part)) {
                        parent = parent[part];
                    } else {
                        parent = { value: reference };
                        target = "value";
                        return true;
                    }
                });
            }
        }
        return { bang, parent, target, refArgs };
    },
    refreshRate: 100,
    register: function(element: HTMLElement, skipUnregister?: boolean) {
        let directiveName: string;
        let expressions: string[];
        let skipChildren = false;
        if (!this.running) {
            this.runner();
        }
        if (!skipUnregister) {
            this.unregister(element);
        }
        ["if", "attr", "class", "for", "html", "on", "rdo"].some(function(type: string) {
            let value: boolean;
            directiveName = `sd-${type}`;
            if (element.hasAttribute(directiveName)) {
                expressions = element
                    .getAttribute(directiveName)
                    .replace(/\s+/, "")
                    .split(";");
            } else {
                return false;
            }
            if (["attr", "class", "for", "on"].indexOf(type) !== -1) {
                expressions.forEach(function(expression: string) {
                    const parts = expression.split(":");
                    const preReferences = parts.shift().split(",");
                    const references = parts.join(":").split(",");
                    simpleDirectives.add(element, type, references, preReferences);
                });
            } else {
                value = simpleDirectives.add(element, type, [expressions[0]]);
            }
            if (type === "if") {
                if (value === false) {
                    element.style.display = "none";
                    return true;
                } else {
                    return false;
                }
            }
            if (type === "for") {
                skipChildren = true;
            }
        });
        if (!skipChildren) {
            Array.from(element.children).forEach(child => this.register(child, true));
        }
    },
    registry: [],
    removeNulls: function(arr: any[]) {
        let index: number;
        while ((index = arr.indexOf(null)) !== -1) {
            this.registry.splice(index, 1);
        }
    },
    root: window,
    runner: function() {
        if (!this.running) {
            this.running = true;
        }
        this.registry.forEach(function(directive: SimpleDirective) {
            if (directive.type !== "on") {
                this.run(directive);
            }
        });
        setTimeout(this.runner, this.refreshRate);
    },
    running: false,
    run: function(directive: SimpleDirective) {
        /*
        let indexToRemove: number;
        if (!runBindsRunning) {
            runBindsRunning = true;
        }
        // bind directives (i.e. everything except sd-on) - if and for need to be first
        ["if", "for", "html", "attr", "rdo", "class"].forEach(function(directiveName) {
            binds[directiveName].forEach(function(bindObj, bindIndex) {
                if (!bindObj.element.parentElement) {
                    binds[directiveName][bindIndex] = false;
                    return;
                }
                let callObject: any = {
                    element: bindObj.element
                };
                let value: any;
                switch (directiveName) {
                    case "attr":
                        callObject.attributeName = bindObj.attributeName;
                        break;
                    case "class":
                        callObject.className = bindObj.className;
                        break;
                    case "for":
                        callObject.itemName = bindObj.itemName;
                        break;
                    default:
                        break;
                }
                if (bindObj.itemNames) {
                    let getRefData = {};
                    bindObj.itemNames.forEach(function(itemName) {
                        getRefData[itemName] = bindObj[itemName];
                        callObject[itemName] = getRefData[itemName];
                    });
                    value = getRef(bindObj.reference, getRefData);
                } else {
                    value = getRef(bindObj.reference);
                }
                if (typeof value === "function") {
                    value = value.apply(
                        callObject,
                        bindObj.refArgs.map(refArg => getRef(refArg) || refArg)
                    );
                }
                // directives that only accept booleans
                if (["if", "class"].indexOf(directiveName) !== -1 && typeof value !== "boolean") {
                    value = !!value;
                }
                // if value hasn't changed, skip the rest of this bind run
                if (bindObj.value && bindObj.value === value) {
                    return;
                }
                if (directiveName === "for") {
                    value = bindObj.originalHTML.repeat(
                        Array.isArray(bindObj.value) ? bindObj.value.length : Object.keys(bindObj.value).length
                    );
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
                        if (bindObj.attributeName.indexOf(",") !== -1) {
                            bindObj.attributeName.split(",").forEach(function(singleAttributeName) {
                                if (typeof value === "undefined") {
                                    if (bindObj.element.hasAttribute(singleAttributeName)) {
                                        bindObj.element.removeAttribute(singleAttributeName);
                                    }
                                } else {
                                    bindObj.element.setAttribute(singleAttributeName, value);
                                }
                            });
                        } else if (typeof value === "undefined") {
                            if (bindObj.element.hasAttribute(bindObj.attributeName)) {
                                bindObj.element.removeAttribute(bindObj.attributeName);
                            }
                        } else {
                            bindObj.element.setAttribute(bindObj.attributeName, value);
                        }
                        break;
                    case "rdo":
                        Array.from(document.getElementsByName(bindObj.element.name)).forEach(function(
                            rdoEl: HTMLInputElement
                        ) {
                            if (rdoEl.value === value) {
                                rdoEl.checked = true;
                            } else {
                                rdoEl.checked = false;
                            }
                        });
                        break;
                    case "class":
                        if (bindObj.className.indexOf(",") !== -1) {
                            bindObj.className.split(",").forEach(function(singleClassName) {
                                if (!value) {
                                    if (bindObj.element.classList.contains(singleClassName)) {
                                        bindObj.element.classList.remove(singleClassName);
                                    }
                                } else if (!bindObj.element.classList.contains(singleClassName)) {
                                    bindObj.element.classList.add(singleClassName);
                                }
                            });
                        } else if (!value) {
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
        */
    },
    unregister: function(parentElement: HTMLElement) {
        this.registry.map(function(directive: SimpleDirective) {
            let { element, type } = directive;
            if (element === parentElement || parentElement.contains(element)) {
                if (type === "on") {
                    directive.events.forEach(function(event) {
                        element.removeEventListener(event, directive.listener);
                    });
                }
                return null;
            }
            return directive;
        });
        this.removeNulls(this.registry);
    }
};
