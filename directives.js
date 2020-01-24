const simpleDirectives = {};
(function(simpleDirectives) {
    // SECTIONS:
    // > Main Classes
    // > Data Binds
    // > Event Listening
    // > References
    function is(target) {
        return {
            oneOf(arr) {
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
    // > MAIN CLASSES
    // ============================================================================
    class SimpleDirectivesRegistrar {
        constructor(element, root) {
            this.elements = [];
            this.references = [];
            this.root = root ? root : window;
            this.register(element ? element : document.body);
            this.runner();
        }
        register(target, scope) {
            let hasDirective = false;
            let element;
            ["attr", "class", "for", "html", "if", "on", "rdo"].some(type => {
                if (target.hasAttribute(`sd-${type}`)) {
                    hasDirective = true;
                    return true;
                }
            });
            if (hasDirective && !is(target).oneOf(this.elements)) {
                element = new SimpleElement(this, target, scope);
                this.elements.push(element);
            }
            if (!element || element.on) {
                Array.from(target.children).forEach(child => this.register(child, scope));
            }
        }
        runner() {
            this.references.forEach(reference => reference.run());
            setTimeout(() => {
                this.runner();
            }, 200);
        }
        unregister(target) {
            this.elements = this.elements.map(element => {
                if (element.raw === target || target.contains(element.raw)) {
                    return element.unregister();
                } else {
                    return element;
                }
            });
            removeNulls(this.elements);
        }
        getSimpleElement(target) {
            let simpleElement;
            this.elements.some(element => {
                if (element.raw === target) {
                    simpleElement = element;
                    return true;
                }
            });
            return simpleElement;
        }
    }
    class SimpleElement {
        constructor(instance, element, scope) {
            this.directives = [];
            this.instance = instance;
            this.raw = element;
            this.scope = scope ? scope : {};
            this.on = true;
            // IMPORTANT: `if` and `for` must be first; `on` must be last
            ["if", "for", "attr", "class", "html", "rdo", "on"].forEach(type => {
                const attributeValue = element.getAttribute(`sd-${type}`);
                if (attributeValue) {
                    if (type === "for") {
                        this.on = false;
                    }
                    const directive = new SimpleDirective(this, type, attributeValue.replace(/\s+/g, ""));
                    this.directives.push(directive);
                }
            });
        }
        unregister() {
            const directiveTypes = this.directives.map(directive => directive.type);
            if (is("on").oneOf(directiveTypes)) {
                this.directives.some(directive => {
                    if (directive.type === "on") {
                        directive.listeners.forEach(listener => listener.destroy());
                        return true;
                    }
                });
            }
            this.instance.references = this.instance.references.map(reference => {
                const parent = SimpleReference.bubbleUp(reference);
                return parent instanceof SimpleExpression && this.raw.contains(parent.directive.element.raw)
                    ? null
                    : reference;
            });
            removeNulls(this.instance.references);
            return null;
        }
    }
    class SimpleDirective {
        constructor(element, type, raw) {
            const rawExpressions = raw.split(";");
            this.raw = raw;
            this.type = type;
            this.element = element;
            if (type === "on") {
                this.listeners = rawExpressions.map(rawExpression => new SimpleListener(this, rawExpression));
            } else {
                this.expressions = this.getExpressions(rawExpressions);
            }
        }
        getExpressions(rawExpressions) {
            return rawExpressions.map(rawExpression => {
                switch (this.type) {
                    case "if":
                        return new SdIf(this, rawExpression);
                    case "attr":
                        return new SdAttr(this, rawExpression);
                    case "class":
                        return new SdClass(this, rawExpression);
                    case "for":
                        return new SdFor(this, rawExpression);
                    case "html":
                        return new SdHtml(this, rawExpression);
                    case "rdo":
                        return new SdRdo(this, rawExpression);
                }
            });
        }
    }
    // > DATA BINDS
    // ============================================================================
    class SimpleExpression {
        constructor(directive, raw, skipRefAssignment) {
            this.raw = raw;
            this.directive = directive;
            if (!skipRefAssignment) {
                // RAW: reference[:arg:arg:..]
                this.assignReference(raw);
            }
        }
        assignReference(raw) {
            const reference = SimpleReference.getReference(this, raw);
            this.directive.element.instance.references.push(reference);
            return reference;
        }
        run(value) {
            // leave me be
        }
    }
    class SdIf extends SimpleExpression {
        run(value) {
            const element = this.directive.element;
            element.on = !!value;
            if (value) {
                element.raw.style.display = null;
                Array.from(element.raw.children).forEach(child => element.instance.register(child));
            } else {
                element.raw.style.display = "none";
                Array.from(element.raw.children).forEach(child => element.instance.unregister(child));
            }
        }
    }
    class SdAttr extends SimpleExpression {
        constructor(directive, raw) {
            // RAW: attribute:reference[:arg:arg:..]
            const rawParts = raw.split(":");
            super(directive, raw, true);
            this.attribute = rawParts.shift();
            this.assignReference(rawParts.join(":"));
        }
        run(value) {
            const element = this.directive.element.raw;
            if (this.attribute === "value" && element.tagName === "SELECT") {
                Array.from(element.getElementsByTagName("option")).forEach(optionElement => {
                    if ((Array.isArray(value) && is(optionElement.value).oneOf(value)) || value == optionElement.value) {
                        optionElement.selected = true;
                    } else {
                        optionElement.selected = false;
                    }
                });
            } else if (!value) {
                if (element.hasAttribute(this.attribute)) {
                    element.removeAttribute(this.attribute);
                }
            } else {
                element.setAttribute(this.attribute, value);
            }
        }
    }
    class SdClass extends SimpleExpression {
        constructor(directive, raw) {
            // RAW: class,class,..:reference[:arg:arg..]
            const rawParts = raw.split(":");
            super(directive, raw, true);
            this.classes = rawParts.shift().split(",");
            this.assignReference(rawParts.join(":"));
        }
        run(value) {
            const element = this.directive.element.raw;
            this.classes.forEach(className => {
                if (!value) {
                    if (element.classList.contains(className)) {
                        element.classList.remove(className);
                    }
                } else if (!element.classList.contains(className)) {
                    element.classList.add(className);
                }
            });
        }
    }
    class SdFor extends SimpleExpression {
        constructor(directive, raw) {
            // RAW: alias:reference[:arg:arg:..]
            const rawParts = raw.split(":");
            super(directive, raw, true);
            this.alias = rawParts.shift();
            this.originalHTML = this.directive.element.raw.innerHTML;
            this.assignReference(rawParts.join(":"));
        }
        run(value) {
            const $collection = value;
            const simpleElement = this.directive.element;
            const element = simpleElement.raw;
            const currChildren = element.children.length;
            if (!this.directive.element.on) {
                this.directive.element.on = true;
                element.innerHTML = this.originalHTML.repeat($collection.length);
            } else if (currChildren) {
                const difference = $collection.length - currChildren;
                Array.from(element.children).forEach(child => simpleElement.instance.unregister(child));
                if (difference < 0) {
                    let countdown = Math.abs(difference);
                    while (countdown > 0) {
                        // Note: This is the only reason we require a single child element
                        // If we figure out a cpu-cheap way to support arbitrary children, we can update the docs
                        // Consider: Vue repeats the element the `for` is on instead of the contents
                        element.removeChild(element.lastChild);
                        countdown -= 1;
                    }
                } else if (difference > 0) {
                    element.innerHTML += this.originalHTML.repeat(difference);
                }
            }
            Array.from(element.children).some((child, $index) => {
                const scope = Object.assign({}, this.directive.element.scope);
                scope[this.alias] = Object.assign({ $collection, $index }, $collection[$index]);
                simpleElement.instance.register(child, scope);
            });
            // if this is a select, re-run the attr in case the selected option wasn't in the dom until just now
            if (element.tagName === "SELECT") {
                simpleElement.directives.some(directive => {
                    if (directive.type === "attr") {
                        directive.expressions.some(sdAttr => {
                            if (sdAttr.attribute === "value") {
                                setTimeout(() => sdAttr.run(sdAttr.reference.get()));
                                return true;
                            }
                        });
                        return true;
                    }
                });
            }
        }
    }
    class SdHtml extends SimpleExpression {
        run(value) {
            const instance = this.directive.element.instance;
            const element = this.directive.element;
            Array.from(element.raw.children).forEach(child => instance.unregister(child));
            element.raw.innerHTML = value;
            Array.from(element.raw.children).forEach(child => instance.register(child));
        }
    }
    class SdRdo extends SimpleExpression {
        run(value) {
            const groupName = this.directive.element.raw.getAttribute("name");
            const radioInputs = Array.from(document.getElementsByName(groupName));
            radioInputs.forEach(radioInput => {
                if (radioInput.value === value) {
                    radioInput.checked = true;
                } else {
                    radioInput.checked = false;
                }
            });
        }
    }
    // EVENT LISTENING
    // ============================================================================
    class SimpleListener {
        constructor(directive, raw) {
            // RAW: event,event,..:reference[:arg:arg:..][,reference[:arg:arg:..,..]]
            let rawParts = raw.split(":");
            this.directive = directive;
            this.events = rawParts.shift().split(",");
            this.raw = raw;
            rawParts = rawParts.join(":").split(",");
            this.actions = rawParts.map(rawAction => {
                if (rawAction === "$update") {
                    return this.getUpdater();
                } else if (rawAction.indexOf("=") !== -1) {
                    return new SimpleAssigner(this, rawAction);
                } else {
                    return new SimpleCaller(this, rawAction);
                }
            });
            this.elo = event => this.actions.forEach(action => action.run(event));
            this.events.forEach(eventName => this.directive.element.raw.addEventListener(eventName, this.elo));
        }
        destroy() {
            this.events.forEach(event => {
                this.directive.element.raw.removeEventListener(event, this.elo);
            });
        }
        getUpdater() {
            const element = this.directive.element;
            const directiveTypes = element.directives.map(directive => directive.type);
            if (is("attr").oneOf(directiveTypes)) {
                if (element.raw.tagName === "INPUT" && is(element.raw.getAttribute("type")).oneOf(["checkbox", "radio"])) {
                    return new CheckedUpdater(this);
                } else {
                    return new ValueUpdater(this);
                }
            } else if (is("html").oneOf(directiveTypes) && element.raw.isContentEditable) {
                return new ContentEditableUpdater(this);
            } else if (is("rdo").oneOf(directiveTypes)) {
                return new RadioUpdater(this);
            }
        }
    }
    // SIMPLE ACTIONS
    class SimpleAction {
        constructor(listener, raw) {
            this.listener = listener;
            if (raw) {
                this.raw = raw;
            }
        }
        run(event) {
            // leave me be
        }
    }
    class SimpleCaller extends SimpleAction {
        constructor(listener, raw) {
            // RAW: reference[:arg:arg:..]
            super(listener, raw);
            this.callee = SimpleReference.getReference(this, raw);
        }
        run(event) {
            this.callee.get({ event });
        }
    }
    class SimpleAssigner extends SimpleAction {
        constructor(listener, raw) {
            // RAW: reference=reference[:arg:arg:..]
            const rawParts = raw.split("=");
            super(listener, raw);
            this.left = SimpleReference.getReference(this, rawParts.shift());
            this.right = SimpleReference.getReference(this, rawParts[0]);
        }
        run() {
            const right = this.right.get();
            this.left.obj[this.left.key] = right;
        }
    }
    // UPDATERS
    class SimpleUpdater extends SimpleAction {}
    class ValueUpdater extends SimpleUpdater {
        run() {
            const element = this.listener.directive.element.raw;
            this.updatee.obj[this.updatee.key] = element.value;
        }
    }
    class CheckedUpdater extends SimpleUpdater {
        run() {
            const element = this.listener.directive.element.raw;
            this.updatee.obj[this.updatee.key] = element.checked;
        }
    }
    class ContentEditableUpdater extends SimpleUpdater {
        run() {
            const element = this.listener.directive.element.raw;
            this.updatee.obj[this.updatee.key] = element.innerHTML;
        }
    }
    class RadioUpdater extends SimpleUpdater {
        run() {
            const groupName = this.listener.directive.element.raw.getAttribute("name");
            const radioInputs = Array.from(document.getElementsByName(groupName));
            let value;
            radioInputs.some(radioInput => {
                if (radioInput.checked) {
                    value = radioInput.value;
                    return true;
                }
            });
            this.updatee.obj[this.updatee.key] = value;
        }
    }
    // REFERENCE CLASSES
    // ============================================================================
    class SimpleReference {
        constructor(parent, raw) {
            this.parent = parent;
            this.raw = raw;
        }
        get(additionalScope) {
            // leave me be
        }
        run() {
            let currentValue = this.get();
            let tester = currentValue;
            if (typeof tester === "object") {
                tester = JSON.stringify(tester);
            }
            if (tester !== this.value) {
                this.value = tester;
                SimpleReference.bubbleUp(this).run(currentValue);
            }
        }
        static bubbleUp(reference) {
            let parent = reference;
            while (parent instanceof SimpleReference) {
                parent = parent.parent;
            }
            return parent;
        }
        static getReference(parent, raw) {
            // RAW: reference[:arg:arg:..]
            let reference;
            if (/[=<!>]/.test(raw.substring(1))) {
                reference = new SimpleComparison(parent, raw);
            } else {
                reference = new SimplePointer(parent, raw);
            }
            return reference;
        }
    }
    class SimpleComparison extends SimpleReference {
        constructor(parent, raw) {
            // RAW: reference[:arg:arg:..](comparator)reference[:arg:arg:..]
            const comparator = raw.match(/([=<!>]{1,3})/)[0];
            const index = raw.indexOf(comparator);
            super(parent, raw);
            this.comparator = comparator;
            this.left = SimpleReference.getReference(this, raw.substring(0, index));
            this.right = SimpleReference.getReference(this, raw.substring(index + comparator.length));
            if (parent instanceof SimpleExpression) {
                this.run();
            }
        }
        get(additionalScope) {
            const left = this.left.get(additionalScope);
            const right = this.right.get(additionalScope);
            switch (this.comparator) {
                case "==":
                    return left == right;
                case "===":
                    return left === right;
                case "!=":
                    return left != right;
                case "!==":
                    return left != right;
                case "<":
                    return left < right;
                case ">":
                    return left > right;
                case "<=":
                    return left <= right;
                case ">=":
                    return left >= right;
            }
        }
    }
    class SimplePointer extends SimpleReference {
        constructor(parent, raw) {
            // RAW: reference[:arg:arg:..]
            const rawParts = raw.split(":");
            super(parent, raw);
            this.base = rawParts.shift();
            this.obj = { value: raw };
            this.key = "value";
            if (this.base.startsWith("!")) {
                this.bang = true;
                this.base = this.base.substring(1);
            }
            this.args = rawParts.map(rawPart => SimpleReference.getReference(this, rawPart));
            let directive = SimpleReference.bubbleUp(this.parent);
            if (directive instanceof SimpleAction) {
                directive = directive.listener.directive;
            } else {
                directive = directive.directive;
            }
            this.scope = directive.element.scope;
            this.scope.element = directive.element.raw;
            if (directive instanceof SdAttr) {
                this.scope.attributeName = directive.attribute;
            } else if (directive instanceof SdClass) {
                this.scope.classNames = directive.classes;
            } else if (directive instanceof SdFor) {
                this.scope.itemName = directive.alias;
            } else if (directive instanceof SimpleListener) {
                this.scope.eventNames = directive.events;
            }
            let objAndKey = this.maybeGetObjAndKey(this.base, this.scope);
            if (objAndKey.nah) {
                objAndKey = this.maybeGetObjAndKey(this.base);
            }
            if (!objAndKey.nah) {
                this.obj = objAndKey.obj;
                this.key = objAndKey.key;
            }
            if (parent instanceof SimpleExpression) {
                this.run();
            }
        }
        get(additionalScope) {
            let directive = SimpleReference.bubbleUp(this.parent);
            let value = this.obj[this.key];
            if (directive instanceof SimpleExpression) {
                directive = directive.directive;
            } else {
                directive = directive.listener.directive;
            }
            let scope = this.scope;
            if (additionalScope) {
                scope = Object.assign({}, scope, additionalScope);
            }
            if (typeof value === "function") {
                const argValues = this.args.map(arg => arg.get(additionalScope));
                value = value.apply(scope, argValues);
            }
            return this.bang ? !value : value;
        }
        maybeGetObjAndKey(base, scope) {
            const fallback = { nah: true };
            const hasBrackets = base.indexOf("[") !== -1;
            let hasDots = base.indexOf(".") !== -1;
            let obj;
            if (scope) {
                obj = scope;
            } else {
                let root = SimpleReference.bubbleUp(this.parent);
                if (root instanceof SimpleExpression) {
                    root = root.directive.element.instance.root;
                } else {
                    root = root.listener.directive.element.instance.root;
                }
                obj = root;
            }
            if (/[^a-z0-9.[\]$_]/i.test(base)) {
                return fallback;
            }
            if (!hasBrackets && !hasDots) {
                if (obj.hasOwnProperty(base)) {
                    return { obj, key: base };
                } else {
                    return fallback;
                }
            } else {
                if (hasBrackets) {
                    while (/\[[^\[\]]*\]/.test(base)) {
                        base = base.replace(/\[([^\[\]]*)\]/g, (_, capture) => {
                            const cr = this.maybeGetObjAndKey(capture, scope);
                            return "." + cr.obj[cr.key];
                        });
                    }
                    if (!hasDots) {
                        hasDots = true;
                    }
                }
                if (hasDots) {
                    const parts = base.split(".");
                    let key;
                    parts.some((part, index) => {
                        if (index === parts.length - 1) {
                            key = part;
                        } else if (typeof obj === "object" && obj.hasOwnProperty(part)) {
                            obj = obj[part];
                        } else {
                            key = false;
                            return true;
                        }
                    });
                    if (typeof key === "string") {
                        return { obj, key };
                    } else {
                        return fallback;
                    }
                }
            }
        }
    }
    // > INITIALIZATION
    // ============================================================================
    simpleDirectives.register = (element, root) => new SimpleDirectivesRegistrar(element, root);
})(simpleDirectives);
