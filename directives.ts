const simpleDirectives: any = {};
(function(simpleDirectives) {
    // SECTIONS:
    // > Registrar
    // > Elements
    // > Directives
    // > Actions
    // > References

    // TODO: skip making a directive just to house multiple expressions
    // TODO: instead, handle splitting expressons in the element class and make a new directive from each one
    // TODO: remove the current SimpleDirective class and rename the SimpleExpression class to SimpleDirective
    // TODO: rename SimpleListener and make it an extension of SimpleDirective
    // TODO: (even if that means we need to make SimpleDirective really basic and have a new middle class for the other directives)

    function is(target: any) {
        return {
            oneOf(arr: any[]): boolean {
                let isOneOf = false;
                arr.some(item => {
                    if (item === target) {
                        isOneOf = true;
                        return true;
                    }
                });
                return isOneOf;
            }
        };
    }

    function removeNulls(arr: any[]) {
        let index: number;
        while ((index = arr.indexOf(null)) !== -1) {
            arr.splice(index, 1);
        }
    }

    // > REGISTRAR
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
        register(target: HTMLElement, scope?: object) {
            let element: SimpleElement;
            let hasDirective = false;
            let skipChildren = false;
            ["attr", "class", "for", "html", "if", "on", "rdo"].some((type: string) => {
                if (target.hasAttribute(`sd-${type}`)) {
                    hasDirective = true;
                    if (is(type).oneOf(["if", "for"])) {
                        skipChildren = true;
                    }
                    return true;
                }
            });
            if (
                hasDirective &&
                !is(target).oneOf(this.elements.map(se => se.raw)) &&
                (!target.hasAttribute("sd-rdo") || SdRdo.isFirstRdoOfGroup(this, target as HTMLInputElement))
            ) {
                element = new SimpleElement(this, target, scope);
                this.elements.push(element);
            }
            if (!element || !skipChildren) {
                Array.from(target.children).forEach((child: HTMLElement) => this.register(child, scope));
            }
        }
        runner() {
            this.references.forEach((reference: SimpleReference) => reference.run());
            setTimeout(() => {
                this.runner();
            }, 200);
        }
        unregister(target: HTMLElement) {
            this.elements = this.elements.map((element: SimpleElement) => {
                if (element.raw === target || target.contains(element.raw)) {
                    return element.unregister();
                } else {
                    return element;
                }
            });
            removeNulls(this.elements);
        }
        getSimpleElement(target: HTMLElement) {
            let simpleElement: SimpleElement;
            this.elements.some((element: SimpleElement) => {
                if (element.raw === target) {
                    simpleElement = element;
                    return true;
                }
            });
            return simpleElement;
        }
    }

    // > ELEMENTS
    // ============================================================================

    class SimpleElement {
        directives: SimpleDirective[] = [];
        instance: SimpleDirectivesRegistrar;
        raw: HTMLElement;
        scope: object;
        constructor(instance: SimpleDirectivesRegistrar, element: HTMLElement, scope?: object) {
            this.instance = instance;
            this.raw = element;
            this.scope = scope ? scope : {};
            // IMPORTANT: `if` and `for` must be first; `on` must be last
            ["if", "for", "attr", "class", "html", "rdo", "on"].forEach((type: string) => {
                const attributeValue = element.getAttribute(`sd-${type}`);
                if (attributeValue) {
                    const directive: SimpleDirective = new SimpleDirective(this, type, attributeValue.replace(/\s+/g, ""));
                    this.directives.push(directive);
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
            if (is("for").oneOf(directiveTypes)) {
                this.directives.some((directive: SimpleDirective) => {
                    if (directive.type === "for") {
                        this.raw.innerHTML = (directive.expressions[0] as SdFor).originalHTML;
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

    // > DIRECTIVES
    // ============================================================================

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

    class SimpleExpression {
        raw: string;
        directive: SimpleDirective;
        reference: SimpleReference;
        constructor(directive: SimpleDirective, raw: string, skipRefAssignment?: boolean) {
            this.raw = raw;
            this.directive = directive;
            if (!skipRefAssignment) {
                // RAW: reference[:arg:arg:..]
                this.reference = this.assignReference(raw);
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
                Array.from(element.raw.children).forEach((child: HTMLElement) =>
                    element.instance.register(child, this.directive.element.scope)
                );
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
            this.reference = this.assignReference(rawParts.join(":"));
        }
        run(value: any) {
            const element = this.directive.element.raw;
            if (this.attribute === "value" && element.tagName === "SELECT") {
                Array.from(element.getElementsByTagName("option")).forEach((optionElement: HTMLOptionElement) => {
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
        classes: string[];
        constructor(directive: SimpleDirective, raw: string) {
            // RAW: class,class,..:reference[:arg:arg..]
            const rawParts = raw.split(":");
            super(directive, raw, true);
            this.classes = rawParts.shift().split(",");
            this.reference = this.assignReference(rawParts.join(":"));
        }
        run(value: any) {
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
        alias: string;
        originalChildren: number;
        originalHTML: string;
        constructor(directive: SimpleDirective, raw: string) {
            // RAW: alias:reference[:arg:arg:..]
            const rawParts = raw.split(":");
            super(directive, raw, true);
            this.alias = rawParts.shift();
            this.originalHTML = this.directive.element.raw.innerHTML;
            this.originalChildren = this.directive.element.raw.children.length;
            this.reference = this.assignReference(rawParts.join(":"));
        }
        run(value: any) {
            const $collection = value;
            const simpleElement = this.directive.element;
            const element = simpleElement.raw;
            const orphan = document.createElement("div");
            if (!value) {
                return;
            }
            orphan.innerHTML = this.originalHTML.repeat($collection.length);
            Array.from(element.children).forEach((child: HTMLElement) => {
                simpleElement.instance.unregister(child);
                element.removeChild(child);
            });
            Array.from(orphan.children).forEach((child: HTMLElement, index) => {
                const $index = Math.floor(index / this.originalChildren);
                const scope = Object.assign({}, this.directive.element.scope);
                scope[this.alias] = Object.assign({ $collection, $index }, $collection[$index]);
                element.appendChild(child);
                simpleElement.instance.register(child, scope);
            });
            if (element.tagName === "SELECT") {
                simpleElement.directives.some(directive => {
                    if (directive.type === "attr") {
                        directive.expressions.some((sdAttr: SdAttr) => {
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
        run(value: any) {
            const instance = this.directive.element.instance;
            const element = this.directive.element;
            Array.from(element.raw.children).forEach((child: HTMLElement) => instance.unregister(child));
            element.raw.innerHTML = value;
            Array.from(element.raw.children).forEach((child: HTMLElement) =>
                instance.register(child, this.directive.element.scope)
            );
        }
    }

    class SdRdo extends SimpleExpression {
        run(value: any) {
            const groupName = this.directive.element.raw.getAttribute("name");
            const radioInputs = Array.from(document.getElementsByName(groupName));
            radioInputs.forEach((radioInput: HTMLInputElement) => {
                if (radioInput.value === value) {
                    radioInput.checked = true;
                } else {
                    radioInput.checked = false;
                }
            });
        }
        static isFirstRdoOfGroup(instance: SimpleDirectivesRegistrar, target: HTMLInputElement) {
            let isFirst = true;
            instance.elements.some(({ raw }) => {
                if (
                    raw.tagName === "INPUT" &&
                    raw.getAttribute("type") === "radio" &&
                    raw.getAttribute("name") === target.getAttribute("name")
                ) {
                    isFirst = false;
                }
            });
            return isFirst;
        }
    }

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
            this.events = rawParts.shift().split(",");
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

    // ACTIONS
    // ============================================================================

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
            this.callee = SimpleReference.getReference(this, raw) as SimplePointer;
        }
        run(event: Event) {
            this.callee.get({ event });
        }
    }

    class SimpleAssigner extends SimpleAction {
        left: SimplePointer;
        right: SimpleReference;
        constructor(listener: SimpleListener, raw: string) {
            // RAW: reference=reference[:arg:arg:..]
            const rawParts = raw.split("=");
            super(listener, raw);
            this.left = SimpleReference.getReference(this, rawParts.shift()) as SimplePointer;
            this.right = SimpleReference.getReference(this, rawParts[0]);
        }
        run() {
            const right = this.right.get();
            this.left.obj[this.left.key] = right;
        }
    }

    class SimpleUpdater extends SimpleAction {
        updatee: SimplePointer;
    }

    class ValueUpdater extends SimpleUpdater {
        constructor(listener: SimpleListener) {
            super(listener);
            this.listener.directive.element.directives.some(directive => {
                if (directive.type === "attr") {
                    directive.expressions.some((expression: SdAttr) => {
                        if (expression.attribute === "value" && expression.reference instanceof SimplePointer) {
                            this.updatee = expression.reference;
                        }
                    });
                }
            });
        }
        run() {
            const value = (this.listener.directive.element.raw as HTMLInputElement).value;
            if (typeof this.updatee.obj[this.updatee.key] === "number" && !isNaN(Number(value))) {
                this.updatee.obj[this.updatee.key] = Number(value);
            } else {
                this.updatee.obj[this.updatee.key] = value;
            }
        }
    }

    class CheckedUpdater extends SimpleUpdater {
        constructor(listener: SimpleListener) {
            super(listener);
            this.listener.directive.element.directives.some(directive => {
                if (directive.type === "attr") {
                    directive.expressions.some((expression: SdAttr) => {
                        if (expression.attribute === "checked" && expression.reference instanceof SimplePointer) {
                            this.updatee = expression.reference;
                        }
                    });
                }
            });
        }
        run() {
            const element = this.listener.directive.element.raw as HTMLInputElement;
            this.updatee.obj[this.updatee.key] = element.checked;
        }
    }

    class ContentEditableUpdater extends SimpleUpdater {
        constructor(listener: SimpleListener) {
            super(listener);
            this.listener.directive.element.directives.some(directive => {
                if (directive.type === "html") {
                    if (directive.expressions[0].reference instanceof SimplePointer) {
                        this.updatee = directive.expressions[0].reference;
                    }
                }
            });
        }
        run() {
            const element = this.listener.directive.element.raw as HTMLInputElement;
            this.updatee.obj[this.updatee.key] = element.innerHTML;
        }
    }

    class RadioUpdater extends SimpleUpdater {
        constructor(listener: SimpleListener) {
            super(listener);
            this.listener.directive.element.directives.some(directive => {
                if (directive.type === "rdo") {
                    if (directive.expressions[0].reference instanceof SimplePointer) {
                        this.updatee = directive.expressions[0].reference;
                    }
                }
            });
        }
        run() {
            const groupName = (this.listener.directive.element.raw as HTMLInputElement).getAttribute("name");
            const radioInputs = Array.from(document.getElementsByName(groupName));
            let value: any;
            radioInputs.some((radioInput: HTMLInputElement) => {
                if (radioInput.checked) {
                    value = radioInput.value;
                    return true;
                }
            });
            this.updatee.obj[this.updatee.key] = value;
        }
    }

    // REFERENCES
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
        run(skipDiffCheck?: boolean) {
            let currentValue: any = this.get();
            let valueChanged = false;
            if (Array.isArray(currentValue) && Array.isArray(this.value)) {
                if (currentValue.length !== this.value.length) {
                    valueChanged = true;
                } else {
                    currentValue.some((obj, index) => {
                        if (obj !== this.value[index]) {
                            valueChanged = true;
                            return true;
                        }
                    });
                }
            } else if (currentValue !== this.value) {
                valueChanged = true;
            }
            if (Array.isArray(currentValue)) {
                currentValue = currentValue.slice(0);
            }
            // TODO: test swapping objects in the array of an sd-for
            if (valueChanged) {
                // || skipDiffCheck -- TODO: add back once done debugging
                if (typeof currentValue === "object") {
                    // TODO: the values are switched (old value is what I would expect as the new value, and vice versa)
                    console.log("OLD:");
                    console.log(JSON.stringify(this.value));
                    console.log("NEW:");
                    console.log(JSON.stringify(currentValue));
                }
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
                this.run(true);
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

    class SimplePointer extends SimpleReference {
        args: SimpleReference[];
        bang: boolean;
        base: string;
        key: string;
        obj: object;
        scope: any;
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
            let directive: any = SimpleReference.bubbleUp(this.parent);
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
            let objAndKey: any = this.maybeGetObjAndKey(this.base, this.scope);
            if (objAndKey.nah) {
                objAndKey = this.maybeGetObjAndKey(this.base);
            }
            if (!objAndKey.nah) {
                this.obj = objAndKey.obj;
                this.key = objAndKey.key;
            }
            if (parent instanceof SimpleExpression) {
                this.run(true);
            }
        }
        get(additionalScope?: object) {
            let directive: any = SimpleReference.bubbleUp(this.parent);
            let value: any = this.obj[this.key];
            if (directive instanceof SimpleExpression) {
                directive = (directive as SimpleExpression).directive;
            } else {
                directive = (directive as SimpleAction).listener.directive;
            }
            let scope: object = this.scope;
            if (additionalScope) {
                scope = Object.assign({}, scope, additionalScope);
            }
            if (typeof value === "function") {
                const argValues = this.args.map(arg => arg.get(additionalScope));
                value = value.apply(scope, argValues);
            }
            return this.bang ? !value : value;
        }
        maybeGetObjAndKey(base: string, scope?: object): any {
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
                    let foundPath = true;
                    while (/\[[^\[\]]*\]/.test(base)) {
                        base = base.replace(/\[([^\[\]]*)\]/g, (_, capture) => {
                            const cr = this.maybeGetObjAndKey(capture, scope);
                            if (!cr.key) {
                                foundPath = false;
                                return "";
                            }
                            return "." + cr.obj[cr.key];
                        });
                    }
                    if (!foundPath) {
                        return fallback;
                    }
                    if (!hasDots) {
                        hasDots = true;
                    }
                }
                if (hasDots) {
                    const parts = base.split(".");
                    let key: string | boolean;
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

    simpleDirectives.register = (element?: HTMLElement, root?: object) => new SimpleDirectivesRegistrar(element, root);
})(simpleDirectives);
