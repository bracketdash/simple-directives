// A Simple Directives Library
// https://github.com/bracketdash/simple-directives/blob/master/README.md
interface SimpleAction {
    action: Function;
    directive: SimpleDirective;
    lastValue: any;
}
interface SimpleDirective {
    element: HTMLElement;
    listener?: EventListenerObject;
    originalHTML?: string;
    preReferences?: string[];
    references: string[];
    type: string;
    action?: Function;
}
interface SimpleReference {
    args?: string[];
    bang?: boolean;
    parent: object;
    scope: object;
    target: string;
}
interface Window {
    simpleDirectives: object;
}
(function() {
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
                let { element } = directive;
                let refToUpdate: any;
                let updater: Function;
                if (element.hasAttribute("sd-attr")) {
                    let attrValIndex: number;
                    let attr = "value";
                    refToUpdate = element.getAttribute("sd-attr");
                    if (element.tagName === "input" && ["checkbox", "radio"].indexOf(element.getAttribute("type")) !== -1) {
                        attr = "checked";
                    }
                    attrValIndex = refToUpdate.indexOf(attr);
                    if (attrValIndex !== -1) {
                        refToUpdate = refToUpdate.substring(attrValIndex).split(":")[1];
                        attrValIndex = refToUpdate.indexOf(";");
                        if (attrValIndex !== -1) {
                            refToUpdate = refToUpdate.substring(0, attrValIndex);
                        }
                        refToUpdate = simpleDirectives.references.convert(refToUpdate, directive);
                        updater = function() {
                            refToUpdate.parent[refToUpdate.target] = element[attr];
                        };
                    }
                } else if (element.hasAttribute("sd-html") && element.isContentEditable) {
                    refToUpdate = simpleDirectives.references.convert(element.getAttribute("sd-html"), directive);
                    updater = function() {
                        refToUpdate.parent[refToUpdate.target] = element.innerHTML;
                    };
                } else if (element.hasAttribute("sd-rdo")) {
                    refToUpdate = simpleDirectives.references.convert(element.getAttribute("sd-rdo"), directive);
                    updater = function() {
                        let value: any;
                        Array.from(document.getElementsByName(element.getAttribute("name"))).some(function(
                            el: HTMLInputElement
                        ) {
                            if (el.checked) {
                                value = el.value;
                                return true;
                            }
                        });
                        refToUpdate.parent[refToUpdate.target] = value;
                    };
                }
                return updater;
            }
        },
        root: window
    };

    // INITIALIZE OUR CENTRAL REPOSITORIES

    const registry: SimpleDirective[] = [];
    const watchers: any[] = [];
    let watchersRunning = false;

    // DIRECTIVE REGISTRATION

    function register(element: HTMLElement, skipUnregister?: boolean, scope?: object) {
        let attributeValue: string;
        let directiveName: string;
        let expressions: string[];
        let parts: string[];
        let preReferences: string[];
        let references: string[];
        let skipChildren = false;
        let value: any;
        if (!skipUnregister) {
            unregister(element);
        }
        ["if", "attr", "class", "for", "html", "on", "rdo"].some(function(type: string) {
            directiveName = `sd-${type}`;
            attributeValue = element.getAttribute(directiveName);
            if (attributeValue) {
                expressions = attributeValue.replace(/\s+/, "").split(";");
            } else {
                // skip this attribute but look for more
                return false;
            }
            if (is(type).oneOf(["attr", "class", "for", "on"])) {
                expressions.forEach(function(expression: string) {
                    parts = expression.split(":");
                    preReferences = parts.shift().split(",");
                    references = parts.join(":").split(",");
                    addDirective(element, type, references, preReferences, scope);
                });
            } else {
                value = addDirective(element, type, [expressions[0]], [], scope);
            }
            if (type === "if") {
                if (!value) {
                    element.style.display = "none";
                    skipChildren = true;
                    // skip this attribute and do NOT look for more
                    return true;
                }
            } else if (type === "for") {
                skipChildren = true;
            }
        });
        if (!skipChildren) {
            Array.from(element.children).forEach(function(child: HTMLElement) {
                register(child, true);
            });
        }
    }

    function addDirective(
        element: HTMLElement,
        type: string,
        references: string[],
        preReferences?: string[],
        scope?: object
    ): boolean {
        const preReferenceMap = {
            attr: "attributeName",
            class: "className",
            for: "itemName",
            on: "eventName"
        };
        let directive: SimpleDirective = { element, type, references };
        let existingRdoFound = false;
        let response: any = true;
        if (scope) {
            Object.assign(directive, scope);
        }
        if (preReferences) {
            // TODO: see if we can do without adding preReferences to the directive (redundant)
            directive.preReferences = preReferences;
            if (preReferenceMap[type]) {
                directive[preReferenceMap[type]] = preReferences;
            }
        }
        if (type === "on") {
            // TODO
            simpleDirectives.events.addListeners(directive);
        } else {
            if (type === "for") {
                directive.originalHTML = element.innerHTML;
            } else if (type === "if") {
                response = !!getSimpleValue(getSimpleReference(references[0], directive));
            } else if (type === "rdo") {
                registry.some(function(directive: SimpleDirective) {
                    if (directive.type === "rdo" && directive.element === element) {
                        existingRdoFound = true;
                    }
                });
            }
            addWatcher(directive);
        }
        if (!existingRdoFound) {
            registry.push(directive);
        }
        return response;
    }
    
    // WHO WATCHES THE WATCHERS?
    
    function addWatcher(directive: SimpleDirective) {
        const args = directive.references[0].split(":").slice(1);
        const action = createAction(directive, args);
        directive.action = action;
        watchers.push({
            action,
            directive,
            lastValue: false
        });
        if (!watchersRunning) {
            watchMan();
            watchersRunning = true;
        }
    }
    
    function watchMan() {
        watchers.forEach(function(simpleAction: SimpleAction) {
            const { action, directive, lastValue } = simpleAction;
            const args = directive.references[0].split(":");
            const reference = args.shift();
            const newValue = getSimpleValue(getSimpleReference(reference, directive));
            if (newValue !== lastValue) {
                simpleAction.lastValue = newValue;
                action(newValue);
            }
        });
        setTimeout(watchMan, 200);
    }
    
    // SET UP ACTIONS TO FIRE WHEN DATA CHANGES
    
    function createAction(directive: SimpleDirective, args: string[]): Function {
        // TODO: START HERE
        const { type, element, preReferences } = directive;
        let action: Function;
        switch (type) {
            case "if":
                action = function(value) {
                    if (value) {
                        element.style.display = null;
                        simpleDirectives.registry.register(element);
                    } else {
                        element.style.display = "none";
                        simpleDirectives.registry.unregister(element);
                    }
                };
                break;
            case "for":
            case "html":
                action = function(value) {
                    if (element.children.length) {
                        Array.from(element.children).forEach(function(child: HTMLElement) {
                            simpleDirectives.registry.unregister(child);
                        });
                    }
                    element.innerHTML = value;
                    if (element.children.length) {
                        Array.from(element.children).forEach(function(child: HTMLElement) {
                            simpleDirectives.registry.unregister(child);
                        });
                    }
                };
                break;
            case "attr":
                action = function(value) {
                    if (preReferences.length > 1) {
                        preReferences.forEach(function(attribute) {
                            if (typeof value === "undefined") {
                                if (element.hasAttribute(attribute)) {
                                    element.removeAttribute(attribute);
                                }
                            } else {
                                element.setAttribute(attribute, value);
                            }
                        });
                    } else {
                        const attribute = preReferences[0];
                        if (typeof value === "undefined") {
                            if (element.hasAttribute(attribute)) {
                                element.removeAttribute(attribute);
                            }
                        } else {
                            element.setAttribute(attribute, value);
                        }
                    }
                };
                break;
            case "rdo":
                action = function(value) {
                    const radioInputs = Array.from(document.getElementsByName(element.getAttribute("name")));
                    radioInputs.forEach(function(radioInput: HTMLInputElement) {
                        if (radioInput.value === value) {
                            radioInput.checked = true;
                        } else {
                            radioInput.checked = false;
                        }
                    });
                };
                break;
            case "class":
                action = function(value) {
                    if (preReferences.length > 1) {
                        preReferences.forEach(function(className) {
                            if (!value) {
                                if (element.classList.contains(className)) {
                                    element.classList.remove(className);
                                }
                            } else if (!element.classList.contains(className)) {
                                element.classList.add(className);
                            }
                        });
                    } else {
                        const className = preReferences[0];
                        if (!value) {
                            if (element.classList.contains(className)) {
                                element.classList.remove(className);
                            }
                        } else if (!element.classList.contains(className)) {
                            element.classList.add(className);
                        }
                    }
                };
                break;
        }
        return function(value) {
            if (!element.parentElement) {
                simpleDirectives.registry.unregister(element);
                return;
            }
            if (typeof value === "function") {
                args = args.map(function(arg) {
                    const argVal = simpleDirectives.references.convert(arg, directive);
                    return argVal.parent[argVal.target];
                });
                value = value.apply(directive, args);
            }
            action(value);
        };
    }

    // REFERENCE PROCESSING

    function getSimpleReference(reference: string, scope: object): SimpleReference {
        const fallback = {
            parent: {
                value: reference
            },
            scope,
            target: "value"
        };
        const hasBrackets = reference.indexOf("[") !== -1;
        let args = reference.split(":");
        let bang = false;
        let hasDots: boolean;
        let parent: object;
        let target: string;
        reference = args.shift();
        hasDots = reference.indexOf(".") !== -1;
        if (/[=<!>]/.test(reference)) {
            if (reference.indexOf("!") === 0 && !/[=<!>]/.test(reference.substring(1))) {
                reference = reference.substring(1);
                bang = true;
            } else {
                const comparator = reference.match(/([=<!>]{2,3})/)[0];
                if (is(comparator).oneOf(["==", "===", "!=", "!==", "<", ">", "<=", ">="])) {
                    return getComparisonReference(comparator, reference, scope);
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
            if (parent.hasOwnProperty(reference)) {
                target = reference;
            } else {
                return fallback;
            }
        } else {
            if (hasBrackets) {
                while (/\[[^\[\]]*\]/.test(reference)) {
                    reference = reference.replace(/\[([^\[\]]*)\]/g, function(_, capture) {
                        const cr = getSimpleReference(capture, scope);
                        return "." + cr.parent[cr.target];
                    });
                }
                if (!hasDots) {
                    hasDots = true;
                }
            }
            if (hasDots) {
                const parts = reference.split(".");
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
        return { args, bang, parent, scope, target };
    }

    function getComparisonReference(comparator: string, reference: string, scope: object): SimpleReference {
        const parts = reference.split(comparator);
        const left: any = getSimpleValue(getSimpleReference(parts[0], scope));
        const right: any = getSimpleValue(getSimpleReference(parts[1], scope));
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
            scope,
            target: "value"
        };
    }

    function getSimpleValue({ args, bang, parent, scope, target }: SimpleReference): any {
        let value = parent[target];
        if (typeof value === "function") {
            value = value.apply(scope, args);
        }
        return bang ? !value : value;
    }

    // UNREGISTER DIRECTIVES

    function unregister(target: HTMLElement) {
        registry = registry.map(function(directive: SimpleDirective) {
            let { element, type, preReferences, listener, action } = directive;
            if (element === target || target.contains(element)) {
                if (type === "on") {
                    preReferences.forEach(function(event) {
                        element.removeEventListener(event, listener);
                    });
                } else {
                    watchers = watchers.map(function(simpleAction: SimpleAction) {
                        if (simpleAction.action === action) {
                            return null;
                        } else {
                            return simpleAction;
                        }
                    });
                    removeNulls(watchers);
                }
                return null;
            }
            return directive;
        });
        removeNulls(registry);
    }

    // UTILITIES

    function is(target: any) {
        return {
            oneOf: function(arr: any[]) {
                return arr.indexOf(target) !== -1;
            }
        };
    }

    function removeNulls(arr: any[]) {
        let index: number;
        while ((index = arr.indexOf(null)) !== -1) {
            arr.splice(index, 1);
        }
    }

    window.simpleDirectives = { register, registry, unregister, watchers };
})();
