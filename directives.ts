const simpleDirectives: any = {};
(function(simpleDirectives) {
    type AnyUpdater = ValueUpdater | CheckedUpdater | ContentEditableUpdater | RadioUpdater;
    type Binders = SdAttr | SdClass | SdFor | SdHtml | SdIf | SdRdo;
    type ReferenceParent = SimpleAction | SimpleDirective | SimpleReference;

    interface PreDirective {
        type: string;
        value: string;
    }

    // a new instance of this is created when the dev calls simpleDirectives.register()
    class SimpleRegistrar {
        elements: SimpleElement[] = [];
        pointers: SimplePointer[] = [];
        root: object;

        constructor(element?: HTMLElement, root?: object) {
            // default root to window if not provided
            this.root = root ? root : window;
            // register the provided element, or the body if one was not provided
            this.register(element ? element : document.body);
            // start the runner
            this.runner();
        }

        register(target: HTMLElement, scope?: object) {
            const directiveNames = Object.keys(directiveClasses).map(k => k.replace("d", "d-").toLowerCase());
            let element: SimpleElement;
            let skipChildren = false;

            if (target.hasAttributes()) {
                // get any directives that might exist on this element
                let directives: PreDirective[] = Array.from(target.attributes).map(({ name, value }) => {
                    // make sure we don't register a radio group more than once
                    const isNotDupeRdo = name !== "sd-rdo" || SdRdo.isFirstRdoOfGroup(this, target as HTMLInputElement);

                    if (is(name).in(directiveNames) && isNotDupeRdo) {
                        // don't register children; the directives will handle that on their first run
                        if (is(name).in(["sd-if", "sd-for"])) {
                            skipChildren = true;
                        }

                        return { type: name, value: value.replace(/\s+/g, "") };
                    } else {
                        return null;
                    }
                });
                removeNulls(directives);

                // only register the element if it has at least one of our directives
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

            directives.sort((a, b) => {
                if (a.type === "sd-if" && b.type !== "sd-if") {
                    return 1;
                }
                if (a.type === "sd-for" && !is(b.type).in(["sd-if", "sd-for"])) {
                    return 1;
                }
                if (a.type === "on" && b.type !== "on") {
                    return -1;
                }
            });

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
                scope[this.alias] = Object.assign({ $collection, $index }, $collection[$index]);

                this.handleSdForUniques(child, "sd" + $index);

                instance.register(child, scope);
            });

            if (element.tagName === "SELECT") {
                directives.some(directive => {
                    if (directive instanceof SdAttr && directive.attribute === "value") {
                        setTimeout(() => directive.reference.get(value => directive.run(value)));
                        return true;
                    }
                });
            }
        }

        handleSdForUniques(target: HTMLElement, suffix: string) {
            const attributes = target.getAttribute("sd-for-unique");

            if (attributes) {
                attributes.split(",").forEach(attribute => {
                    const current = target.getAttribute(attribute);
                    if (current) {
                        target.setAttribute(attribute, current + suffix);
                    } else {
                        target.setAttribute(attribute, "sdForUnique" + suffix);
                    }
                });
            }

            Array.from(target.children).forEach((child: HTMLElement) => this.handleSdForUniques(child, suffix));
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
            removeNulls(this.actions);

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
            } else if (
                element.tagName === "INPUT" &&
                element.getAttribute("type") === "radio" &&
                element.hasAttribute("name") &&
                (element.hasAttribute("sd-rdo") ||
                    Array.from(
                        document.querySelectorAll('input[name="' + element.getAttribute("name") + '"]')
                    ).some((radio: HTMLElement) => radio.hasAttribute("sd-rdo")))
            ) {
                return new RadioUpdater(this);
            } else {
                return null;
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
        action: string;
        callee: SimplePointer;

        constructor(directive: SdOn, action: string) {
            super(directive);
            this.action = action;
            this.callee = SimpleReference.getReference(this, action) as SimplePointer;
        }

        doApply(event: Event) {
            const callee = this.callee.obj[this.callee.key];
            const args = this.callee.args.map((arg: SimplePointer) => {
                return arg.bang ? !arg.obj[arg.key] : arg.obj[arg.key];
            });

            callee.apply(Object.assign({ event: event }, this.scope), args);
        }

        run(event: Event) {
            // try to fire immediately first
            if (this.callee.obj && this.callee.obj.hasOwnProperty(this.callee.key)) {
                this.doApply(event);
            } else {
                // if we lost the callee, it may be because the dev is doing something with it on their end
                // wait until the current stack is done and try once more
                setTimeout(() => {
                    this.callee.tryRelink();
                    if (this.callee.obj && this.callee.obj.hasOwnProperty(this.callee.key)) {
                        this.doApply(event);
                    }
                });
            }
        }
    }

    class SimpleAssigner extends SimpleAction {
        action: string;
        left: SimplePointer;
        right: SimplePointer | SimpleComparison;

        constructor(directive: SdOn, action: string) {
            super(directive);

            this.action = action;

            const parts = action.split("=");

            this.left = SimpleReference.getReference(this, parts[0]) as SimplePointer;
            this.right = SimpleReference.getReference(this, parts[1]);
        }

        run() {
            this.right.get(right => {
                this.left.obj[this.left.key] = right;
            });
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
            const { innerHTML } = this.scope.element as HTMLInputElement;
            this.updatee.obj[this.updatee.key] = innerHTML;
        }
    }

    class RadioUpdater extends SimpleUpdater {
        constructor(directive: SdOn) {
            super(directive);

            const instance = this.directive.element.instance;

            // kick this out of the current thread so the SimpleElements will be available
            setTimeout(() => {
                const radios = document.querySelectorAll(`input[name=\"${this.scope.element.getAttribute("name")}\"]`);
                Array.from(radios).some((radio: HTMLInputElement) => {
                    const simpleElements = instance.getSimpleElement(radio);
                    if (simpleElements.length) {
                        simpleElements[0].directives.some(directive => {
                            if (directive instanceof SdRdo && directive.reference instanceof SimplePointer) {
                                this.updatee = directive.reference;
                                return true;
                            }
                        });
                    }
                });
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
        comparison: string;
        comparator: string;
        right: SimplePointer | SimpleComparison;

        constructor(parent: ReferenceParent, comparison: string, isArg?: boolean) {
            super(parent);

            const comparator = comparison.match(/([=<!>]{1,3})/)[0];
            const index = comparison.indexOf(comparator);

            this.comparison = comparison;
            this.comparator = comparator;

            this.left = SimpleReference.getReference(this, comparison.substring(0, index), isArg);
            this.right = SimpleReference.getReference(this, comparison.substring(index + comparator.length), isArg);
        }

        get(resolve) {
            this.left.get(left => {
                this.right.get(right => {
                    switch (this.comparator) {
                        case "==":
                            resolve(left == right);
                            break;
                        case "===":
                            resolve(left === right);
                            break;
                        case "!=":
                            resolve(left != right);
                            break;
                        case "!==":
                            resolve(left != right);
                            break;
                        case "<":
                            resolve(left < right);
                            break;
                        case ">":
                            resolve(left > right);
                            break;
                        case "<=":
                            resolve(left <= right);
                            break;
                        case ">=":
                            resolve(left >= right);
                            break;
                    }
                });
            });
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

            const { obj, key } = this.getObjAndKey(this.base, this.scope);
            this.obj = obj;
            this.key = key;

            if (!isArg) {
                const bubbledUpParent = SimpleReference.bubbleUp(this);

                if (bubbledUpParent instanceof SimpleDirective && !(bubbledUpParent instanceof SdOn)) {
                    bubbledUpParent.element.instance.pointers.push(this);
                    this.run(true);
                }
            }
        }

        get(resolve) {
            let args: SimplePointer[];
            let value: any = this.obj[this.key];

            if (typeof value === "function") {
                if (this.args.some((arg: SimplePointer) => !arg.obj || !arg.obj.hasOwnProperty(arg.key))) {
                    // one of the args is undefined; pop execution out into it's own thread
                    setTimeout(() => {
                        args = this.args.map((arg: SimplePointer) => {
                            if (!arg.obj || !arg.obj.hasOwnProperty(arg.key)) {
                                arg.tryRelink();
                            }
                            return arg.bang ? !arg.obj[arg.key] : arg.obj[arg.key];
                        });

                        value = value.apply(this.scope, args);
                        resolve(this.bang ? !value : value);
                    });
                } else {
                    args = this.args.map((arg: SimplePointer) => {
                        return arg.bang ? !arg.obj[arg.key] : arg.obj[arg.key];
                    });

                    value = value.apply(this.scope, args);
                }
            }

            resolve(this.bang ? !value : value);
        }

        getObjAndKey(base: string, scope: object) {
            let obj: any = { value: base };
            let key: string = "value";

            let objAndKey: any = this.maybeGetObjAndKey(base, scope, false);

            if (objAndKey.nah) {
                objAndKey = this.maybeGetObjAndKey(base, scope, true);
            }

            if (!objAndKey.nah) {
                obj = objAndKey.obj;
                key = objAndKey.key;
            }

            return { obj, key };
        }

        maybeGetObjAndKey(base: string, scope: object, tryWithoutScope: boolean): any {
            const fallback = { nah: true };
            const hasBrackets = is("[").in(base);
            let hasDots = is(".").in(base);
            let obj: object;
            let workingBase = base;

            if (scope && !tryWithoutScope) {
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
                    while (/\[[^\[\]]*\]/.test(workingBase)) {
                        workingBase = workingBase.replace(/\[([^\[\]]*)\]/g, (_, capture) => {
                            const { obj, key } = this.getObjAndKey(capture, scope);
                            return "." + obj[key];
                        });
                    }

                    if (!hasDots) {
                        hasDots = true;
                    }
                }

                if (hasDots) {
                    const parts = workingBase.split(".");
                    let key: string | boolean;

                    if (obj[parts[0]] && obj[parts[0]].$collection && parts[1] !== "$collection" && parts[1] !== "$index") {
                        const itemRef = obj[parts[0]].$collection[obj[parts[0]].$index];
                        obj = {};
                        obj[parts[0]] = itemRef;
                    }

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
            this.get(value => {
                let currentValue: any = value;
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
                        directive.reference.get(value => directive.run(value));
                    } catch (e) {
                        setTimeout(() => directive.reference.get(value => directive.run(value)));
                    }
                }
            });
        }

        tryRelink() {
            const { obj, key } = this.getObjAndKey(this.base, this.scope);
            this.obj = obj;
            this.key = key;
        }
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

    const is = (thing: any) => ({ in: collection => collection.indexOf(thing) !== -1 });

    const directiveClasses = { SdAttr, SdClass, SdFor, SdHtml, SdIf, SdRdo, SdOn };

    simpleDirectives.register = (element?: HTMLElement, root?: object) => new SimpleRegistrar(element, root);
})(simpleDirectives);
