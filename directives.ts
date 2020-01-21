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
    register: this.registry.register,
    registry: {
        add: function(
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
            let args: string[];
            let directive: SimpleDirective = { element, type, references };
            let existingRdoFound = false;
            let reference: string;
            let response: any = true;
            let simpleReference: SimpleReference;
            if (scope) {
                Object.assign(directive, scope);
            }
            if (preReferences) {
                directive.preReferences = preReferences;
                if (preReferenceMap[type]) {
                    directive[preReferenceMap[type]] = preReferences;
                }
            }
            switch (type) {
                case "for":
                    directive.originalHTML = element.innerHTML;
                    break;
                case "if":
                    args = references[0].split(":");
                    reference = response.shift();
                    simpleReference = simpleDirectives.references.convert(reference, directive);
                    response = simpleReference.parent[simpleReference.target];
                    if (typeof response === "function") {
                        response = response.apply(directive, args);
                    }
                    if (simpleReference.bang) {
                        response = !response;
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
                simpleDirectives.watchers.addAction(directive);
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
            let parts: string[];
            let preReferences: string[];
            let references: string[];
            let skipChildren = false;
            let value: any;
            if (!skipUnregister) {
                simpleDirectives.registry.unregister(element);
            }
            ["if", "attr", "class", "for", "html", "on", "rdo"].some(function(type: string) {
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
                        parts = expression.split(":");
                        preReferences = parts.shift().split(",");
                        references = parts.join(":").split(",");
                        simpleDirectives.registry.add(element, type, references, preReferences, scope);
                    });
                } else {
                    value = simpleDirectives.registry.add(element, type, [expressions[0]], [], scope);
                }
                if (type === "if") {
                    if (!value) {
                        element.style.display = "none";
                        skipChildren = true;
                        return true;
                    }
                } else if (type === "for") {
                    skipChildren = true;
                }
            });
            if (!skipChildren) {
                Array.from(element.children).forEach(function(child: HTMLElement) {
                    simpleDirectives.registry.register(child, true);
                });
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
                        simpleDirectives.watchers.removeAction(directive);
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
        createAction: function(directive: SimpleDirective, args: string[]): Function {
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
        },
        removeNulls: function(arr: any[]) {
            let index: number;
            while ((index = arr.indexOf(null)) !== -1) {
                arr.splice(index, 1);
            }
        }
    },
    watchers: {
        addAction: function(directive: SimpleDirective) {
            const args = directive.references[0].split(":").slice(1);
            const action = simpleDirectives.tools.createAction(directive, args);
            directive.action = action;
            simpleDirectives.watchers.cache.push({
                action,
                directive,
                lastValue: false
            });
            if (!simpleDirectives.watchers.running) {
                simpleDirectives.watchers.runner();
                simpleDirectives.watchers.running = true;
            }
        },
        cache: [],
        removeAction: function(directive: SimpleDirective) {
            simpleDirectives.watchers.cache = simpleDirectives.watchers.cache.map(function(simpleAction: SimpleAction) {
                if (simpleAction.action === directive.action) {
                    return null;
                } else {
                    return simpleAction;
                }
            });
            simpleDirectives.tools.removeNulls(simpleDirectives.watchers.cache);
        },
        runner: function() {
            simpleDirectives.watchers.cache.forEach(function(simpleAction: SimpleAction) {
                const { action, directive, lastValue } = simpleAction;
                const args = directive.references[0].split(":");
                const reference = args.shift();
                const simpleReference = simpleDirectives.references.convert(reference, directive);
                let newValue = simpleReference.parent[simpleReference.target];
                if (typeof newValue === "function") {
                    newValue = newValue.apply(directive, args);
                }
                if (simpleReference.bang) {
                    newValue = !newValue;
                }
                if (newValue !== lastValue) {
                    simpleAction.lastValue = newValue;
                    action(newValue);
                }
            });
            setTimeout(simpleDirectives.watchers.runner, 200);
        },
        running: false
    }
};
