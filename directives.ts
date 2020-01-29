const simpleDirectives: any = {};
(function(simpleDirectives) {
    type AnyUpdater = ValueUpdater | CheckedUpdater | ContentEditableUpdater | RadioUpdater;
    type Binders = SdAttr | SdClass | SdFor | SdHtml | SdIf | SdRdo;
    type ReferenceParent = SimpleAction | SimpleDirective | SimpleReference;

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
            const directiveNames = Object.keys(directiveClasses).map(k => k.replace("d", "d-").toLowerCase());
            let element: SimpleElement;
            let skipChildren = false;

            if (target.hasAttributes()) {
                let directives: PreDirective[] = Array.from(target.attributes).map(({ name, value }) => {
                    const isNotDupeRdo = name !== "sd-rdo" || SdRdo.isFirstRdoOfGroup(this, target as HTMLInputElement);

                    if (is(name).in(directiveNames) && isNotDupeRdo) {
                        if (is(name).in(["sd-if", "sd-for"])) {
                            skipChildren = true;
                        }

                        return { type: name, value: value.replace(/\s+/g, "") };
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

        unregister(target: HTMLElement) {
            this.elements = this.elements.map(element => {
                return element.scope.element === target || target.contains(element.scope.element)
                    ? element.unregister()
                    : element;
            });
            removeNulls(this.elements);
        }

        getSimpleElement(target: HTMLElement) {
            let simpleElements: SimpleElement[] = [];

            this.elements.forEach(element => {
                if (element.scope.element === target) {
                    simpleElements.push(element);
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
            Object.assign(this, { instance, scope });
            this.scope.element = element;

            element.setAttribute("sd-registered", "true");

            directives.forEach(({ type, value }) => {
                if (is(type).in(["sd-attr", "sd-class", "sd-on"]) && is(";").in(value)) {
                    const split = value.split(";");
                    split.forEach(exp => this.directives.push(SimpleDirective.getDirective(this, type, exp)));
                } else {
                    this.directives.push(SimpleDirective.getDirective(this, type, value));
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

            this.instance.pointers = this.instance.pointers.map(pointer => {
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
            Object.assign(this, { element, expression, scope: element.scope });
        }

        static getDirective(element: SimpleElement, name: string, expression: string) {
            const className = "Sd" + name.substring(3, 4).toUpperCase() + name.substring(4);
            return new directiveClasses[className](element, expression);
        }
    }

    class SdAttr extends SimpleDirective {
        attribute: string;
        reference: SimpleComparison | SimplePointer;

        constructor(element: SimpleElement, expression: string) {
            super(element, expression);
            const [attribute, reference] = splitFirstPart(expression);
            this.attribute = attribute;
            this.scope.attributeName = attribute;
            this.reference = SimpleReference.getReference(this, reference);
        }

        run(value: any) {
            const attribute = this.attribute;
            const element = this.scope.element;

            if (attribute === "value" && element.tagName === "SELECT") {
                Array.from(element.getElementsByTagName("option")).forEach((optionElement: HTMLOptionElement) => {
                    if ((Array.isArray(value) && is(optionElement.value).in(value)) || value == optionElement.value) {
                        optionElement.selected = true;
                    } else {
                        optionElement.selected = false;
                    }
                });
            } else if (!value) {
                if (element.hasAttribute(attribute)) {
                    element.removeAttribute(attribute);
                }

                if (attribute === "value") {
                    element.value = "";
                }
            } else {
                element.setAttribute(attribute, value);

                if (attribute === "value") {
                    element.value = value;
                }
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

            const classList = this.scope.element.classList;

            this.classes.forEach(className => {
                if (!value) {
                    if (classList.contains(className)) {
                        classList.remove(className);
                    }
                } else if (!classList.contains(className)) {
                    classList.add(className);
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

            Object.assign(this, {
                alias,
                originalChildren: this.scope.element.children.length,
                originalHTML: this.scope.element.innerHTML
            });

            this.scope.itemName = this.alias;
            this.reference = SimpleReference.getReference(this, reference);
        }

        run($collection: any) {
            if (!$collection) {
                return;
            }

            const { instance, directives } = this.element;
            const element = this.scope.element;
            const children = this.scope.element.children;
            const orphan = document.createElement("div");

            orphan.innerHTML = this.originalHTML.repeat($collection.length);

            Array.from(children).forEach((child: HTMLElement) => {
                instance.unregister(child);
            });

            if (children.length > orphan.children.length) {
                Array.from(Array(children.length - orphan.children.length)).forEach(() => {
                    element.removeChild(element.lastChild);
                });
            } else if (children.length < orphan.children.length) {
                const childrenToAdd = Array.from(orphan.children).slice(children.length);
                childrenToAdd.forEach((child: HTMLElement) => {
                    element.appendChild(child);
                });
            }

            Array.from(children).forEach((child: HTMLElement, index) => {
                const $index = Math.floor(index / this.originalChildren);
                const scope = Object.assign({}, this.scope);
                // TODO: okay, so we should try to pass the item by reference and keep it referring to it's original self
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
            const { style, children } = this.scope.element;

            if (value) {
                style.display = null;
                Array.from(children).forEach((child: HTMLElement) =>
                    instance.register(child, Object.assign({}, this.scope))
                );
            } else {
                style.display = "none";
                Array.from(children).forEach((child: HTMLElement) => instance.unregister(child));
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
        actions: (SimpleAssigner | SimpleCaller | AnyUpdater)[];
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

        getUpdater(): AnyUpdater {
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
            console.log(element.checked, this.updatee.key);
            console.log(this.updatee.obj);
            // BUG: dev isn't able to update values on root that are added to scope via sd-for
            // TODO: pass the scope (the one created in sd-for) by reference and make sure it doesn't lose the ref?
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
            const { innerHTML } = this.scope.element as HTMLInputElement;
            this.updatee.obj[this.updatee.key] = innerHTML;
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
        parent: ReferenceParent;
        scope: any;

        constructor(parent: ReferenceParent) {
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

        static getReference(parent: ReferenceParent, reference: string, isArg?: boolean) {
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

        constructor(parent: ReferenceParent, comparison: string, isArg?: boolean) {
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

        constructor(parent: ReferenceParent, pointer: string, isArg?: boolean) {
            super(parent);

            if (pointer.startsWith("!")) {
                this.bang = true;
                pointer = pointer.substring(1);
            }

            const [base, args] = splitFirstPart(pointer);

            this.base = base;

            if (args) {
                this.args = args.split(":").map(a => SimpleReference.getReference(this, a, true));
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
                return obj.hasOwnProperty(base) ? { obj, key: base } : fallback;
            } else {
                if (hasBrackets) {
                    let foundPath = true;

                    while (/\[[^\[\]]*\]/.test(base)) {
                        base = base.replace(/\[([^\[\]]*)\]/g, (_, capture) => {
                            const { obj, key } = this.maybeGetObjAndKey(capture, scope);
                            if (!key) {
                                foundPath = false;
                                return "";
                            }
                            return "." + obj[key];
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

                    return typeof key === "string" ? { obj, key } : fallback;
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
                const directive = SimpleReference.bubbleUp(this) as Binders;

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

    const directiveClasses = { SdAttr, SdClass, SdFor, SdHtml, SdIf, SdRdo, SdOn };

    simpleDirectives.register = (element?: HTMLElement, root?: object) => new SimpleRegistrar(element, root);
})(simpleDirectives);
