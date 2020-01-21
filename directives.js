// A Simple Directives Library
// https://github.com/bracketdash/simple-directives/blob/master/README.md
(function () {
    let registry = [];
    let watchers = [];
    let watchersRunning = false;
    /*
     * DIRECTIVE REGISTRATION
     * * * * * * * * * * * * */
    function register(element, skipUnregister, scope) {
        let attributeValue;
        let directiveName;
        let expressions;
        let parts;
        let preReferences;
        let references;
        let skipChildren = false;
        let value;
        if (!skipUnregister) {
            unregister(element);
        }
        ["if", "attr", "class", "for", "html", "on", "rdo"].some(function (type) {
            directiveName = `sd-${type}`;
            attributeValue = element.getAttribute(directiveName);
            if (attributeValue) {
                expressions = attributeValue.replace(/\s+/, "").split(";");
            }
            else {
                // skip this attribute but look for more
                return false;
            }
            if (is(type).oneOf(["attr", "class", "for", "on"])) {
                expressions.forEach(function (expression) {
                    parts = expression.split(":");
                    preReferences = parts.shift().split(",");
                    references = parts.join(":").split(",");
                    addDirective(element, type, references, preReferences, scope);
                });
            }
            else {
                value = addDirective(element, type, [expressions[0]], [], scope);
            }
            if (type === "if") {
                if (!value) {
                    element.style.display = "none";
                    skipChildren = true;
                    // skip this attribute and do NOT look for more
                    return true;
                }
            }
            else if (type === "for") {
                skipChildren = true;
            }
        });
        if (!skipChildren) {
            Array.from(element.children).forEach(function (child) {
                register(child, true);
            });
        }
    }
    function unregister(target) {
        registry = registry.map(function (directive) {
            let { element, type, preReferences, listener, action } = directive;
            if (element === target || target.contains(element)) {
                if (type === "on") {
                    preReferences.forEach(function (event) {
                        element.removeEventListener(event, listener);
                    });
                }
                else {
                    watchers = watchers.map(function (simpleAction) {
                        if (simpleAction.action === action) {
                            return null;
                        }
                        else {
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
    function addDirective(element, type, references, preReferences, scope) {
        const preReferenceMap = {
            attr: "attributeName",
            class: "className",
            for: "itemName",
            on: "eventName"
        };
        let directive = { element, type, references };
        let existingRdoFound = false;
        let response = true;
        if (scope) {
            Object.assign(directive, scope);
        }
        if (preReferences) {
            directive.preReferences = preReferences;
            if (preReferenceMap[type]) {
                directive[preReferenceMap[type]] = preReferences;
            }
        }
        if (type === "on") {
            addListeners(directive);
        }
        else {
            if (type === "for") {
                directive.originalHTML = element.innerHTML;
            }
            else if (type === "if") {
                response = !!getSimpleValue(getSimpleReference(references[0], directive));
            }
            else if (type === "rdo") {
                registry.some(function (directive) {
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
    /*
     * EVENT LISTENERS
     * * * * * * * * * */
    function addListeners(directive) {
        let actions = [];
        directive.references.forEach(function (reference) {
            actions.push(getEventAction(directive, reference));
        });
        directive.listener = {
            handleEvent: function (event) {
                actions.forEach(function (action) {
                    action(event);
                });
            }
        };
        directive.preReferences.forEach(function (eventName) {
            directive.element.addEventListener(eventName, directive.listener);
        });
    }
    function getEventAction(directive, reference) {
        let action;
        if (reference === "$update") {
            return getUpdater(directive);
        }
        if (reference.indexOf("=") !== -1) {
            const parts = reference.split("=");
            const left = getSimpleReference(parts[0], directive);
            const right = getSimpleReference(parts[1], directive);
            action = function (event) {
                left.parent[left.target] = getSimpleValue(right);
            };
        }
        else {
            const simpleReference = getSimpleReference(reference, directive);
            action = function (event) {
                simpleReference.parent[simpleReference.target].apply(Object.assign({ event }, directive), simpleReference.args.map(function (arg) {
                    let value = getSimpleReference(arg, directive);
                    return value.parent[value.target];
                }));
            };
        }
        return action;
    }
    function getUpdater(directive) {
        let { element } = directive;
        let refToUpdate;
        let updater;
        if (element.hasAttribute("sd-attr")) {
            let attrValIndex;
            let attr = "value";
            refToUpdate = element.getAttribute("sd-attr");
            if (element.tagName === "input" && is(element.getAttribute("type")).oneOf(["checkbox", "radio"])) {
                attr = "checked";
            }
            attrValIndex = refToUpdate.indexOf(attr);
            if (attrValIndex !== -1) {
                refToUpdate = refToUpdate.substring(attrValIndex).split(":")[1];
                attrValIndex = refToUpdate.indexOf(";");
                if (attrValIndex !== -1) {
                    refToUpdate = refToUpdate.substring(0, attrValIndex);
                }
                refToUpdate = getSimpleReference(refToUpdate, directive);
                updater = function () {
                    refToUpdate.parent[refToUpdate.target] = element[attr];
                };
            }
        }
        else if (element.hasAttribute("sd-html") && element.isContentEditable) {
            refToUpdate = getSimpleReference(element.getAttribute("sd-html"), directive);
            updater = function () {
                refToUpdate.parent[refToUpdate.target] = element.innerHTML;
            };
        }
        else if (element.hasAttribute("sd-rdo")) {
            refToUpdate = getSimpleReference(element.getAttribute("sd-rdo"), directive);
            updater = function () {
                const radioInputs = Array.from(document.getElementsByName(element.getAttribute("name")));
                let value;
                radioInputs.some(function (radioInput) {
                    if (radioInput.checked) {
                        value = radioInput.value;
                        return true;
                    }
                });
                refToUpdate.parent[refToUpdate.target] = value;
            };
        }
        return updater;
    }
    /*
     * WATCHERS
     * * * * * */
    function addWatcher(directive) {
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
        watchers.forEach(function (simpleAction) {
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
    function createAction(directive, args) {
        const { type, element, preReferences } = directive;
        let action;
        switch (type) {
            case "if":
                action = function (value) {
                    if (value) {
                        element.style.display = null;
                        register(element);
                    }
                    else {
                        element.style.display = "none";
                        unregister(element);
                    }
                };
                break;
            case "for":
            case "html":
                action = function (value) {
                    if (element.children.length) {
                        Array.from(element.children).forEach(function (child) {
                            unregister(child);
                        });
                    }
                    element.innerHTML = value;
                    if (element.children.length) {
                        Array.from(element.children).forEach(function (child) {
                            unregister(child);
                        });
                    }
                };
                break;
            case "attr":
                action = function (value) {
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
                unregister(element);
                return;
            }
            if (typeof value === "function") {
                args = args.map(function (arg) {
                    const simpleReference = getSimpleReference(arg, directive);
                    return simpleReference.parent[simpleReference.target];
                });
                value = value.apply(directive, args);
            }
            action(value);
        };
    }
    /*
     * REFERENCE PROCESSING
     * * * * * * * * * * * */
    function getSimpleReference(reference, scope) {
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
        let hasDots;
        let parent;
        let target;
        reference = args.shift();
        hasDots = reference.indexOf(".") !== -1;
        if (/[=<!>]/.test(reference)) {
            if (reference.indexOf("!") === 0 && !/[=<!>]/.test(reference.substring(1))) {
                reference = reference.substring(1);
                bang = true;
            }
            else {
                const comparator = reference.match(/([=<!>]{2,3})/)[0];
                if (is(comparator).oneOf(["==", "===", "!=", "!==", "<", ">", "<=", ">="])) {
                    return getComparisonReference(comparator, reference, scope);
                }
                else {
                    return fallback;
                }
            }
        }
        if (/[^a-z0-9.[\]$_]/i.test(reference)) {
            return fallback;
        }
        parent = Object.assign({}, window.simpleDirectives.root, scope);
        if (!hasBrackets && !hasDots) {
            if (parent.hasOwnProperty(reference)) {
                target = reference;
            }
            else {
                return fallback;
            }
        }
        else {
            if (hasBrackets) {
                while (/\[[^\[\]]*\]/.test(reference)) {
                    reference = reference.replace(/\[([^\[\]]*)\]/g, function (_, capture) {
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
        return { args, bang, parent, scope, target };
    }
    function getComparisonReference(comparator, reference, scope) {
        const parts = reference.split(comparator);
        const left = getSimpleValue(getSimpleReference(parts[0], scope));
        const right = getSimpleValue(getSimpleReference(parts[1], scope));
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
            scope,
            target: "value"
        };
    }
    function getSimpleValue({ args, bang, parent, scope, target }) {
        let value = parent[target];
        if (typeof value === "function") {
            value = value.apply(scope, args.map(function (arg) {
                const simpleReference = getSimpleReference(arg, scope);
                return simpleReference.parent[simpleReference.target];
            }));
        }
        return bang ? !value : value;
    }
    /*
     * UTILITIES
     * * * * * * */
    function is(target) {
        return {
            oneOf: function (arr) {
                return arr.indexOf(target) !== -1;
            }
        };
    }
    function removeNulls(arr) {
        let index;
        while ((index = arr.indexOf(null)) !== -1) {
            arr.splice(index, 1);
        }
    }
    window.simpleDirectives = {
        is,
        register,
        registry,
        removeNulls,
        root: window,
        unregister,
        watchers
    };
})();
