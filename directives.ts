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
        trackers: any[] = [];

        constructor(element?: HTMLElement, root?: object) {
            // default root to window if not provided
            this.root = root ? root : window;
            // register the provided element, or the body if one was not provided
            this.register(element ? element : document.body);
            // start the runner
            this.runner();
        }

        register(target: HTMLElement, scope?: object, tracker?: string) {
            const directiveNames = Object.keys(directiveClasses).map(k => k.replace("d", "d-").toLowerCase());
            let element: SimpleElement;
            let skipChildren = false;
            let trackerId = tracker ? tracker : "t" + Math.floor(Math.random() * 100000);

            if (!document.body.contains(target)) {
                throw new Error("Attempted to register an element that is not within the DOM.");
            }
            
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
            
            if (!this.trackers.hasOwnProperty(trackerId)) {
                // start a tracker for this registration cascade
                this.trackers[trackerId] = 0;
            } else {
                // if we have one already, subtract a tick
                this.trackers[trackerId] = this.trackers[trackerId] - 1;
            }

            if (target.children.length && (!element || !skipChildren)) {
                // add to the counter so we don't fire the sorter too early
                this.trackers[trackerId] = this.trackers[trackerId] + target.children.length;
                
                // register each child element
                Array.from(target.children).forEach((child: HTMLElement) => this.register(child, scope, trackerId));
            } else if (this.trackers[trackerId] === 0) {
                // when this counter reaches 0, we know we are done with registration
                delete this.trackers[trackerId];
                
                // sd-if (highest in dom) > sd-for (highest in dom) >  sd-if (next highest) > ... > (others)
                this.pointers.sort((pointerA, pointerB) => {
                    const a: any = {
                        dir: (SimpleReference.bubbleUp(pointerA) as SimpleDirective).constructor.toString().split(" ")[1],
                        el: pointerA.scope.element
                    };
                    const b: any = {
                        dir: (SimpleReference.bubbleUp(pointerB) as SimpleDirective).constructor.toString().split(" ")[1],
                        el: pointerB.scope.element
                    };
                    
                    if (a.el === b.el) {
                        a.dir = (SimpleReference.bubbleUp(pointerA) as SimpleDirective).constructor.toString().split(" ")[1];
                        b.dir = (SimpleReference.bubbleUp(pointerB) as SimpleDirective).constructor.toString().split(" ")[1];
                        if (a.dir === "SdIf" && b.dir !== "SdIf") {
                            return -1;
                        } else if (a.dir === "SdFor" && !is(b.dir).in(["SdIf", "SdFor"])) {
                            return -1;
                        }
                    } else if (a.el.contains(b.el)) {
                        return -1;
                    } else if (b.el.contains(a.el)) {
                        return 1;
                    }
                    
                    return 0;
                });
            }
        }

        runner() {
            // run each pointer; if the value has changed, it will run the relevant expression
            this.pointers.forEach((pointer: SimplePointer) => {
                if (pointer.valid) {
                    pointer.run();
                }
            });
            setTimeout(() => this.runner(), 100);
        }

        unregister(target: HTMLElement) {
            // unregister each element that is the target or a child of it
            this.elements = this.elements.map(element => {
                
                // TODO: debug then remove this block
                if (
                    target.parentElement.getAttribute("sd-if") === "isSectionTypeActive:FiftyFifty" &&
                    element.scope.element.getAttribute("sd-if") === "fiftyFifty.shouldShowContentBlockImageUpload"
                ) {
                    // BUG: a directive will sometimes fire past the point at which it should have been unregistered
                    
                    // Observations:
                    // everything seems to be going well until this point, when we try to unregister the element causing the problem (element.scope.element in this block)
                    // the element in the DOM is not always the same as the element we assigned to scope.element, so .contains() doesn't always work as our check
                    // but wait...the elements are unregistered before being registered fresh in SdFor and SdHtml, at which point the scope.element would be the element currently in the DOM
                    // ok this is strange -- it says it's not a child of the target but IS a child of the body a couple times before it says it's not a child of either...
                    
                    // What are the possible causes?
                    // The element that's referenced in the SimpleElement is being replaced in the DOM at some point
                    // The reference to the element in the SimpleElement is being overwritten at some point
                    
                    // What we need to find out:
                    // Which one of the above is happening and at what point it's happening
                    
                    console.log("body contains?", document.body.contains(element.scope.element));
                    console.log("target contains?", target.contains(element.scope.element));
                }
                
                return element.scope.element === target || target.contains(element.scope.element)
                    ? element.unregister()
                    : element;
            });
            removeNulls(this.elements);
        }

        // gives the dev a way to see an element the way the lib sees it
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

            // not used for anything; just makes it clear at a glance whether an element is registered
            element.setAttribute("sd-registered", "true");

            // order is important: sd-if > sd-for > (others) > sd-on
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

            // register each directive on the element
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

            // remove directives from the element
            this.directives.forEach(directive => {
                if (directive instanceof SdOn) {
                    directive.destroy();
                }
                if (directive instanceof SdFor) {
                    this.scope.element.innerHTML = directive.originalHTML;
                }
            });

            // remove pointers from the registry
            this.instance.pointers = this.instance.pointers.map(pointer => {
                const parent = SimpleReference.bubbleUp(pointer) as SimpleDirective;
                if (parent.element === this) {
                    pointer.valid = false;
                    return null;
                } else {
                    return pointer;
                }
            });
            removeNulls(this.instance.pointers);

            return null;
        }
    }

    // not used directly; extensions below
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
                // make sure the appropriate option is selected
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
                    // browsers don't officially bind the attribute and property
                    element.value = "";
                }
            } else {
                element.setAttribute(attribute, value);

                if (attribute === "value") {
                    // browsers don't officially bind the attribute and property
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
            // prevent unnecessary refires for boolean directives (sd-if and sd-class)
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

            // appropriately toggle class
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

            // create an orphan element so we can use it to apply only the necessary differences
            const orphan = document.createElement("div");
            orphan.innerHTML = this.originalHTML.repeat($collection.length);

            // unregister all the current children
            Array.from(children).forEach((child: HTMLElement) => {
                instance.unregister(child);
            });

            // make the dom changes
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

            // register all the new children (reference element.children to grab the new ones)
            Array.from(element.children).forEach((child: HTMLElement, index) => {
                const $index = Math.floor(index / this.originalChildren);

                const scope = Object.assign({}, this.scope);
                scope[this.alias] = Object.assign({ $collection, $index }, $collection[$index]);

                this.handleSdForUniques(child, "sd" + $index);

                instance.register(child, scope);
            });

            // if this is a select, we may need to refresh it to show an accurate value
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
                // add a unique suffix per loop for each given attribute
                attributes.split(",").forEach(attribute => {
                    const current = target.getAttribute(attribute);
                    if (current) {
                        target.setAttribute(attribute, current + suffix);
                    } else {
                        target.setAttribute(attribute, "sdForUnique" + suffix);
                    }
                });
            }

            // crawl through all children
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

            // unregister any current children
            Array.from(element.children).forEach((child: HTMLElement) => instance.unregister(child));
            // switch out the markup
            element.innerHTML = value;
            // register any new children
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
            // prevent unnecessary refires for boolean directives (sd-if and sd-class)
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
                // go back to the original display rule if there was one
                style.display = null;
                // register children (they weren't registered when the if was falsy)
                Array.from(children).forEach((child: HTMLElement) =>
                    instance.register(child, Object.assign({}, this.scope))
                );
            } else {
                style.display = "none";
                // unregister any chidren
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

            // find the radio with the matching value and select it
            // while we're at it, deselect everything else
            radioInputs.forEach((radioInput: HTMLInputElement) => {
                if (radioInput.value === value) {
                    radioInput.checked = true;
                } else {
                    radioInput.checked = false;
                }
            });
        }

        static isFirstRdoOfGroup(instance: SimpleRegistrar, target: HTMLInputElement) {
            return !instance.elements.some(
                ({ scope }) =>
                    scope.element.tagName === "INPUT" &&
                    scope.element.getAttribute("type") === "radio" &&
                    scope.element.getAttribute("name") === target.getAttribute("name")
            );
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

            // make sure we're assigning the right action types
            this.actions = actions.split(",").map(action => {
                if (action === "$update") {
                    // if we can't get one, this will return null and we'll remove it
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

            // run-of-the-mill logic to get the appropriate updater
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

    // not used directly; extensions below
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

            // find the reference to the value we'd like to update
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

            // try to pass the developer a real number if that seems to be what they want
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

            // find the reference to the value we'd like to update
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

            // find the reference to the value we'd like to update
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

                // find the reference to the value we'd like to update
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

            // get dat value
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

        // not the best name.."bubbles up" to return the earliest ancestor
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
        valid: boolean = true;
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
                    // one of the args is undefined; let's try again after the current stack finishes
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
                    // go through and convert all the bracket references to a single dots-only reference
                    while (/\[[^\[\]]*\]/.test(workingBase)) {
                        workingBase = workingBase.replace(/\[([^\[\]]*)\]/g, (_, capture) => {
                            const { obj, key } = this.getObjAndKey(capture, scope);
                            return "." + obj[key];
                        });
                    }

                    // if there were brackets but no dots..there are now dots
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

                    // build up the final obj state one leaf at a time
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

                // if we're dealing in arrays, let's compare them differently
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
                } else if (
                    typeof currentValue !== "undefined" &&
                    currentValue.toString &&
                    currentValue.toString() === "NaN"
                ) {
                    if (this.value && this.value.toString && this.value.toString() === "NaN") {
                        valueChanged = true;
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

                    // in some cases, the reference isn't yet defined at this point
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

    function memoize(fn: Function, refreshRate?: number) {
        const cache: any = {};

        // traditional function style to ensure we get the right `this`
        const memoized = function() {
            const now = Date.now();

            let key: any = Array.from(arguments);
            key.unshift(this);
            key = key
                .map(part => {
                    switch (typeof part) {
                        case "object":
                            if (part === null) {
                                return "null";
                            } else {
                                return JSON.stringify(part);
                            }
                        case "boolean":
                        case "number":
                        case "function":
                            return part.toString();
                        case "string":
                            return part;
                        default:
                            return typeof part;
                    }
                })
                .join("");

            if (!cache.hasOwnProperty(key) || now > cache[key].expires) {
                cache[key] = {
                    value: fn.apply(this, arguments),
                    expires: now + (refreshRate || 1000)
                };
            }

            return cache[key].value;
        };

        return memoized;
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

    simpleDirectives.memoize = memoize;
})(simpleDirectives);
