// A Simple Directives Library
// https://github.com/bracketdash/simple-directives/blob/master/README.md
const simpleDirectives = {
    events: {
        addListeners: function (directive) {
            let actions = [];
            directive.references.forEach(function (reference) {
                actions.push(simpleDirectives.events.getAction(directive, reference));
            });
            directive.listener = {
                handleEvent: function (event) {
                    actions.forEach(function (action) {
                        action();
                    });
                }
            };
            directive.preReferences.forEach(function (eventName) {
                directive.element.addEventListener(eventName, directive.listener);
            });
        },
        getAction: function (directive, reference) {
            let action;
            if (reference === "$update") {
                return simpleDirectives.events.getUpdater(directive);
            }
            if (reference.indexOf("=") !== -1) {
                const parts = reference.split("=");
                const left = simpleDirectives.references.convert(parts[0], directive);
                const right = simpleDirectives.references.convert(parts[1], directive);
                if (right.bang) {
                    action = function () {
                        if (typeof right.parent[right.target] === "function") {
                            left.parent[left.target] = !right.parent[right.target]();
                        }
                        else {
                            left.parent[left.target] = !right.parent[right.target];
                        }
                    };
                }
                else {
                    action = function () {
                        if (typeof right.parent[right.target] === "function") {
                            left.parent[left.target] = right.parent[right.target]();
                        }
                        else {
                            left.parent[left.target] = right.parent[right.target];
                        }
                    };
                }
            }
            else {
                const parts = reference.split(":");
                const value = simpleDirectives.references.convert(parts[0], directive);
                reference = parts.shift();
                action = function () {
                    let args = parts.map(function (arg) {
                        let value = simpleDirectives.references.convert(arg, directive);
                        return value.parent[value.target];
                    });
                    value.parent[value.target].apply(directive, args);
                };
            }
            return action;
        },
        getUpdater: function (directive) {
            let { element } = directive;
            let refToUpdate;
            let updater;
            if (element.hasAttribute("sd-attr")) {
                let attrValIndex;
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
                    updater = function () {
                        refToUpdate.parent[refToUpdate.target] = element[attr];
                    };
                }
            }
            else if (element.hasAttribute("sd-html") && element.isContentEditable) {
                refToUpdate = simpleDirectives.references.convert(element.getAttribute("sd-html"), directive);
                updater = function () {
                    refToUpdate.parent[refToUpdate.target] = element.innerHTML;
                };
            }
            else if (element.hasAttribute("sd-rdo")) {
                refToUpdate = simpleDirectives.references.convert(element.getAttribute("sd-rdo"), directive);
                updater = function () {
                    let value;
                    Array.from(document.getElementsByName(element.getAttribute("name"))).some(function (el) {
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
    proxies: {
        addAction: function (directive) {
            const { element, references, type } = directive;
            let args = references[0].split(":");
            let reference = args.shift();
            if (!simpleDirectives.proxies.cache[reference]) {
                simpleDirectives.proxies.createRevocable(reference, directive);
            }
            const action = simpleDirectives.tools.createAction(directive, args);
            directive.proxyAction = action;
            simpleDirectives.proxies.cache[reference].push(action);
        },
        cache: {},
        createRevocable: function (reference, directive) {
            const value = simpleDirectives.references.convert(reference, directive);
            simpleDirectives.proxies.cache[reference] = [];
            directive.proxyRef = Proxy.revocable(value.parent, {
                set: function (_, prop, value) {
                    if (prop === value.target) {
                        simpleDirectives.proxies.cache[reference].forEach(function (action) {
                            action(value);
                        });
                    }
                    return value;
                }
            });
            value.parent = directive.proxyRef.proxy;
        },
        removeAction: function (directive) {
            directive.references.forEach(function (reference) {
                simpleDirectives.proxies.cache[reference].map(function (action) {
                    if (action === directive.proxyAction) {
                        return null;
                    }
                    else {
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
        comparison: function (comparator, reference, scope) {
            const parts = reference.split(comparator);
            let left = simpleDirectives.references.convert(parts[0], scope);
            let right = simpleDirectives.references.convert(parts[1], scope);
            if (typeof left.parent[left.target] === "function") {
                left = left.parent[left.target].apply(scope);
            }
            else if (left.bang) {
                left = !left.parent[left.target];
            }
            else {
                left = left.parent[left.target];
            }
            if (typeof right.parent[right.target] === "function") {
                right = right.parent[right.target].apply(scope);
            }
            else if (right.bang) {
                right = !right.parent[right.target];
            }
            else {
                right = right.parent[right.target];
            }
            let value;
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
        convert: function (reference, scope) {
            const fallback = {
                parent: { value: reference },
                target: "value"
            };
            const hasBrackets = reference.indexOf("[") !== -1;
            let bang = false;
            let hasDots;
            let parent;
            let refArgs = reference.split(":");
            let target;
            reference = refArgs.shift();
            hasDots = reference.indexOf(".") !== -1;
            if (/[=<!>]/.test(reference)) {
                if (reference.indexOf("!") === 0 && !/[=<!>]/.test(reference.substring(1))) {
                    reference = reference.substring(1);
                    bang = true;
                }
                else {
                    let comparator = reference.match(/([=<!>]{2,3})/)[0];
                    if (["==", "===", "!=", "!==", "<", ">", "<=", ">="].indexOf(comparator) !== -1) {
                        return simpleDirectives.references.comparison(comparator, reference, scope);
                    }
                    else {
                        return fallback;
                    }
                }
            }
            if (/[^a-z0-9.[\]$_]/i.test(reference)) {
                return fallback;
            }
            parent = Object.assign({}, simpleDirectives.root, scope);
            if (!hasBrackets && !hasDots) {
                target = reference;
            }
            else {
                if (hasBrackets) {
                    while (/\[[^\[\]]*\]/.test(reference)) {
                        reference = reference.replace(/\[([^\[\]]*)\]/g, function (_, capture) {
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
                    parts.some(function (part, index) {
                        if (index === parts.length - 1) {
                            target = part;
                        }
                        else if (typeof parent === "object" && parent.hasOwnProperty(part)) {
                            parent = parent[part];
                        }
                        else {
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
        add: function (element, type, references, preReferences, scope) {
            const preReferenceMap = {
                attr: "attributeName",
                class: "className",
                for: "itemName",
                on: "eventName"
            };
            let directive = { element, type, references };
            let existingRdoFound = false;
            let response = true;
            let simpleReference;
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
                    simpleReference = simpleDirectives.references.convert(references[0], scope);
                    if (simpleReference.bang) {
                        response = !simpleReference.parent[simpleReference.target];
                    }
                    else {
                        response = !!simpleReference.parent[simpleReference.target];
                    }
                    break;
                case "rdo":
                    simpleDirectives.registry.cache.some(function (directive) {
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
            }
            else {
                const reference = references[0];
                const value = simpleDirectives.references.convert(reference, directive);
                if (type === "for" ||
                    /[=<!>]/.test(reference.substring(1)) ||
                    ["string", "number"].indexOf(typeof value.parent[value.target]) !== -1) {
                    simpleDirectives.watchers.addAction(directive);
                }
                else {
                    simpleDirectives.proxies.addAction(directive);
                }
            }
            if (!existingRdoFound) {
                simpleDirectives.registry.cache.push(directive);
            }
            return response;
        },
        cache: [],
        register: function (element, skipUnregister, scope) {
            let directiveName;
            let expressions;
            let skipChildren = false;
            if (!skipUnregister) {
                simpleDirectives.registry.unregister(element);
            }
            ["if", "attr", "class", "for", "html", "on", "rdo"].some(function (type) {
                let value;
                directiveName = `sd-${type}`;
                if (element.hasAttribute(directiveName)) {
                    expressions = element
                        .getAttribute(directiveName)
                        .replace(/\s+/, "")
                        .split(";");
                }
                else {
                    return false;
                }
                if (["attr", "class", "for", "on"].indexOf(type) !== -1) {
                    expressions.forEach(function (expression) {
                        const parts = expression.split(":");
                        const preReferences = parts.shift().split(",");
                        const references = parts.join(":").split(",");
                        if (scope) {
                            simpleDirectives.registry.add(element, type, references, preReferences, scope);
                        }
                        else {
                            simpleDirectives.registry.add(element, type, references, preReferences);
                        }
                    });
                }
                else if (scope) {
                    value = simpleDirectives.registry.add(element, type, [expressions[0]], [], scope);
                }
                else {
                    value = simpleDirectives.registry.add(element, type, [expressions[0]]);
                }
                if (type === "if") {
                    if (value === false) {
                        element.style.display = "none";
                        skipChildren = true;
                        return true;
                    }
                    else {
                        return false;
                    }
                }
                else if (type === "for") {
                    skipChildren = true;
                }
            });
            if (!skipChildren) {
                Array.from(element.children).forEach((child) => simpleDirectives.registry.register(child, true));
            }
        },
        unregister: function (parentElement) {
            simpleDirectives.registry.cache = simpleDirectives.registry.cache.map(function (directive) {
                let { element, type } = directive;
                if (element === parentElement || parentElement.contains(element)) {
                    if (type === "on") {
                        directive.preReferences.forEach(function (event) {
                            element.removeEventListener(event, directive.listener);
                        });
                    }
                    else if (directive.proxyAction) {
                        simpleDirectives.proxies.removeAction(directive);
                    }
                    else {
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
        createAction: function (directive, args) {
            const { type, element, preReferences } = directive;
            let action;
            switch (type) {
                case "if":
                    action = function (value) {
                        if (value) {
                            element.style.display = null;
                            simpleDirectives.registry.register(element);
                        }
                        else {
                            element.style.display = "none";
                            simpleDirectives.registry.unregister(element);
                        }
                    };
                    break;
                case "for":
                case "html":
                    action = function (value) {
                        if (element.children.length) {
                            Array.from(element.children).forEach(function (child) {
                                simpleDirectives.registry.unregister(child);
                            });
                        }
                        element.innerHTML = value;
                        if (element.children.length) {
                            Array.from(element.children).forEach(function (child) {
                                simpleDirectives.registry.unregister(child);
                            });
                        }
                    };
                    break;
                case "attr":
                    action = function (value) {
                        if (preReferences.length > 1) {
                            preReferences.forEach(function (attribute) {
                                if (typeof value === "undefined") {
                                    if (element.hasAttribute(attribute)) {
                                        element.removeAttribute(attribute);
                                    }
                                }
                                else {
                                    element.setAttribute(attribute, value);
                                }
                            });
                        }
                        else {
                            const attribute = preReferences[0];
                            if (typeof value === "undefined") {
                                if (element.hasAttribute(attribute)) {
                                    element.removeAttribute(attribute);
                                }
                            }
                            else {
                                element.setAttribute(attribute, value);
                            }
                        }
                    };
                    break;
                case "rdo":
                    action = function (value) {
                        const radioInputs = Array.from(document.getElementsByName(element.getAttribute("name")));
                        radioInputs.forEach(function (radioInput) {
                            if (radioInput.value === value) {
                                radioInput.checked = true;
                            }
                            else {
                                radioInput.checked = false;
                            }
                        });
                    };
                    break;
                case "class":
                    action = function (value) {
                        if (preReferences.length > 1) {
                            preReferences.forEach(function (className) {
                                if (!value) {
                                    if (element.classList.contains(className)) {
                                        element.classList.remove(className);
                                    }
                                }
                                else if (!element.classList.contains(className)) {
                                    element.classList.add(className);
                                }
                            });
                        }
                        else {
                            const className = preReferences[0];
                            if (!value) {
                                if (element.classList.contains(className)) {
                                    element.classList.remove(className);
                                }
                            }
                            else if (!element.classList.contains(className)) {
                                element.classList.add(className);
                            }
                        }
                    };
                    break;
            }
            return function (value) {
                if (!element.parentElement) {
                    simpleDirectives.registry.unregister(element);
                    return;
                }
                if (typeof value === "function") {
                    args = args.map(function (arg) {
                        const argVal = simpleDirectives.references.convert(arg, directive);
                        return argVal.parent[argVal.target];
                    });
                    value = value.apply(directive, args);
                }
                action(value);
            };
        },
        removeNulls: function (arr) {
            let index;
            while ((index = arr.indexOf(null)) !== -1) {
                arr.splice(index, 1);
            }
        }
    },
    watchers: {
        addAction: function (directive) {
            let args = directive.references[0].split(":");
            args.shift();
            const action = simpleDirectives.tools.createAction(directive, args);
            directive.watcherAction = action;
            simpleDirectives.watchers.cache.push({
                action,
                directive,
                lastValue: false
            });
            if (!simpleDirectives.watchers.running) {
                simpleDirectives.watchers.runner();
            }
        },
        cache: [],
        removeAction: function (directive) {
            simpleDirectives.watchers.cache = simpleDirectives.watchers.cache.map(function (simpleAction) {
                if (simpleAction.action === directive.watcherAction) {
                    return null;
                }
                else {
                    return simpleAction;
                }
            });
            simpleDirectives.tools.removeNulls(simpleDirectives.watchers.cache);
        },
        runner: function () {
            if (!simpleDirectives.watchers.running) {
                simpleDirectives.watchers.running = true;
            }
            simpleDirectives.watchers.cache.forEach(function (simpleAction) {
                const { action, directive, lastValue } = simpleAction;
                const value = simpleDirectives.references.convert(directive.references[0], directive);
                if (value.parent[value.target] != lastValue) {
                    simpleAction.lastValue = value.parent[value.target];
                    action(value.parent[value.target]);
                }
            });
            setTimeout(simpleDirectives.watchers.runner, 250);
        },
        running: false
    }
};
