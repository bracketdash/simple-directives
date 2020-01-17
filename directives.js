// A Simple Directives Library
// https://github.com/bracketdash/simple-directives/blob/master/README.md
(function () {
    var binds = {
        attr: [],
        class: [],
        for: [],
        html: [],
        if: [],
        on: [],
        rdo: []
    };
    var propMap = {
        attr: "attributeName",
        class: "className",
        for: "itemName",
        on: "eventName"
    };
    var elCount = 1;
    var runBindsRunning = false;
    /* * * * * * *
     * FUNCTIONS *
     * * * * * * */
    // these lets are a workaround for a flow analysis bug in the TypeScript compiler (would normally be consts)
    var bracketsLoop;
    var getInitialRef;
    var getRef;
    var registerDirectives;
    var toggleEventListeners;
    var runBinds;
    var unregisterDirectives;
    // bracketsLoop: used within getRef to expand bracket groups in reference strings
    bracketsLoop = function (loopRef) {
        loopRef = loopRef.replace(/\[([^\[\]]*)\]/g, function (_, capture) {
            return "." + getRef(capture);
        });
        if (/\[[^\[\]]*\]/.test(loopRef)) {
            return bracketsLoop(loopRef);
        }
        else {
            return loopRef;
        }
    };
    // getInitialRef: used within getRef to get the initial reference object and add any scope data
    getInitialRef = function (data, jrProp) {
        var baseRef = Object.assign(data, window.directives.baseReference);
        return baseRef[jrProp];
    };
    // getRef: converts a reference string into an actual reference (return empty string if invalid reference)
    getRef = function (refStr, data, preserveReference) {
        var hasBrackets = refStr.indexOf("[") !== -1;
        var hasDots = refStr.indexOf(".") !== -1;
        var lastPart;
        var reference;
        var returnOpposite = false;
        if (refStr.indexOf("!") === 0) {
            refStr = refStr.substring(1);
            returnOpposite = true;
        }
        if (!data) {
            data = {};
        }
        if (/[=<!>]/.test(refStr)) {
            var comparator = refStr.match(/([=<!>]+)/)[0];
            if (["==", "===", "!=", "!==", "<", ">", "<=", ">="].indexOf(comparator) !== -1) {
                var expressionParts = refStr.split(comparator);
                var left = getRef(expressionParts[0]);
                var right = getRef(expressionParts[1]);
                if (typeof left === "function") {
                    left = left.apply(data);
                }
                if (typeof right === "function") {
                    right = right.apply(data);
                }
                var value;
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
                return value;
            }
            else {
                return "";
            }
        }
        if (/[^a-z0-9.[\]:;,$_]/i.test(refStr)) {
            return "";
        }
        if (!hasBrackets && !hasDots) {
            reference = getInitialRef(data, refStr);
        }
        else {
            if (hasBrackets) {
                refStr = bracketsLoop(refStr);
                if (!hasDots) {
                    hasDots = true;
                }
            }
            if (hasDots) {
                var refParts = refStr.split(".");
                refParts.forEach(function (refPart, index) {
                    if (!index) {
                        reference = getInitialRef(data, refPart);
                    }
                    else if (typeof reference === "object" && reference[refPart]) {
                        if (preserveReference && index === refParts.length - 1) {
                            lastPart = refPart;
                        }
                        else {
                            reference = reference[refPart];
                        }
                    }
                    else {
                        reference = "";
                    }
                });
            }
        }
        if (preserveReference && lastPart) {
            reference.$lastPart = lastPart;
            reference.$returnOpposite = returnOpposite;
            return reference;
        }
        return returnOpposite ? !reference : reference;
    };
    // registerDirectives: initializes directives on `el` and all children
    registerDirectives = function (el, sdForContext, sdForIndex) {
        var isFalsyIf = false;
        var isLoop = false;
        if (!elCount) {
            elCount = 1;
        }
        unregisterDirectives(el);
        // all directives - if and for need to happen first
        ["if", "for", "html", "attr", "rdo", "class", "on"].some(function (directiveName) {
            var directiveValue = el.getAttribute("sd-" + directiveName).replace(/\s+/, "");
            var toBind;
            if (!el.hasAttribute("sd-" + directiveName)) {
                return false;
            }
            if (directiveName === "rdo") {
                var existingRdoFound = false;
                binds.rdo.some(function (bindObj) {
                    if (bindObj.element === el) {
                        existingRdoFound = true;
                        return true;
                    }
                });
                if (existingRdoFound) {
                    return false;
                }
            }
            // directives which allow multiple definition sets
            if (["attr", "class", "on"].indexOf(directiveName) !== -1 && directiveValue.indexOf(";") !== -1) {
                toBind = directiveValue.split(";");
            }
            else {
                toBind = [directiveValue];
            }
            toBind.forEach(function (attrWhole) {
                var bindObj = { element: el };
                var attrParts = attrWhole.split(":");
                // directives which do not have a value before the reference
                if (["if", "html", "rdo"].indexOf(directiveName) !== -1) {
                    bindObj.reference = attrParts.shift();
                    if (attrParts.length) {
                        bindObj.refArgs = attrParts;
                    }
                }
                else {
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
                        }
                        else {
                            bindObj[sdForContext.itemName] = {
                                value: sdForContext.value[sdForIndex]
                            };
                        }
                        bindObj[sdForContext.itemName].$key = sdForIndex;
                    }
                    else {
                        var key = Object.keys(sdForContext.value)[sdForIndex];
                        if (typeof sdForContext.value[key] === "object") {
                            bindObj[sdForContext.itemName] = sdForContext.value[key];
                        }
                        else {
                            bindObj[sdForContext.itemName] = {
                                value: sdForContext.value[key]
                            };
                        }
                        bindObj[sdForContext.itemName].$key = key;
                    }
                    bindObj[sdForContext.itemName].$collection = sdForContext.value;
                    bindObj[sdForContext.itemName].$index = sdForIndex;
                }
                if (directiveName === "on") {
                    var references;
                    if (bindObj.reference.indexOf(",") !== -1) {
                        references = bindObj.reference.split(",");
                    }
                    else {
                        references = [bindObj.reference];
                    }
                    if (references.indexOf("$update") !== -1) {
                        var attrValIndex;
                        var refToUpdate;
                        var indexToRemove;
                        while ((indexToRemove = references.indexOf("$update")) !== -1) {
                            references.splice(indexToRemove, 1);
                        }
                        if (bindObj.element.hasAttribute("sd-attr")) {
                            if (bindObj.element.tagName === "input" &&
                                ["checkbox", "radio"].indexOf(bindObj.element.getAttribute("type")) !== -1) {
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
                                        bindObj.updater = function () {
                                            refToUpdate[refToUpdate.$lastPart] = bindObj.element.checked;
                                        };
                                    }
                                }
                            }
                            else {
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
                                        bindObj.updater = function () {
                                            refToUpdate[refToUpdate.$lastPart] = bindObj.element.value;
                                        };
                                    }
                                }
                            }
                        }
                        else if (bindObj.element.hasAttribute("sd-html") && bindObj.element.isContentEditable) {
                            refToUpdate = getRef(bindObj.element.getAttribute("sd-html"), false, true);
                            if (typeof refToUpdate[refToUpdate.$lastPart] !== "function") {
                                bindObj.updater = function () {
                                    refToUpdate[refToUpdate.$lastPart] = bindObj.element.innerHTML;
                                };
                            }
                        }
                        else if (bindObj.element.hasAttribute("sd-rdo")) {
                            refToUpdate = getRef(bindObj.element.getAttribute("sd-rdo"), false, true);
                            if (typeof refToUpdate[refToUpdate.$lastPart] !== "function") {
                                bindObj.updater = function () {
                                    var value;
                                    Array.from(document.getElementsByName(bindObj.element.name)).some(function (rdoEl) {
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
                        bindObj.listener = function (event) {
                            var getRefData = false;
                            var callObject = {
                                element: el,
                                event: event
                            };
                            if (sdForContext) {
                                getRefData[sdForContext.itemName] = bindObj[sdForContext.itemName];
                                callObject[sdForContext.itemName] = getRefData[sdForContext.itemName];
                            }
                            references.forEach(function (reference) {
                                if (reference.indexOf("=") !== -1) {
                                    var refParts = reference.split("=");
                                    var leftRef = getRef(refParts[0], false, true);
                                    leftRef[leftRef.$lastPart] = getRef(refParts[1], getRefData);
                                }
                                else {
                                    getRef(reference, getRefData).apply(callObject, bindObj.refArgs.map(function (refArg) { return getRef(refArg, getRefData) || refArg; }));
                                }
                            });
                        };
                    }
                    toggleEventListeners("add", bindObj);
                }
                binds[directiveName].push(bindObj);
                if (directiveName === "if") {
                    if (sdForContext) {
                        var getRefData = {};
                        getRefData[sdForContext.itemName] = bindObj[sdForContext.itemName];
                        bindObj.value = getRef(bindObj.reference, getRefData);
                    }
                    else {
                        bindObj.value = getRef(bindObj.reference);
                    }
                    if (!bindObj.value) {
                        el.style.display = "none";
                        isFalsyIf = true;
                        return true;
                    }
                    else {
                        el.style.display = null;
                    }
                }
                else if (directiveName === "for") {
                    isLoop = true;
                }
            });
        });
        if (isFalsyIf) {
            return;
        }
        if (!isLoop) {
            elCount += el.children.length;
            Array.from(el.children).forEach(function (child) {
                registerDirectives(child);
            });
        }
        elCount -= 1;
        if (!elCount && !runBindsRunning) {
            runBinds();
        }
    };
    // runBinds: loops every `directives.refreshRate` milliseconds to keep binds updated
    runBinds = function () {
        var indexToRemove;
        if (!runBindsRunning) {
            runBindsRunning = true;
        }
        // bind directives (i.e. everything except sd-on) - if and for need to be first
        ["if", "for", "html", "attr", "rdo", "class"].forEach(function (directiveName) {
            binds[directiveName].forEach(function (bindObj, bindIndex) {
                if (!bindObj.element.parentElement) {
                    binds[directiveName][bindIndex] = false;
                    return;
                }
                var callObject = {
                    element: bindObj.element
                };
                var value;
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
                    var getRefData = {};
                    bindObj.itemNames.forEach(function (itemName) {
                        getRefData[itemName] = bindObj[itemName];
                        callObject[itemName] = getRefData[itemName];
                    });
                    value = getRef(bindObj.reference, getRefData);
                }
                else {
                    value = getRef(bindObj.reference);
                }
                if (typeof value === "function") {
                    value = value.apply(callObject, bindObj.refArgs.map(function (refArg) { return getRef(refArg) || refArg; }));
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
                    value = bindObj.originalHTML.repeat(Array.isArray(bindObj.value) ? bindObj.value.length : Object.keys(bindObj.value).length);
                }
                bindObj.value = value;
                switch (directiveName) {
                    case "if":
                        if (value) {
                            bindObj.element.style.display = null;
                            registerDirectives(bindObj.element);
                        }
                        else {
                            bindObj.element.style.display = "none";
                            unregisterDirectives(bindObj.element, "if");
                        }
                        break;
                    case "for":
                    case "html":
                        Array.from(bindObj.element.children).forEach(function (child) {
                            unregisterDirectives(child);
                        });
                        bindObj.element.innerHTML = value;
                        Array.from(bindObj.element.children).forEach(function (child, index) {
                            if (directiveName === "for") {
                                registerDirectives(child, bindObj, index);
                            }
                            else {
                                registerDirectives(child);
                            }
                        });
                        break;
                    case "attr":
                        if (bindObj.attributeName.indexOf(",") !== -1) {
                            bindObj.attributeName.split(",").forEach(function (singleAttributeName) {
                                if (typeof value === "undefined") {
                                    if (bindObj.element.hasAttribute(singleAttributeName)) {
                                        bindObj.element.removeAttribute(singleAttributeName);
                                    }
                                }
                                else {
                                    bindObj.element.setAttribute(singleAttributeName, value);
                                }
                            });
                        }
                        else if (typeof value === "undefined") {
                            if (bindObj.element.hasAttribute(bindObj.attributeName)) {
                                bindObj.element.removeAttribute(bindObj.attributeName);
                            }
                        }
                        else {
                            bindObj.element.setAttribute(bindObj.attributeName, value);
                        }
                        break;
                    case "rdo":
                        Array.from(document.getElementsByName(bindObj.element.name)).forEach(function (rdoEl) {
                            if (rdoEl.value === value) {
                                rdoEl.checked = true;
                            }
                            else {
                                rdoEl.checked = false;
                            }
                        });
                        break;
                    case "class":
                        if (bindObj.className.indexOf(",") !== -1) {
                            bindObj.className.split(",").forEach(function (singleClassName) {
                                if (!value) {
                                    if (bindObj.element.classList.contains(singleClassName)) {
                                        bindObj.element.classList.remove(singleClassName);
                                    }
                                }
                                else if (!bindObj.element.classList.contains(singleClassName)) {
                                    bindObj.element.classList.add(singleClassName);
                                }
                            });
                        }
                        else if (!value) {
                            if (bindObj.element.classList.contains(bindObj.className)) {
                                bindObj.element.classList.remove(bindObj.className);
                            }
                        }
                        else if (!bindObj.element.classList.contains(bindObj.className)) {
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
    // toggleEventListeners: handles adding or removing sd-on listeners
    toggleEventListeners = function (addOrRemove, bindObj) {
        var togglerFnName = addOrRemove + "EventListener";
        var toggleListener = bindObj.element[togglerFnName];
        if (bindObj.element.tagName === "input" && bindObj.element.getAttribute("type") === "radio") {
            var elements = Array.from(document.getElementsByName(bindObj.element.name));
            toggleListener = function (eventName, fn) {
                elements.forEach(function (element) {
                    element[togglerFnName](eventName, fn);
                });
            };
        }
        if (bindObj.eventName.indexOf(",") !== -1) {
            bindObj.eventName.split(",").forEach(function (singleEventName) {
                if (bindObj.listener) {
                    toggleListener(singleEventName, bindObj.listener);
                }
                if (bindObj.updater) {
                    toggleListener(singleEventName, bindObj.updater);
                }
            });
        }
        else {
            if (bindObj.listener) {
                toggleListener(bindObj.eventName, bindObj.listener);
            }
            if (bindObj.updater) {
                toggleListener(bindObj.eventName, bindObj.updater);
            }
        }
    };
    // unregisterDirectives: destroys binds and listeners for directives on `el` and all children
    unregisterDirectives = function (el, ignore) {
        var indexToRemove;
        ["attr", "class", "for", "html", "if", "on"].forEach(function (directiveName) {
            if (binds[directiveName].length) {
                if (el === document.body) {
                    if (directiveName === "on") {
                        binds.on.forEach(function (bindObj) {
                            toggleEventListeners("remove", bindObj);
                        });
                    }
                    binds[directiveName].length = 0;
                }
                else {
                    binds[directiveName].map(function (bindObj) {
                        if (el.contains(bindObj.element)) {
                            if (directiveName === "on") {
                                toggleEventListeners("remove", bindObj);
                            }
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
    /* * * * * * * *
     * INITIALIZE  *
     * * * * * * * */
    window.directives = {
        baseReference: window,
        refreshRate: 100,
        register: registerDirectives,
        unregister: unregisterDirectives
    };
    if (document.readyState != "loading") {
        setTimeout(function () {
            registerDirectives(document.body);
        });
    }
    else {
        document.addEventListener("DOMContentLoaded", function () {
            setTimeout(function () {
                registerDirectives(document.body);
            });
        });
    }
})();
