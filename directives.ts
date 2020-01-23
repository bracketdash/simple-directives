const simpleDirectives: any = {};
(function(simpleDirectives) {
    // SECTIONS:
    // > Main Classes
    // > Data Binds
    // > Event Listening & Handling
    // > References

    function is(target: any) {
        return {
            oneOf: function(arr: any[]): boolean {
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

    // > MAIN CLASSES
    // ============================================================================

    class SimpleDirectivesRegistrar {
        elements: SimpleElement[] = [];
        references: SimpleReference[] = [];
        root: object;
        constructor(element?: HTMLElement, root?: object) {
            this.root = root ? root : window;
            this.register(element ? element : document.body);
            this.runner();
        }
        register(target: HTMLElement) {
            let hasDirective = false;
            let element: SimpleElement;
            ["attr", "class", "for", "html", "if", "on", "rdo"].some((type: string) => {
                if (target.hasAttribute(`sd-${type}`)) {
                    hasDirective = true;
                }
            });
            if (hasDirective && !is(target).oneOf(this.elements)) {
                element = new SimpleElement(this, target);
                this.elements.push(element);
            }
            if (!element || !element.hasFalseIf) {
                Array.from(target.children).forEach((child: HTMLElement) => this.register(child));
            }
        }
        runner() {
            this.references.forEach((reference: SimpleReference) => reference.run());
            setTimeout(this.runner, 200);
        }
        unregister(target: HTMLElement) {
            this.elements = this.elements.map((element: SimpleElement) => {
                if (target.contains(element.raw)) {
                    return element.unregister();
                } else {
                    return element;
                }
            });
            removeNulls(this.elements);
        }
    }

    class SimpleElement {
        directives: SimpleDirective[] = [];
        hasFalseIf: boolean;
        instance: SimpleDirectivesRegistrar;
        raw: HTMLElement;
        scope: object;
        constructor(instance: SimpleDirectivesRegistrar, element: HTMLElement) {
            this.instance = instance;
            this.raw = element;
            // IMPORTANT: `if` must be first; `for` must be second; `on` must be last
            ["if", "for", "attr", "class", "html", "rdo", "on"].some((type: string) => {
                const attributeValue = element.getAttribute(`sd-${type}`);
                if (attributeValue) {
                    this.directives.push(new SimpleDirective(this, type, attributeValue.replace(/\s+/g, "")));
                }
            });
        }
        unregister() {
            const directiveTypes = this.directives.map(directive => directive.type);
            if (is("on").oneOf(directiveTypes)) {
                this.directives.some((directive: SimpleDirective) => {
                    if (directive.type === "on") {
                        directive.listeners.forEach(listener => listener.destroy());
                        return true;
                    }
                });
            }
            this.instance.references = this.instance.references.map((reference: SimpleReference) => {
                const parent: SimpleExpression | SimpleAction = SimpleReference.bubbleUp(reference);
                return parent instanceof SimpleExpression && this.raw.contains(parent.directive.element.raw)
                    ? null
                    : reference;
            });
            removeNulls(this.instance.references);
            return null;
        }
    }

    class SimpleDirective {
        element: SimpleElement;
        expressions?: SimpleExpression[];
        listeners?: SimpleListener[];
        raw: string;
        type: string;
        constructor(element: SimpleElement, type: string, raw: string) {
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
        raw: string;
        directive: SimpleDirective;
        reference: SimpleReference;
        constructor(directive: SimpleDirective, raw: string, skipRefAssignment?: boolean) {
            this.raw = raw;
            this.directive = directive;
            if (!skipRefAssignment) {
                // RAW: reference[:arg:arg:..]
                this.assignReference(raw);
            }
        }
        assignReference(raw: string): SimpleReference {
            const reference = SimpleReference.getReference(this, raw);
            this.directive.element.instance.references.push(reference);
            return reference;
        }
        run(value: any) {
            // leave me be
        }
    }

    class SdIf extends SimpleExpression {
        run(value: any) {
            const element = this.directive.element;
            if (value) {
                element.raw.style.display = null;
                Array.from(element.raw.children).forEach((child: HTMLElement) => element.instance.register(child));
            } else {
                element.raw.style.display = "none";
                Array.from(element.raw.children).forEach((child: HTMLElement) => element.instance.unregister(child));
            }
        }
    }

    class SdAttr extends SimpleExpression {
        attribute: string;
        constructor(directive: SimpleDirective, raw: string) {
            // RAW: attribute:reference[:arg:arg:..]
            const rawParts = raw.split(":");
            super(directive, raw, true);
            this.attribute = rawParts.shift();
            this.assignReference(rawParts.join(":"));
        }
        run(value: any) {
            const element = this.directive.element.raw;
            if (this.attribute === "value" && element.tagName === "SELECT") {
                Array.from(element.getElementsByTagName("option")).forEach(function(optionElement: HTMLOptionElement) {
                    if ((Array.isArray(value) && is(optionElement.value).oneOf(value)) || value == optionElement.value) {
                        optionElement.selected = true;
                    } else {
                        optionElement.selected = false;
                    }
                });
            } else if (typeof value === "undefined") {
                if (element.hasAttribute(this.attribute)) {
                    element.removeAttribute(this.attribute);
                }
            } else {
                element.setAttribute(this.attribute, value);
            }
        }
    }

    class SdClass extends SimpleExpression {
        classes: string[];
        constructor(directive: SimpleDirective, raw: string) {
            // RAW: class,class,..:reference[:arg:arg..]
            const rawParts = raw.split(":");
            super(directive, raw, true);
            this.classes = rawParts.shift().split(",");
            this.assignReference(rawParts.join(":"));
        }
        run(value: any) {
            const element = this.directive.element.raw;
            this.classes.forEach(function(className) {
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
        alias: string;
        constructor(directive: SimpleDirective, raw: string) {
            // RAW: alias:reference[:arg:arg:..]
            const rawParts = raw.split(":");
            super(directive, raw, true);
            this.alias = rawParts.shift();
            this.assignReference(rawParts.join(":"));
        }
        run(value: any) {
            // TODO: refactor below
            /*
            const currChildren = element.children.length;
            const difference = $collection.length - currChildren;
            const goalHTML = directive.originalHTML.repeat($collection.length);
            if (currChildren) {
                Array.from(element.children).forEach(function(child: HTMLElement) {
                    unregister(child);
                });
            }
            element.style.width = getComputedStyle(element).width;
            element.style.height = getComputedStyle(element).height;
            element.style.overflow = "hidden";
            if (difference < 0) {
                let countdown = Math.abs(difference);
                while (countdown > 0) {
                    element.removeChild(element.lastChild);
                    countdown -= 1;
                }
            } else if (difference > 0) {
                element.innerHTML += directive.originalHTML.repeat(difference);
            } else if (element.innerHTML === goalHTML) {
                element.innerHTML = goalHTML;
            }
            element.style.width = null;
            element.style.height = null;
            element.style.overflow = null;
            Array.from(element.children).some(function(child: HTMLElement, $index: number) {
                const scope = {};
                scope[directive.preReferences[0]] = Object.assign({ $collection, $index }, $collection[$index]);
                register(child, true, scope);
            });
            if (element.tagName === "SELECT") {
                const elementDirectiveData = getElementDirectiveData(element);
                if (elementDirectiveData.watchers) {
                    elementDirectiveData.watchers.some(function(simpleAction: SimpleAction) {
                        if (simpleAction.directive.type === "attr" && is("value").oneOf(simpleAction.directive.preReferences)) {
                            setTimeout(function() {
                                simpleAction.action(simpleAction.lastValue);
                            });
                        }
                    });
                }
            }
            */
        }
    }

    class SdHtml extends SimpleExpression {
        run(value: any) {
            const instance = this.directive.element.instance;
            const element = this.directive.element;
            Array.from(element.raw.children).forEach((child: HTMLElement) => instance.unregister(child));
            element.raw.innerHTML = value;
            Array.from(element.raw.children).forEach((child: HTMLElement) => instance.register(child));
        }
    }

    class SdRdo extends SimpleExpression {
        run(value: any) {
            const groupName = this.directive.element.raw.getAttribute("name");
            const radioInputs = Array.from(document.getElementsByName(groupName));
            radioInputs.forEach(function(radioInput: HTMLInputElement) {
                if (radioInput.value === value) {
                    radioInput.checked = true;
                } else {
                    radioInput.checked = false;
                }
            });
        }
    }

    // EVENT LISTENING & HANDLING
    // ============================================================================

    class SimpleListener {
        actions: SimpleAction[];
        directive: SimpleDirective;
        elo: EventListener;
        events: string[];
        raw: string;
        constructor(directive: SimpleDirective, raw: string) {
            // RAW: event,event,..:reference[:arg:arg:..][,reference[:arg:arg:..,..]]
            let rawParts: string[] = raw.split(":");
            this.directive = directive;
            this.events = rawParts[0].split(",");
            this.raw = raw;
            rawParts = rawParts.join(":").split(",");
            this.actions = rawParts.map((rawAction: string) => {
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
            this.events.forEach((event: string) => {
                this.directive.element.raw.removeEventListener(event, this.elo);
            });
        }
        getUpdater(): SimpleUpdater {
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
        listener: SimpleListener;
        raw?: string;
        constructor(listener: SimpleListener, raw?: string) {
            this.listener = listener;
            if (raw) {
                this.raw = raw;
            }
        }
        run(event?: Event) {
            // leave me be
        }
    }

    class SimpleCaller extends SimpleAction {
        callee: SimplePointer;
        constructor(listener: SimpleListener, raw: string) {
            // RAW: reference[:arg:arg:..]
            super(listener, raw);
            this.callee = (SimpleReference.getReference(this, raw) as SimplePointer);
        }
        run(event: Event) {
            this.callee.get(event);
        }
    }

    class SimpleAssigner extends SimpleAction {
        left: SimplePointer;
        right: SimpleReference;
        constructor(listener: SimpleListener, raw: string) {
            // RAW: reference=reference[:arg:arg:..]
            const rawParts = raw.split("=");
            super(listener, raw);
            this.left = (SimpleReference.getReference(this, rawParts.shift()) as SimplePointer);
            this.right = SimpleReference.getReference(this, rawParts[0]);
        }
        run() {
            const right = this.right.get();
            this.left.obj[this.left.key] = right;
        }
    }

    // UPDATERS

    class SimpleUpdater extends SimpleAction {
        updatee: SimplePointer;
    }

    class ValueUpdater extends SimpleUpdater {
        run() {
            const element = this.listener.directive.element.raw as HTMLInputElement;
            this.updatee.obj[this.updatee.key] = element.value;
        }
    }

    class CheckedUpdater extends SimpleUpdater {
        run() {
            const element = this.listener.directive.element.raw as HTMLInputElement;
            this.updatee.obj[this.updatee.key] = element.checked;
        }
    }

    class ContentEditableUpdater extends SimpleUpdater {
        run() {
            const element = this.listener.directive.element.raw as HTMLInputElement;
            this.updatee.obj[this.updatee.key] = element.innerHTML;
        }
    }

    class RadioUpdater extends SimpleUpdater {
        run() {
            const groupName = (this.listener.directive.element.raw as HTMLInputElement).getAttribute("name");
            const radioInputs = Array.from(document.getElementsByName(groupName));
            let value: any;
            radioInputs.some(function(radioInput: HTMLInputElement) {
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
        parent: SimpleExpression | SimpleReference | SimpleAction;
        raw: string;
        value: any;
        constructor(parent: SimpleExpression | SimpleReference | SimpleAction, raw: string) {
            this.parent = parent;
            this.raw = raw;
        }
        get(additionalScope?: object) {
            // leave me be
        }
        run() {
            let currentValue: any = this.get();
            if (typeof currentValue === "object") {
                currentValue = JSON.stringify(currentValue);
            }
            if (currentValue !== this.value) {
                this.value = currentValue;
                (SimpleReference.bubbleUp(this) as SimpleExpression).run(currentValue);
            }
        }
        static bubbleUp(reference: SimpleExpression | SimpleReference | SimpleAction): SimpleExpression | SimpleAction {
            let parent: SimpleExpression | SimpleReference | SimpleAction = reference;
            while (parent instanceof SimpleReference) {
                parent = parent.parent;
            }
            return parent;
        }
        static getReference(parent: SimpleExpression | SimpleReference | SimpleAction, raw: string) {
            // RAW: reference[:arg:arg:..]
            let reference: SimpleReference;
            if (/[=<!>]/.test(raw.substring(1))) {
                reference = new SimpleComparison(parent, raw);
            } else {
                reference = new SimplePointer(parent, raw);
            }
            return reference;
        }
    }

    class SimpleComparison extends SimpleReference {
        left: SimpleReference;
        comparator: string;
        right: SimpleReference;
        constructor(parent: SimpleExpression | SimpleReference | SimpleAction, raw: string) {
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
        get(additionalScope?: object) {
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

    interface ObjAndKey {
        key?: string;
        nah?: boolean;
        obj?: object;
    }
    class SimplePointer extends SimpleReference {
        args: SimpleReference[];
        bang: boolean;
        base: string;
        key: string;
        obj: object;
        constructor(parent: SimpleExpression | SimpleReference | SimpleAction, raw: string) {
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
            const scope: object = (function() {
                const bubbler: any = SimpleReference.bubbleUp(parent);
                if (bubbler instanceof SimpleAction) {
                    return bubbler.listener.directive.element.scope;
                } else {
                    return bubbler.directive.element.scope;
                }
            })();
            let objAndKey: ObjAndKey = this.maybeGetObjAndKey(this.base, scope);
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
        get(additionalScope?: object) {
            let scope: object = this.scope();
            let value: any = this.obj[this.key];
            if (additionalScope) {
                Object.assign(scope, additionalScope);
            } else {
                additionalScope = {};
            }
            // TODO: make sure all the right data is getting into scope according to the README
            if (typeof value === "function") {
                value = value.apply(scope, this.args.map(arg => arg.get(additionalScope)));
            }
            return this.bang ? value : !value;
        }
        scope() {
            const parent: SimpleExpression | SimpleAction = SimpleReference.bubbleUp(this.parent);
            return parent instanceof SimpleAction
                ? parent.listener.directive.element.scope
                : parent.directive.element.scope;
        }
        maybeGetObjAndKey(base: string, scope?: object): ObjAndKey {
            const fallback = { nah: true };
            const hasBrackets = base.indexOf("[") !== -1;
            let hasDots = base.indexOf(".") !== -1;
            let obj: object;
            if (scope) {
                obj = scope;
            } else {
                let root: any = SimpleReference.bubbleUp(this.parent);
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
                        base = base.replace(/\[([^\[\]]*)\]/g, function(_, capture) {
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
                    let key: string | boolean;
                    parts.some(function(part, index) {
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

    simpleDirectives.register = (element?: HTMLElement, root?: object) => new SimpleDirectivesRegistrar(element, root);
})(simpleDirectives);
