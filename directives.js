/*

A Simple Directives Library
https://github.com/bracketdash/simple-directives

Add event listeners:
    <element sd-on="event:reference">
    <element sd-on="event1:reference1;event2,event3:reference2;...">
Bind contents:
    <element sd-html="reference">
Bind attributes:
    <element sd-attr="attribute:reference">
    <element sd-attr="attribute1:reference1;attribute2:reference2;...">
Toggle classes:
    <element sd-class="class:reference">
    <element sd-class="class1:reference1;class2,class3:!reference2;...">
Create a bound loop:
    <element sd-for="item:reference">
Add a condition:
    <element sd-if="reference">
Add arguments to a function reference:
    <element sd-on="event:reference:arg">
    <element sd-attr="attribute1:reference1:arg1:arg2:...;attribute2:reference2;...">

*/
(function() {
    var binds = {
        attr: [],
        class: [],
        for: [],
        html: [],
        if: [],
        on: []
    };
    var bracketsLoop = function(loopRef) {
        loopRef = loopRef.replace(/\[([^\[\]]*)\]/g, function(_, capture) {
            return "." + getRef(capture);
        });
        if (/\[[^\[\]]*\]/.test(loopRef)) {
            return bracketsLoop(loopRef);
        } else {
            return loopRef;
        }
    };
    var getInitialRef = function(data, jrProp) {
        var baseRef = window.directives.baseReference;
        if (data) {
            baseRef = Object.assign({}, baseRef);
            Object.keys(data).forEach(function(key) {
                baseRef[key] = data[key];
            });
        }
        return baseRef[jrProp];
    };
    var getRef = function(refStr, data) {
        var hasBrackets = refStr.indexOf("[") !== -1;
        var hasDots = refStr.indexOf(".") !== -1;
        var reference;
        var returnOpposite = false;
        if (refStr.indexOf("!") === 0) {
            refStr = refStr.substring(1);
            returnOpposite = true;
        }
        if (!hasBrackets && !hasDots) {
            reference = getInitialRef(data, refStr);
        } else {
            if (hasBrackets) {
                refStr = bracketsLoop(refStr);
                if (!hasDots) {
                    hasDots = true;
                }
            }
            if (hasDots) {
                refStr.split(".").forEach(function(refPart, index) {
                    if (!index) {
                        reference = getInitialRef(data, refPart);
                    } else if (typeof reference === "object" && reference[refPart]) {
                        reference = reference[refPart];
                    } else {
                        reference = "";
                    }
                });
            }
        }
        return returnOpposite ? !reference : reference;
    };
    var propMap = {
        attr: "attributeName",
        class: "className",
        for: "itemName",
        on: "eventName"
    };
    var registerDirectives = function(el, sdForContext, sdForIndex) {
        var isFalsyIf = false;
        var isLoop = false;
        if (!elCount) {
            elCount = 1;
        }
        unregisterDirectives(el);
        ["if", "for", "html", "attr", "class", "on"].some(function(directiveName) {
            if (!el.hasAttribute("sd-" + directiveName)) {
                return false;
            }
            var toBind;
            if (["attr"].indexOf(directiveName) !== 1 && el.getAttribute("sd-attr").indexOf(";") !== -1) {
                toBind = el.getAttribute("sd-" + directiveName).split(";");
            } else {
                toBind = [el.getAttribute("sd-" + directiveName)];
            }
            toBind.forEach(function(attrWhole) {
                var bindObj = { element: el };
                var attrParts = attrWhole.split(":");
                if (["if", "html"].indexOf(directiveName) !== -1) {
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
                        bindObj[sdForContext.itemName] = {
                            collection: sdForContext.value,
                            key: sdForIndex,
                            index: sdForIndex,
                            item: sdForContext.value[sdForIndex],
                            value: sdForContext.value[sdForIndex]
                        };
                    } else {
                        var key = Object.keys(sdForContext.value)[sdForIndex];
                        bindObj[sdForContext.itemName] = {
                            collection: sdForContext.value,
                            key: key,
                            index: sdForIndex,
                            item: sdForContext.value[key],
                            value: sdForContext.value[key]
                        };
                    }
                }
                if (directiveName === "on") {
                    bindObj.listener = function(event) {
                        var getRefData = {};
                        var callObject = {
                            element: el,
                            event: event
                        };
                        if (sdForContext) {
                            getRefData[sdForContext.itemName] = {
                                key: bindObj[sdForContext.itemName].key,
                                index: bindObj[sdForContext.itemName].index,
                                item: bindObj[sdForContext.itemName].item,
                                value: bindObj[sdForContext.itemName].value
                            };
                            callObject[sdForContext.itemName] = getRefData[sdForContext.itemName];
                            getRef(bindObj.reference, getRefData).apply(callObject, bindObj.refArgs);
                        } else {
                            getRef(bindObj.reference).apply(callObject, bindObj.refArgs);
                        }
                    };
                    if (bindObj.eventName.indexOf(",") !== -1) {
                        bindObj.eventName.split(",").forEach(function(singleEventName) {
                            bindObj.element.addEventListener(singleEventName, bindObj.listener);
                        });
                    } else {
                        bindObj.element.addEventListener(bindObj.eventName, bindObj.listener);
                    }
                }
                binds[directiveName].push(bindObj);
                if (directiveName === "if") {
                    if (sdForContext) {
                        var getRefData = {};
                        getRefData[sdForContext.itemName] = {
                            key: bindObj[sdForContext.itemName].key,
                            index: bindObj[sdForContext.itemName].index,
                            item: bindObj[sdForContext.itemName].item,
                            value: bindObj[sdForContext.itemName].value
                        };
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
    var runBinds = function() {
        var indexToRemove;
        if (!runBindsRunning) {
            runBindsRunning = true;
        }
        ["if", "for", "attr", "class", "html"].forEach(function(directiveName) {
            binds[directiveName].forEach(function(bindObj, bindIndex) {
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
                    case "on":
                        callObject.eventName = bindObj.eventName;
                        break;
                }
                if (bindObj.itemNames) {
                    var getRefData_1 = {};
                    bindObj.itemNames.forEach(function(itemName) {
                        getRefData_1[itemName] = {
                            key: bindObj[itemName].key,
                            index: bindObj[itemName].index,
                            item: bindObj[itemName].item,
                            value: bindObj[itemName].value
                        };
                        callObject[itemName] = getRefData_1[itemName];
                    });
                    value = getRef(bindObj.reference, getRefData_1);
                    if (typeof value === "function") {
                        value = value.apply(callObject, bindObj.refArgs);
                    }
                } else {
                    value = getRef(bindObj.reference);
                    if (typeof value === "function") {
                        value = value.apply(callObject, bindObj.refArgs);
                    }
                }
                if (["if", "class"].indexOf(directiveName) !== -1 && typeof value !== "boolean") {
                    value = !!value;
                }
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
        setTimeout(runBinds, window.directives.refreshRate);
    };
    var unregisterDirectives = function(el, ignore) {
        var indexToRemove;
        ["attr", "class", "for", "html", "if", "on"].forEach(function(directiveName) {
            if (binds[directiveName].length) {
                if (el === document.body) {
                    if (directiveName === "on") {
                        binds.on.forEach(function(bindObj) {
                            if (bindObj.eventName.indexOf(",") !== -1) {
                                bindObj.eventName.split(",").forEach(function(singleEventName) {
                                    bindObj.element.removeEventListener(singleEventName, bindObj.listener);
                                });
                            } else {
                                bindObj.element.removeEventListener(bindObj.eventName, bindObj.listener);
                            }
                        });
                    }
                    binds[directiveName].length = 0;
                } else {
                    binds[directiveName].map(function(bindObj) {
                        if (el.contains(bindObj.element)) {
                            if (directiveName === "on") {
                                if (bindObj.eventName.indexOf(",") !== -1) {
                                    bindObj.eventName.split(",").forEach(function(singleEventName) {
                                        bindObj.element.removeEventListener(singleEventName, bindObj.listener);
                                    });
                                } else {
                                    bindObj.element.removeEventListener(bindObj.eventName, bindObj.listener);
                                }
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
    var elCount = 1;
    var runBindsRunning = false;
    window.directives = {
        baseReference: window,
        refreshRate: 100,
        register: registerDirectives,
        unregister: unregisterDirectives
    };
    if (document.readyState != "loading") {
        setTimeout(function() {
            registerDirectives(document.body);
        });
    } else {
        document.addEventListener("DOMContentLoaded", function() {
            setTimeout(function() {
                registerDirectives(document.body);
            });
        });
    }
})();
