class SimpleDirectives {
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
        // TODO: find an extension that does inline sorts of arrays
        ["if", "for", "attr", "class", "html", "rdo", "on"].some(function(type: string) {
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
        // TODO
        setTimeout(this.runner, 200);
    }
    unregister(target: HTMLElement) {
        this.elements.forEach(function(element: SimpleElement) {
            if (target.contains(element.raw)) {
                element.unregister();
            }
        });
    }
}

class SimpleElement {
    directives: SimpleDirective[] = [];
    hasFalseIf: boolean;
    instance: SimpleDirectives;
    raw: HTMLElement;
    scope: object;
    constructor(instance: SimpleDirectives, element: HTMLElement) {
        this.instance = instance;
        this.raw = element;
        // IMPORTANT: `if` must be first; `for` must be second; `on` must be last
        ["if", "attr", "class", "for", "html", "on", "rdo"].some((type: string) => {
            const attributeValue = element.getAttribute(`sd-${type}`);
            if (attributeValue) {
                this.directives.push(new SimpleDirective(this, type, attributeValue.replace(/\s+/g, "")));
            }
        });
    }
    unregister() {
        // TODO
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

class SimpleListener {
    // sd-on="event,event,..:referece:arg:arg:..,referece:arg:arg:..,..;.."
    actions: SimpleAction[];
    directive: SimpleDirective;
    elo: EventListenerObject[];
    events: string[];
    raw: string;
    constructor(directive: SimpleDirective, raw: string) {
        const rawParts = raw.split(":");
        this.directive = directive;
        this.events = rawParts[0].split(",");
        this.raw = raw;
        this.actions = rawParts.join(":").split(",").map((rawAction: string): SimpleAction => {
            if (rawAction === "$update") {
                return new SimpleUpdater(this, rawAction);
            } else if (rawAction.indexOf("=") !== -1) {
                return new SimpleAssigner(this, rawAction);
            } else {
                return new SimpleCaller(this, rawAction);
            }
        });
    }
    destroy() {
        // TODO
    }
}

// EXPRESSIONS
// ============================================================================

// BASE CLASS
class SimpleExpression {
    raw: string;
    directive: SimpleDirective;
    reference: SimpleReference;
    constructor(directive: SimpleDirective, raw: string, skipRefAssignment?: boolean) {
        this.raw = raw;
        this.directive = directive;
        if (!skipRefAssignment) {
            this.assignReference(raw);
        }
    }
    assignReference(raw: string): SimpleReference {
        let reference: SimpleReference;
        if (/[=<!>]/.test(raw.substring(1))) {
            reference = new SimpleComparison(this, raw);
        } else {
            reference = new SimplePointer(this, raw);
        }
        this.directive.element.instance.references.push(reference);
        return reference;
    }
}

class SdIf extends SimpleExpression {
    // sd-if="reference:arg:arg:.."
    run() {
        // TODO
    }
}

class SdAttr extends SimpleExpression {
    // sd-attr="attribute:reference:arg:arg:..;.."
    attribute: string;
    constructor(directive: SimpleDirective, raw: string) {
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
    // sd-class="class,class,..:reference:arg:arg..;.."
    classes: string[];
    constructor(directive: SimpleDirective, raw: string) {
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
    // sd-for="alias:reference:arg:arg:.."
    alias: string;
    constructor(directive: SimpleDirective, raw: string) {
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
    // sd-html="reference:arg:arg:.."
    run() {
        // TODO
    }
}

class SdRdo extends SimpleExpression {
    // sd-rdo="reference:arg:arg:.."
    run() {
        // TODO
    }
}

// REFERENCES
// ============================================================================

// BASE CLASS
class SimpleReference {
    key: string;
    obj: object;
    parent: SimpleExpression | SimpleReference | SimpleAction;
    raw: string;
    value: any;
    constructor(parent: SimpleExpression | SimpleReference | SimpleAction, raw: string) {
        this.parent = parent;
        this.raw = raw;
    }
}

class SimplePointer extends SimpleReference {
    args: SimplePointer[];
    base: string;
    constructor(parent: SimpleExpression | SimpleReference | SimpleAction, raw: string) {
        const rawParts = raw.split(":");
        super(parent, raw);
        this.base = rawParts.shift();
        this.args = rawParts.map(rawPart => new SimplePointer(this, rawPart));
    }
    refresh() {
        // TODO
    }
}

class SimpleComparison extends SimpleReference {
    left: SimplePointer;
    comparator: string;
    right: SimplePointer;
    constructor(parent: SimpleExpression | SimpleReference | SimpleAction, raw: string) {
        let comparatorIndex: number;
        super(parent, raw);
        comparatorIndex = raw.indexOf(this.comparator);
        this.comparator = raw.match(/([=<!>]{1,3})/)[0];
        this.left = new SimplePointer(this, raw.substring(0, comparatorIndex));
        this.right = new SimplePointer(this, raw.substring(comparatorIndex + this.comparator.length));
    }
    refresh() {
        // TODO
    }
}

// ACTIONS
// ============================================================================

// BASE CLASS
class SimpleAction {
    listener: SimpleListener;
    raw: string;
    constructor(listener: SimpleListener, raw: string) {
        this.listener = listener;
        this.raw = raw;
    }
    getReference(raw: string): SimpleReference {
        if (/[=<!>]/.test(raw.substring(1))) {
            return new SimpleComparison(this, raw);
        } else {
            return new SimplePointer(this, raw);
        }
    }
}

class SimpleCaller extends SimpleAction {
    // sd-on="event:reference:args"
    callee: SimpleReference;
    constructor(listener: SimpleListener, raw: string) {
        super(listener, raw);
        this.callee = this.getReference(raw);
    }
    run() {
        // TODO
    }
}

class SimpleAssigner extends SimpleAction {
    // sd-on="event:reference = reference:args"
    left: SimpleReference;
    right: SimpleReference;
    constructor(listener: SimpleListener, raw: string) {
        const rawParts = raw.split("=");
        super(listener, raw);
        this.left = this.getReference(rawParts.shift());
        this.right = this.getReference(rawParts[0]);
    }
    run() {
        // TODO
    }
}

class SimpleUpdater extends SimpleAction {
    // sd-on="event:$update"
    updatee: SimpleReference;
    constructor(listener: SimpleListener, raw: string) {
        super(listener, raw);
        // TODO: make sure sd-on is processed last for each element
        // TODO: if element has sd-attr="value:"
        // TODO: if element has sd-attr="checked:"
        // TODO: if element has sd-html and isContentEditable
        // TODO: if element 
        if (element.hasAttribute("sd-attr")) {
            let attrValIndex: number;
            let attr = "value";
            refToUpdate = element.getAttribute("sd-attr");
            if (element.tagName === "INPUT" && is(element.getAttribute("type")).oneOf(["checkbox", "radio"])) {
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
                updater = function() {
                    refToUpdate.parent[refToUpdate.target] = element[attr];
                };
            }
        } else if (element.hasAttribute("sd-html") && element.isContentEditable) {
            refToUpdate = getSimpleReference(element.getAttribute("sd-html"), directive);
            updater = function() {
                refToUpdate.parent[refToUpdate.target] = element.innerHTML;
            };
        } else if (element.hasAttribute("sd-rdo")) {
            refToUpdate = getSimpleReference(element.getAttribute("sd-rdo"), directive);
            updater = function() {
                const radioInputs = Array.from(document.getElementsByName(element.getAttribute("name")));
                let value: any;
                radioInputs.some(function(radioInput: HTMLInputElement) {
                    if (radioInput.checked) {
                        value = radioInput.value;
                        return true;
                    }
                });
                refToUpdate.parent[refToUpdate.target] = value;
            };
        }
    }
    run() {
        // TODO
    }
}
