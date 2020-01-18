// A Simple Directives Library
// https://github.com/bracketdash/simple-directives/blob/master/README.md
interface ArrayConstructor {
    from(arrayLike: any, mapFn?, thisArg?): Array<any>;
}
interface SimpleDirective {
    element: HTMLElement;
    type: string;
}
interface SimpleReference {
    bang: boolean;
    parent: object;
    target: string;
}
const simpleDirectives = {
    add: function(element: HTMLElement, type: string, references: string[], preReferences?: string[]) {
        // TODO
    },
    preReferenceMap: {
        attr: "attributeName",
        class: "className",
        for: "itemName",
        on: "eventName"
    },
    reference: function(reference: string): SimpleReference {
        let bang = false;
        let parent: object;
        let target: string;
        // TODO
        return { bang, parent, target };
    },
    refreshRate: 100,
    register: function(element: HTMLElement) {
        let skipChildren = false;
        ["if", "for", "html", "attr", "rdo", "class", "on"].some(function(type: string) {
            let skipTheRest = false;
            const directiveName = `sd-${type}`;
            if (!element.hasAttribute(directiveName)) {
                return false;
            }
            element
                .getAttribute(directiveName)
                .split(";")
                .forEach(function(expression: string) {
                    let expressionParts: string[];
                    switch (type) {
                        case "if":
                            element.style.display = "none";
                            skipTheRest = true;
                        case "html":
                        case "rdo":
                            simpleDirectives.add(element, type, [expression]);
                            break;
                        case "for":
                            skipChildren = true;
                        case "on":
                        case "attr":
                        case "class":
                            expressionParts = expression.split(":");
                            simpleDirectives.add(
                                element,
                                type,
                                expressionParts[1].split(","),
                                expressionParts[0].split(",")
                            );
                            break;
                    }
                    if (type === "on") {
                        // TODO: set up event listener(s)
                    }
                });
            if (skipTheRest) {
                return true;
            }
        });
        if (!skipChildren) {
            Array.from(element.children).forEach(child => this.register(child));
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
        this.registry.forEach(function(directive: SimpleDirective) {
            if (directive.type !== "on") {
                this.run(directive);
            }
        });
        setTimeout(this.runner, this.refreshRate);
    },
    run: function(directive: SimpleDirective) {
        // TODO
    },
    unregister: function(element: HTMLElement) {
        this.registry.map(function(directive: SimpleDirective) {
            if (directive.element === element || element.contains(directive.element)) {
                if (directive.type === "on") {
                    // TODO: remove event listener(s)
                }
                return null;
            }
            return directive;
        });
        this.removeNulls(this.registry);
    }
};

/* OLD CODE BELOW

interface SdForContext {
    element: HTMLElement;
    itemName: string;
    reference: string;
    value: Object | any[];
}
(function() {
    const binds = {
        attr: [],
        class: [],
        for: [],
        html: [],
        if: [],
        on: [],
        rdo: []
    };
    const propMap = {
        attr: "attributeName",
        class: "className",
        for: "itemName",
        on: "eventName"
    };
    let elCount = 1;
    let runBindsRunning = false;
    // these lets are a workaround for a flow analysis bug in the TypeScript compiler (would normally be consts)
    let bracketsLoop: Function;
    let getInitialRef: Function;
    let getRef: Function;
    let registerDirectives: Function;
    let toggleEventListeners: Function;
    let runBinds: Function;
    let unregisterDirectives: Function;
    // bracketsLoop: used within getRef to expand bracket groups in reference strings
    bracketsLoop = function(loopRef) {
        loopRef = loopRef.replace(/\[([^\[\]]*)\]/g, function(_, capture) {
            return "." + getRef(capture);
        });
        if (/\[[^\[\]]*\]/.test(loopRef)) {
            return bracketsLoop(loopRef);
        } else {
            return loopRef;
        }
    };
    // getInitialRef: used within getRef to get the initial reference object and add any scope data
    getInitialRef = function(data, jrProp) {
        let baseRef = (<any>Object).assign(data, simpleDirectives.baseReference);
        return baseRef[jrProp];
    };
    // getRef: converts a reference string into an actual reference (return empty string if invalid reference)
    getRef = function(refStr: string, data?: Object, preserveReference?: boolean) {
        let hasBrackets = refStr.indexOf("[") !== -1;
        let hasDots = refStr.indexOf(".") !== -1;
        let lastPart: string;
        let reference;
        let returnOpposite = false;
        if (refStr.indexOf("!") === 0) {
            refStr = refStr.substring(1);
            returnOpposite = true;
        }
        if (!data) {
            data = {};
        }
        if (/[=<!>]/.test(refStr)) {
            let comparator = refStr.match(/([=<!>]+)/)[0];
            if (["==", "===", "!=", "!==", "<", ">", "<=", ">="].indexOf(comparator) !== -1) {
                let expressionParts = refStr.split(comparator);
                let left = getRef(expressionParts[0]);
                let right = getRef(expressionParts[1]);
                if (typeof left === "function") {
                    left = left.apply(data);
                }
                if (typeof right === "function") {
                    right = right.apply(data);
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
                return value;
            } else {
                return "";
            }
        }
        if (/[^a-z0-9.[\]:;,$_]/i.test(refStr)) {
            return "";
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
                let refParts = refStr.split(".");
                refParts.forEach(function(refPart, index) {
                    if (!index) {
                        reference = getInitialRef(data, refPart);
                    } else if (typeof reference === "object" && reference[refPart]) {
                        if (preserveReference && index === refParts.length - 1) {
                            lastPart = refPart;
                        } else {
                            reference = reference[refPart];
                        }
                    } else {
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
    registerDirectives = function(el: HTMLElement, sdForContext?: SdForContext, sdForIndex?: number) {
        let isFalsyIf = false;
        let isLoop = false;
        if (!elCount) {
            elCount = 1;
        }
        unregisterDirectives(el);
        // all directives - if and for need to happen first
        ["if", "for", "html", "attr", "rdo", "class", "on"].some(function(directiveName) {
            const directiveValue = el.getAttribute("sd-" + directiveName).replace(/\s+/, "");
            let toBind: any[];
            if (!el.hasAttribute("sd-" + directiveName)) {
                return false;
            }
            if (directiveName === "rdo") {
                let existingRdoFound = false;
                binds.rdo.some(function(bindObj) {
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
            } else {
                toBind = [directiveValue];
            }
            toBind.forEach(function(attrWhole) {
                let bindObj: any = { element: el };
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
                if (directiveName === "on") {
                    let references: string[];
                    if (bindObj.reference.indexOf(",") !== -1) {
                        references = bindObj.reference.split(",");
                    } else {
                        references = [bindObj.reference];
                    }
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
                    toggleEventListeners("add", bindObj);
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
    // runBinds: loops every `directives.refreshRate` milliseconds to keep binds updated
    runBinds = function() {
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
        setTimeout(runBinds, simpleDirectives.refreshRate);
    };
    // toggleEventListeners: handles adding or removing sd-on listeners
    toggleEventListeners = function(addOrRemove: string, bindObj) {
        const togglerFnName = addOrRemove + "EventListener";
        let toggleListener = bindObj.element[togglerFnName];
        if (bindObj.element.tagName === "input" && bindObj.element.getAttribute("type") === "radio") {
            let elements: HTMLInputElement[] = Array.from(document.getElementsByName(bindObj.element.name));
            toggleListener = function(eventName, fn) {
                elements.forEach(function(element) {
                    element[togglerFnName](eventName, fn);
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
    };
    // unregisterDirectives: destroys binds and listeners for directives on `el` and all children
    unregisterDirectives = function(el: HTMLElement, ignore?: string) {
        let indexToRemove: number;
        ["attr", "class", "for", "html", "if", "on"].forEach(function(directiveName) {
            if (binds[directiveName].length) {
                if (el === document.body) {
                    if (directiveName === "on") {
                        binds.on.forEach(function(bindObj) {
                            toggleEventListeners("remove", bindObj);
                        });
                    }
                    binds[directiveName].length = 0;
                } else {
                    binds[directiveName].map(function(bindObj) {
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
})();
*/
