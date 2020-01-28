const simpleDirectives: any = {};
(function(simpleDirectives) {
    interface PreDirective {
        type: string;
        value: string;
    }

    class SimpleRegistrar {
        elements: SimpleElement[] = [];
        pointers: SimplePointer[] = [];
        root: object;
        constructor(element?: HTMLElement, root?: object) {
            this.root = root ? root : window;
            this.register(element ? element : document.body);
            this.runner();
        }
        register(target: HTMLElement, scope?: object) {
            const directiveNames = ["sd-attr", "sd-class", "sd-for", "sd-html", "sd-if", "sd-on", "sd-rdo"];
            let element: SimpleElement;
            let skipChildren = false;
            if (target.hasAttributes()) {
                let directives: PreDirective[] = Array.from(target.attributes).map(attribute => {
                    let isNotDupeRdo = true;
                    if (attribute.name === "sd-rdo" && !SdRdo.isFirstRdoOfGroup(this, target as HTMLInputElement)) {
                        isNotDupeRdo = false;
                    }
                    if (is(attribute.name).in(directiveNames) && isNotDupeRdo) {
                        if (is(attribute.name).in(["sd-if", "sd-for"])) {
                            skipChildren = true;
                        }
                        return {
                            type: attribute.name,
                            value: attribute.value.replace(/\s+/g, "")
                        };
                    } else {
                        return null;
                    }
                });
                removeNulls(directives);
                if (directives.length) {
                    element = new SimpleElement(this, target, directives, Object.assign({}, scope || {}));
                    this.elements.push(element);
                }
            }
            if (!element || !skipChildren) {
                Array.from(target.children).forEach((child: HTMLElement) => this.register(child, scope));
            }
        }
        runner() {
            this.pointers.forEach((pointer: SimplePointer) => pointer.run());
            setTimeout(() => this.runner(), 200);
        }
        unregister(t: HTMLElement) {
            let els = this.elements;
            els = els.map(e => (e.scope.element === t || t.contains(e.scope.element) ? e.unregister() : e));
            removeNulls(els);
        }
        getSimpleElement(target: HTMLElement) {
            let simpleElements: SimpleElement[] = [];
            this.elements.forEach((element: SimpleElement) => {
                if (element.scope.element === target) {
                    simpleElements.push(element);
                    return true;
                }
            });
            return simpleElements;
        }
    }

    class SimpleElement {
        directives: SimpleDirective[] = [];
        instance: SimpleRegistrar;
        scope: any;
        constructor(instance: SimpleRegistrar, element: HTMLElement, directives: PreDirective[], scope: object) {
            this.instance = instance;
            this.scope = scope;
            this.scope.element = element;
            element.setAttribute("sd-registered", "true");
            directives.forEach(directive => {
                if (is(directive.type).in(["sd-attr", "sd-class", "sd-on"]) && is(";").in(directive.value)) {
                    const split = directive.value.split(";");
                    split.forEach(exp => this.directives.push(SimpleDirective.getDirective(this, directive.type, exp)));
                } else {
                    this.directives.push(SimpleDirective.getDirective(this, directive.type, directive.value));
                }
            });
        }
        unregister() {
            this.scope.element.removeAttribute("sd-registered");
            this.directives.forEach(directive => {
                if (directive instanceof SdOn) {
                    directive.destroy();
                }
                if (directive instanceof SdFor) {
                    this.scope.element.innerHTML = directive.originalHTML;
                }
            });
            this.instance.pointers = this.instance.pointers.map((pointer: SimplePointer) => {
                const parent = SimpleReference.bubbleUp(pointer) as SimpleDirective;
                return parent.element === this ? null : pointer;
            });
            removeNulls(this.instance.pointers);
            return null;
        }
    }

    class SimpleDirective {
        element: SimpleElement;
        expression: string;
        scope: any;
        constructor(element: SimpleElement, expression: string) {
            this.element = element;
            this.expression = expression;
            this.scope = element.scope;
        }
        static getDirective(element: SimpleElement, name: string, expression: string) {
            switch (name.substring(3)) {
                case "attr":
                    return new SdAttr(element, expression);
                case "class":
                    return new SdClass(element, expression);
                case "for":
                    return new SdFor(element, expression);
                case "html":
                    return new SdHtml(element, expression);
                case "if":
                    return new SdIf(element, expression);
                case "on":
                    return new SdOn(element, expression);
                case "rdo":
                    return new SdRdo(element, expression);
            }
        }
    }

    class SdAttr extends SimpleDirective {
        attribute: string;
        reference: SimpleComparison | SimplePointer;
        constructor(element: SimpleElement, expression: string) {
            super(element, expression);
            const [attribute, reference] = splitFirstPart(expression);
            this.attribute = attribute;
            this.scope.attributeName = this.attribute;
            this.reference = SimpleReference.getReference(this, reference);
        }
        run(value: any) {
            const element = this.scope.element;
            if (this.attribute === "value" && element.tagName === "SELECT") {
                Array.from(element.getElementsByTagName("option")).forEach((optionElement: HTMLOptionElement) => {
                    if ((Array.isArray(value) && is(optionElement.value).in(value)) || value == optionElement.value) {
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

    class SdClass extends SimpleDirective {
        cachedState: number = 2;
        classes: string[];
        reference: SimpleComparison | SimplePointer;
        constructor(element: SimpleElement, expression: string) {
            super(element, expression);
            const [classes, reference] = splitFirstPart(expression);
            this.classes = classes.split(",");
            this.scope.classNames = this.classes;
            this.reference = SimpleReference.getReference(this, reference);
        }
        run(value: any) {
            if (this.cachedState === 2) {
                this.cachedState = value ? 1 : 0;
            } else if (value && this.cachedState === 0) {
                this.cachedState = 1;
            } else if (!value && this.cachedState === 1) {
                this.cachedState = 0;
            } else {
                return;
            }
            const element = this.scope.element;
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

    class SdFor extends SimpleDirective {
        alias: string;
        originalChildren: number;
        originalHTML: string;
        reference: SimpleComparison | SimplePointer;
        constructor(element: SimpleElement, expression: string) {
            super(element, expression);
            const [alias, reference] = splitFirstPart(expression);
            this.alias = alias;
            this.scope.itemName = this.alias;
            this.originalChildren = this.scope.element.children.length;
            this.originalHTML = this.scope.element.innerHTML;
            this.reference = SimpleReference.getReference(this, reference);
        }
        run($collection: any) {
            if (!$collection) {
                return;
            }
            const { instance, directives } = this.element;
            const element = this.scope.element;
            const orphan = document.createElement("div");
            orphan.innerHTML = this.originalHTML.repeat($collection.length);
            Array.from(element.children).forEach((child: HTMLElement) => {
                instance.unregister(child);
            });
            if (element.children.length > orphan.children.length) {
                Array(element.children.length - orphan.children.length).map(() => {
                    element.removeChild(element.lastChild);
                });
            } else if (element.children.length < orphan.children.length) {
                const childrenToAdd = Array.from(orphan.children).slice(element.children.length);
                childrenToAdd.forEach((child: HTMLElement, index) => {
                    element.appendChild(child);
                });
            }
            Array.from(element.children).forEach((child: HTMLElement, index) => {
                const $index = Math.floor(index / this.originalChildren);
                const scope = Object.assign({}, this.scope);
                scope[this.alias] = Object.assign({ $collection, $index }, $collection[$index]);
                instance.register(child, scope);
            });
            if (element.tagName === "SELECT") {
                directives.some(directive => {
                    if (directive instanceof SdAttr && directive.attribute === "value") {
                        setTimeout(() => directive.run(directive.reference.get()));
                        return true;
                    }
                });
            }
        }
    }

    class SdHtml extends SimpleDirective {
        reference: SimpleComparison | SimplePointer;
        constructor(element: SimpleElement, expression: string) {
            super(element, expression);
            this.reference = SimpleReference.getReference(this, expression);
        }
        run(value: any) {
            const instance = this.element.instance;
            const element = this.scope.element;
            Array.from(element.children).forEach((child: HTMLElement) => instance.unregister(child));
            element.innerHTML = value;
            Array.from(element.children).forEach((child: HTMLElement) => instance.register(child, this.scope));
        }
    }

    class SdIf extends SimpleDirective {
        cachedState: number = 2;
        reference: SimpleComparison | SimplePointer;
        constructor(element: SimpleElement, expression: string) {
            super(element, expression);
            this.reference = SimpleReference.getReference(this, expression);
        }
        run(value: any) {
            if (this.cachedState === 2) {
                this.cachedState = value ? 1 : 0;
            } else if (value && this.cachedState === 0) {
                this.cachedState = 1;
            } else if (!value && this.cachedState === 1) {
                this.cachedState = 0;
            } else {
                return;
            }
            const instance = this.element.instance;
            const element = this.scope.element;
            if (value) {
                element.style.display = null;
                Array.from(element.children).forEach((child: HTMLElement) => instance.register(child, Object.assign({}, this.scope)));
            } else {
                element.style.display = "none";
                Array.from(element.children).forEach((child: HTMLElement) => instance.unregister(child));
            }
        }
    }

    class SdRdo extends SimpleDirective {
        reference: SimpleComparison | SimplePointer;
        constructor(element: SimpleElement, expression: string) {
            super(element, expression);
            this.reference = SimpleReference.getReference(this, expression);
        }
        run(value: any) {
            const groupName = this.scope.element.getAttribute("name");
            const radioInputs = Array.from(document.getElementsByName(groupName));
            radioInputs.forEach((radioInput: HTMLInputElement) => {
                if (radioInput.value === value) {
                    radioInput.checked = true;
                } else {
                    radioInput.checked = false;
                }
            });
        }
        static isFirstRdoOfGroup(instance: SimpleRegistrar, target: HTMLInputElement) {
            let isFirst = true;
            instance.elements.some(({ scope }) => {
                if (
                    scope.element.tagName === "INPUT" &&
                    scope.element.getAttribute("type") === "radio" &&
                    scope.element.getAttribute("name") === target.getAttribute("name")
                ) {
                    isFirst = false;
                }
            });
            return isFirst;
        }
    }

    class SdOn extends SimpleDirective {
        actions: (SimpleAssigner | SimpleCaller | ValueUpdater | CheckedUpdater | ContentEditableUpdater | RadioUpdater)[];
        events: string[];
        listener: EventListener;
        constructor(element: SimpleElement, expression: string) {
            super(element, expression);
            const [events, actions] = splitFirstPart(expression);
            this.events = events.split(",");
            this.scope.eventNames = this.events;
            this.actions = actions.split(",").map(action => {
                if (action === "$update") {
                    return this.getUpdater();
                } else if (is("=").in(action)) {
                    return new SimpleAssigner(this, action);
                } else {
                    return new SimpleCaller(this, action);
                }
            });
            this.listener = event => this.actions.forEach(action => action.run(event));
            this.events.forEach(event => this.scope.element.addEventListener(event, this.listener));
        }
        destroy() {
            this.events.forEach(event => this.scope.element.removeEventListener(event, this.listener));
        }
        getUpdater(): ValueUpdater | CheckedUpdater | ContentEditableUpdater | RadioUpdater {
            const element = this.scope.element;
            if (element.hasAttribute("sd-attr")) {
                if (element.tagName === "INPUT" && is(element.getAttribute("type")).in(["checkbox", "radio"])) {
                    return new CheckedUpdater(this);
                } else {
                    return new ValueUpdater(this);
                }
            } else if (element.hasAttribute("sd-html") && element.isContentEditable) {
                return new ContentEditableUpdater(this);
            } else if (element.hasAttribute("sd-rdo")) {
                return new RadioUpdater(this);
            }
        }
    }

    class SimpleAction {
        directive: SdOn;
        scope: any;
        constructor(directive: SdOn) {
            this.directive = directive;
            this.scope = directive.scope;
        }
    }

    class SimpleCaller extends SimpleAction {
        callee: SimplePointer;
        constructor(directive: SdOn, action: string) {
            super(directive);
            this.callee = SimpleReference.getReference(this, action) as SimplePointer;
        }
        run(event: Event) {
            const callee = this.callee.obj[this.callee.key];
            const args = this.callee.args.map((arg: SimplePointer) => {
                return arg.bang ? !arg.obj[arg.key] : arg.obj[arg.key];
            });
            callee.apply(Object.assign({ event: event }, this.scope), args);
        }
    }

    class SimpleAssigner extends SimpleAction {
        left: SimplePointer;
        right: SimplePointer | SimpleComparison;
        constructor(directive: SdOn, action: string) {
            super(directive);
            const parts = action.split("=");
            this.left = SimpleReference.getReference(this, parts[0]) as SimplePointer;
            this.right = SimpleReference.getReference(this, parts[1]);
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
        constructor(directive: SdOn) {
            super(directive);
            this.directive.element.directives.some(directive => {
                if (
                    directive instanceof SdAttr &&
                    directive.attribute === "value" &&
                    directive.reference instanceof SimplePointer
                ) {
                    this.updatee = directive.reference;
                    return true;
                }
            });
        }
        run() {
            const value = (this.scope.element as HTMLInputElement).value;
            if (typeof this.updatee.obj[this.updatee.key] === "number" && !isNaN(Number(value))) {
                this.updatee.obj[this.updatee.key] = Number(value);
            } else {
                this.updatee.obj[this.updatee.key] = value;
            }
        }
    }

    class CheckedUpdater extends SimpleUpdater {
        constructor(directive: SdOn) {
            super(directive);
            this.directive.element.directives.some(directive => {
                if (
                    directive instanceof SdAttr &&
                    directive.attribute === "checked" &&
                    directive.reference instanceof SimplePointer
                ) {
                    this.updatee = directive.reference;
                    return true;
                }
            });
        }
        run() {
            const element = this.scope.element as HTMLInputElement;
            this.updatee.obj[this.updatee.key] = element.checked;
        }
    }

    class ContentEditableUpdater extends SimpleUpdater {
        constructor(directive: SdOn) {
            super(directive);
            this.directive.element.directives.some(directive => {
                if (directive instanceof SdHtml && directive.reference instanceof SimplePointer) {
                    this.updatee = directive.reference;
                    return true;
                }
            });
        }
        run() {
            const element = this.scope.element as HTMLInputElement;
            this.updatee.obj[this.updatee.key] = element.innerHTML;
        }
    }

    class RadioUpdater extends SimpleUpdater {
        constructor(directive: SdOn) {
            super(directive);
            this.directive.element.directives.some(directive => {
                if (directive instanceof SdHtml && directive.reference instanceof SimplePointer) {
                    this.updatee = directive.reference;
                    return true;
                }
            });
        }
        run() {
            const groupName = (this.scope.element as HTMLInputElement).getAttribute("name");
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

    class SimpleReference {
        parent: SimpleDirective | SimpleReference | SimpleAction;
        scope: any;
        constructor(parent: SimpleDirective | SimpleReference | SimpleAction) {
            this.parent = parent;
            this.scope = parent.scope;
        }
        static bubbleUp(reference: SimpleReference): SimpleDirective | SimpleAction {
            let parent: any = reference;
            while (parent instanceof SimpleReference) {
                parent = parent.parent;
            }
            return parent;
        }
        static getReference(parent: SimpleDirective | SimpleReference | SimpleAction, reference: string, isArg?: boolean) {
            if (/[=<!>]/.test(reference.substring(1))) {
                return new SimpleComparison(parent, reference, isArg);
            } else {
                return new SimplePointer(parent, reference, isArg);
            }
        }
    }

    class SimpleComparison extends SimpleReference {
        left: SimplePointer | SimpleComparison;
        comparator: string;
        right: SimplePointer | SimpleComparison;
        constructor(parent: SimpleDirective | SimpleReference | SimpleAction, comparison: string, isArg?: boolean) {
            super(parent);
            const comparator = comparison.match(/([=<!>]{1,3})/)[0];
            const index = comparison.indexOf(comparator);
            this.comparator = comparator;
            this.left = SimpleReference.getReference(this, comparison.substring(0, index), isArg);
            this.right = SimpleReference.getReference(this, comparison.substring(index + comparator.length), isArg);
        }
        get() {
            const left = this.left.get();
            const right = this.right.get();
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
        args: (SimplePointer | SimpleComparison)[] = [];
        bang: boolean = false;
        base: string;
        key: string;
        obj: object;
        value: any;
        constructor(parent: SimpleDirective | SimpleAction | SimpleReference, pointer: string, isArg?: boolean) {
            super(parent);
            if (pointer.startsWith("!")) {
                this.bang = true;
                pointer = pointer.substring(1);
            }
            const [base, args] = splitFirstPart(pointer);
            this.base = base;
            if (args) {
                this.args = args.split(",").map(a => SimpleReference.getReference(this, a, true));
            }
            this.obj = { value: pointer };
            this.key = "value";
            let objAndKey: any = this.maybeGetObjAndKey(this.base, this.scope);
            if (objAndKey.nah) {
                objAndKey = this.maybeGetObjAndKey(this.base);
            }
            if (!objAndKey.nah) {
                this.obj = objAndKey.obj;
                this.key = objAndKey.key;
            }
            if (!isArg) {
                const bubbledUpParent = SimpleReference.bubbleUp(this);
                if (bubbledUpParent instanceof SimpleDirective && !(bubbledUpParent instanceof SdOn)) {
                    bubbledUpParent.element.instance.pointers.push(this);
                    this.run(true);
                }
            }
        }
        get() {
            let value: any = this.obj[this.key];
            if (typeof value === "function") {
                const args = this.args.map((arg: SimplePointer) => {
                    return arg.bang ? !arg.obj[arg.key] : arg.obj[arg.key];
                });
                value = value.apply(this.scope, args);
            }
            return this.bang ? !value : value;
        }
        maybeGetObjAndKey(base: string, scope?: object): any {
            const fallback = { nah: true };
            const hasBrackets = is("[").in(base);
            let hasDots = is(".").in(base);
            let obj: object;
            if (scope) {
                obj = scope;
            } else {
                let root: any = SimpleReference.bubbleUp(this);
                if (root instanceof SimpleDirective) {
                    root = root.element.instance.root;
                } else {
                    root = root.directive.element.instance.root;
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
            if (valueChanged || skipDiffCheck) {
                const directive = SimpleReference.bubbleUp(this) as SdAttr | SdClass | SdFor | SdHtml | SdIf | SdRdo;
                this.value = currentValue;
                try {
                    directive.run(directive.reference.get());
                } catch (e) {
                    setTimeout(() => directive.run(directive.reference.get()));
                }
            }
        }
    }

    function is(target: any) {
        return {
            in: str => str.indexOf(target) !== -1,
            oneOf: arr => arr.some(item => item === target)
        };
    }

    function removeNulls(arr: any[]) {
        let index: number;
        while ((index = arr.indexOf(null)) !== -1) {
            arr.splice(index, 1);
        }
    }

    function splitFirstPart(expression: string) {
        const parts = expression.split(":");
        const firstPart = parts.shift();
        const theRest = parts.join(":");
        return [firstPart, theRest];
    }

    simpleDirectives.register = (element?: HTMLElement, root?: object) => new SimpleRegistrar(element, root);
})(simpleDirectives);
