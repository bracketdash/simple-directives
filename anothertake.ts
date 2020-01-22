class SimpleDirectives {
    elements: SimpleElement[] = [];
    references: SimpleReference[] = [];
    constructor(element: HTMLElement) {
        this.register(element);
    }
    register(element: HTMLElement) {
        // TODO: if element has at least one directive: elements.push(new SimpleElement(element));
        // TODO: loop over any children
    }
}

class SimpleElement {
    raw: HTMLElement;
    directives: SimpleDirective[] = [];
    constructor(element: HTMLElement) {
        this.raw = element;
        // TODO: directives.push(new SimpleDirective(expression, type, this));
    }
}

class SimpleDirective {
    element: SimpleElement;
    type: string;
    expressions: SimpleExpression[];
    constructor(element: SimpleElement, type: string, raw: string) {
        this.element = element;
        this.type = type;
        this.expressions = raw.split(";").map(function(e) {
            let expression: SimpleExpression;
            switch (type) {
                case "attr":
                    expression = new SdAttr(e, this);
                    break;
                // TODO
            }
            return expression;
        });
    }
}

// ============================================================================

class SimpleExpression {
    directive: SimpleDirective;
    raw: string;
    reference: SimpleReference | SimpleComparison;
    constructor(raw: string, directive: SimpleDirective, skipRef?: boolean) {
        this.directive = directive;
        this.raw = raw;
        if (!skipRef) {
            // this.reference = this.getRef(raw);
        }
    }
    getRef(raw: string) {
        // TODO: return new SimpleComparison() if it has a comparator
        // TODO: return new SimpleReference() if not
    }
}

class SdAttr extends SimpleExpression {
    // sd-attr="attribute:reference:arg:arg:..;.."
    attribute: string;
    constructor(raw: string, directive: SimpleDirective) {
        super(raw, directive, true);
        // TODO
    }
    run() {
        // TODO
    }
}

class SdClass extends SimpleExpression {
    // sd-class="class,class,..:reference:arg:arg..;.."
    classes: string[];
    constructor(raw: string, directive: SimpleDirective) {
        super(raw, directive, true);
        // TODO
    }
    run() {
        // TODO
    }
}

class SdFor extends SimpleExpression {
    // sd-for="alias:reference:arg:arg:.."
    alias: string;
    constructor(raw: string, directive: SimpleDirective) {
        super(raw, directive, true);
        // TODO
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

class SdIf extends SimpleExpression {
    // sd-if="reference:arg:arg:.."
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

// ============================================================================

class SimpleReference {
    args: SimpleReference[];
    base: string;
    expressions: SimpleExpression[];
    parent: object;
    target: string;
    value: any;
    constructor(raw: string) {
        // TODO
    }
    hasChanged() {
        // TODO
    }
}

class SimpleComparison {
    comparator: string;
    left: SimpleReference;
    right: SimpleReference;
    expressions: SimpleExpression[];
    value: any;
    constructor(raw: string) {
        // TODO
    }
    hasChanged() {
        // TODO
    }
}

// ============================================================================

class SdOn {
    // sd-on="event,event,..:referece:arg:arg:..,referece:arg:arg:..,..;.."
    events: string[];
    actions: EventListenerObject[];
    constructor() {
        // TODO
    }
}

// ============================================================================

class SimpleAction {
    constructor() {
        // TODO
    }
    run() {
        // TODO
    }
}

class SimpleAssigner {
    left: SimpleReference;
    right: SimpleReference;
    constructor() {
        // TODO
    }
    run() {
        // TODO
    }
}

class SimpleUpdater {
    updatee: SimpleReference;
    element: SimpleElement;
    constructor() {
        // TODO
    }
    run() {
        // TODO
    }
}
