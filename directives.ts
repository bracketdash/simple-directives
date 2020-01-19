// A Simple Directives Library
// https://github.com/bracketdash/simple-directives/blob/master/README.md
interface RevocableProxy {
    proxy: any,
    revoke: Function;
}
interface SimpleDirective {
    element: HTMLElement;
    listener?: EventListenerObject;
    originalHTML?: string;
    preReferences?: string[];
    proxyAction?: Function;
    proxyRef?: RevocableProxy;
    references: string[];
    type: string;
}
interface SimpleReference {
    bang?: boolean;
    parent: object;
    refArgs?: string[];
    target: string;
}
const simpleDirectives = {
    events: {
        addListeners: function(directive: SimpleDirective) {
            let actions: Function[] = [];
            directive.references.forEach(function(reference) {
                actions.push(simpleDirectives.events.getAction(directive, reference));
            });
            directive.listener = {
                handleEvent: function(event: Event) {
                    actions.forEach(function(action: Function) {
                        action();
                    });
                }
            };
            directive.preReferences.forEach(function(eventName) {
                directive.element.addEventListener(eventName, directive.listener);
            });
        },
        getAction: function(directive: SimpleDirective, reference: string): Function {
            let action: Function;
            if (reference === "$update") {
                return simpleDirectives.events.getUpdater(directive);
            }
            if (reference.indexOf("=") !== -1) {
                const parts = reference.split("=");
                const left = simpleDirectives.references.convert(parts[0], directive);
                const right = simpleDirectives.references.convert(parts[1], directive);
                if (right.bang) {
                    action = function() {
                        if (typeof right.parent[right.target] === "function") {
                            left.parent[left.target] = !right.parent[right.target]();
                        } else {
                            left.parent[left.target] = !right.parent[right.target];
                        }
                    };
                } else {
                    action = function() {
                        if (typeof right.parent[right.target] === "function") {
                            left.parent[left.target] = right.parent[right.target]();
                        } else {
                            left.parent[left.target] = right.parent[right.target];
                        }
                    };
                }
            } else {
                const parts = reference.split(":");
                const value = simpleDirectives.references.convert(parts[0], directive);
                reference = parts.shift();
                action = function() {
                    let args = parts.map(function(arg) {
                        let value = simpleDirectives.references.convert(arg, directive);
                        return value.parent[value.target];
                    });
                    value.parent[value.target].apply(directive, args);
                };
            }
            return action;
        },
        getUpdater: function(directive: SimpleDirective): Function {
            // TODO
            return function() {};
            /*
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
            */
        }
    },
    proxies: {
        addAction: function(directive: SimpleDirective) {
            // TODO
            // check if reference exists in this.proxies first - if so, just add more to the same proxy handler
            // check out why Vue.delete and Vue.set are needed; we probably need the same thing
            // `sd-for` needs to be deep-proxied, btw (array of objects)
            // other references should evaluate to simple values
            // don't forget about comparisons -- will need to proxy to both sub-references
            // if it's not an `sd-for` but the reference is to an object, proxy for truthy or falsy changes only
            /*
            const preReferenceMap = {
                attr: "attributeName",
                class: "className",
                for: "itemName",
                on: "eventName"
            };
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
        cache: {},
        removeAction: function(directive: SimpleDirective) {
            directive.references.forEach(function(reference) {
                simpleDirectives.proxies.cache[reference].map(function(action: Function) {
                    if (action === directive.proxyAction) {
                        return null;
                    } else {
                        return action;
                    }
                });
                simpleDirectives.tools.removeNulls(simpleDirectives.proxies.cache[reference]);
                if (!simpleDirectives.proxies.cache[reference].length) {
                    directive.proxyRef.revoke();
                    delete simpleDirectives.proxies.cache[reference];
                }
            });
        }
    },
    references: {
        comparison: function(comparator: string, reference: string, scope: object): SimpleReference {
            const parts = reference.split(comparator);
            let left: any = simpleDirectives.references.convert(parts[0], scope);
            let right: any = simpleDirectives.references.convert(parts[1], scope);
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
        convert: function(reference: string, scope: object): SimpleReference {
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
                        return simpleDirectives.references.comparison(comparator, reference, scope);
                    } else {
                        return fallback;
                    }
                }
            }
            if (/[^a-z0-9.[\]$_]/i.test(reference)) {
                return fallback;
            }
            parent = (<any>Object).assign({}, simpleDirectives.root, scope);
            if (!hasBrackets && !hasDots) {
                target = reference;
            } else {
                if (hasBrackets) {
                    while (/\[[^\[\]]*\]/.test(reference)) {
                        reference = reference.replace(/\[([^\[\]]*)\]/g, function(_, capture) {
                            let capRef = simpleDirectives.references.convert(capture, scope);
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
        }
    },
    registry: {
        add: function(
            element: HTMLElement,
            type: string,
            references: string[],
            preReferences?: string[],
            scope?: object
        ): boolean {
            let directive: SimpleDirective = { element, type, references };
            let existingRdoFound = false;
            let response = true;
            let simpleReference: SimpleReference;
            if (scope) {
                Object.assign(directive, scope);
            }
            if (preReferences) {
                directive.preReferences = preReferences;
            }
            switch (type) {
                case "for":
                    directive.originalHTML = element.innerHTML;
                    break;
                case "if":
                    simpleReference = simpleDirectives.references.convert(references[0], scope);
                    if (simpleReference.bang) {
                        response = !simpleReference.parent[simpleReference.target];
                    } else {
                        response = !!simpleReference.parent[simpleReference.target];
                    }
                    break;
                case "rdo":
                    simpleDirectives.registry.cache.some(function(directive: SimpleDirective) {
                        if (directive.type === "rdo" && directive.element === element) {
                            existingRdoFound = true;
                        }
                    });
                    break;
                default:
                    break;
            }
            if (type === "on") {
                simpleDirectives.events.addListeners(directive);
            } else {
                simpleDirectives.proxies.addAction(directive);
            }
            if (!existingRdoFound) {
                simpleDirectives.registry.cache.push(directive);
            }
            return response;
        },
        cache: [],
        register: function(element: HTMLElement, skipUnregister?: boolean, scope?: object) {
            let directiveName: string;
            let expressions: string[];
            let skipChildren = false;
            if (!skipUnregister) {
                simpleDirectives.registry.unregister(element);
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
                        if (scope) {
                            simpleDirectives.registry.add(element, type, references, preReferences, scope);
                        } else {
                            simpleDirectives.registry.add(element, type, references, preReferences);
                        }
                    });
                } else if (scope) {
                    value = simpleDirectives.registry.add(element, type, [expressions[0]], [], scope);
                } else {
                    value = simpleDirectives.registry.add(element, type, [expressions[0]]);
                }
                if (type === "if") {
                    if (value === false) {
                        element.style.display = "none";
                        skipChildren = true;
                        return true;
                    } else {
                        return false;
                    }
                } else if (type === "for") {
                    skipChildren = true;
                }
            });
            if (!skipChildren) {
                Array.from(element.children).forEach((child: HTMLElement) =>
                    simpleDirectives.registry.register(child, true)
                );
            }
        },
        unregister: function(parentElement: HTMLElement) {
            simpleDirectives.registry.cache = simpleDirectives.registry.cache.map(function(directive: SimpleDirective) {
                let { element, type } = directive;
                if (element === parentElement || parentElement.contains(element)) {
                    if (type === "on") {
                        directive.preReferences.forEach(function(event) {
                            element.removeEventListener(event, directive.listener);
                        });
                    } else {
                        simpleDirectives.proxies.removeAction(directive);
                    }
                    return null;
                }
                return directive;
            });
            simpleDirectives.tools.removeNulls(simpleDirectives.registry.cache);
        }
    },
    root: window,
    tools: {
        removeNulls: function(arr: any[]) {
            let index: number;
            while ((index = arr.indexOf(null)) !== -1) {
                arr.splice(index, 1);
            }
        }
    }
};
