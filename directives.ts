let SimpleDirectives;
(function(SimpleDirectives) {
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

    class Registrar {
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
            if (hasDirective) {
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
        instance: Registrar;
        raw: HTMLElement;
        scope: object;
        constructor(instance: Registrar, element: HTMLElement) {
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
                let parent: SimpleExpression | SimpleReference | SimpleAction = reference;
                while (parent instanceof SimpleReference) {
                    parent = parent.parent;
                }
                if (parent instanceof SimpleExpression && this.raw.contains(parent.directive.element.raw)) {
                    return null;
                } else {
                    return reference;
                }
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
    }

    class SdIf extends SimpleExpression {
        run() {
            // TODO
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
        run() {
            // TODO
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
        run() {
            // TODO
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
        run() {
            // TODO
        }
    }

    class SdHtml extends SimpleExpression {
        run() {
            // TODO
        }
    }

    class SdRdo extends SimpleExpression {
        run() {
            // TODO
        }
    }
    
    // EVENT LISTENING & HANDLING
    // ============================================================================

    class SimpleListener {
        actions: SimpleAction[];
        directive: SimpleDirective;
        elo: EventListenerObject;
        events: string[];
        raw: string;
        constructor(directive: SimpleDirective, raw: string) {
            // RAW: event,event,..:reference[:arg:arg:..][,reference[:arg:arg:..,..]]
            const rawParts = raw.split(":");
            this.directive = directive;
            this.events = rawParts[0].split(",");
            this.raw = raw;
            this.actions = rawParts
                .join(":")
                .split(",")
                .map(
                    (rawAction: string): SimpleAction => {
                        if (rawAction === "$update") {
                            return this.getUpdater();
                        } else if (rawAction.indexOf("=") !== -1) {
                            return new SimpleAssigner(this, rawAction);
                        } else {
                            return new SimpleCaller(this, rawAction);
                        }
                    }
                );
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
    
    class SimpleAction {
        listener: SimpleListener;
        raw?: string;
        constructor(listener: SimpleListener, raw?: string) {
            this.listener = listener;
            if (raw) {
                this.raw = raw;
            }
        }
    }

    class SimpleCaller extends SimpleAction {
        callee: SimpleReference;
        constructor(listener: SimpleListener, raw: string) {
            // RAW: reference[:arg:arg:..]
            super(listener, raw);
            this.callee = SimpleReference.getReference(this ,raw);
        }
        run() {
            // TODO
        }
    }

    class SimpleAssigner extends SimpleAction {
        left: SimpleReference;
        right: SimpleReference;
        constructor(listener: SimpleListener, raw: string) {
            // RAW: reference=reference[:arg:arg:..]
            const rawParts = raw.split("=");
            super(listener, raw);
            this.left = SimpleReference.getReference(this, rawParts.shift());
            this.right = SimpleReference.getReference(this, rawParts[0]);
        }
        run() {
            // TODO
        }
    }
    
    // UPDATER CLASSES

    class SimpleUpdater extends SimpleAction {
        updatee: SimpleReference;
    }

    class ValueUpdater extends SimpleUpdater {
        run() {
            // TODO
        }
    }

    class CheckedUpdater extends SimpleUpdater {
        run() {
            // TODO
        }
    }

    class ContentEditableUpdater extends SimpleUpdater {
        run() {
            // TODO
        }
    }

    class RadioUpdater extends SimpleUpdater {
        run() {
            // TODO
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
        get() { /* leave me be */ }
        run() { /* leave me be */ }
        static getReference(parent: SimpleExpression | SimpleReference | SimpleAction, raw: string) {
            let reference: SimpleReference;
            // TODO: add to conditions - assign one of:
            // SimpleComparison (SimpleReference)
            // ScopePointer (SimplePointer (SimpleReference))
            // RootPointer (SimplePointer (SimpleReference))
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
        }
        run() {
            // TODO
        }
    }
    
    class SimplePointer extends SimpleReference {
        base: string;
        bang: boolean;
        args: SimpleReference[];
        obj: object;
        key: string;
        constructor(parent: SimpleExpression | SimpleReference | SimpleAction, raw: string) {
            // RAW: reference[:arg:arg:..]
            const rawParts = raw.split(":");
            super(parent, raw);
            this.base = rawParts.shift();
            if (this.base.startsWith("!")) {
                this.base = this.base.substring(1);
                this.bang = true;
            }
            this.args = rawParts.map(rawPart => SimpleReference.getReference(this, rawPart));
            // TODO: set this.obj and this.key
        }
        get() {
            let value: any = this.obj[this.key];
            if (typeof value === "function") {
                value = value.apply("TODO: SCOPE", this.args.map(arg => arg.get()));
            }
            return this.bang ? value : !value;
        }
    }
    
    class ScopePointer extends SimplePointer {
        // TODO
        run() {
            // TODO
        }
    }
    
    class RootPointer extends SimplePointer {
        // TODO
        run() {
            // TODO
        }
    }

    // > INITIALIZATION
    // ============================================================================

    SimpleDirectives.register = (element?: HTMLElement, root?: object) => new Registrar(element, root);
})(SimpleDirectives);
