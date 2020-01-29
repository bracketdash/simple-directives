const simpleDirectives = {};
(function(simpleDirectives) {
    class SimpleRegistrar {
        constructor(element, root) {
            this.elements = [];
            this.pointers = [];
            this.root = root ? root : window;
            this.register(element ? element : document.body);
            this.runner();
        }
        register(target, scope) {
            const directiveNames = Object.keys(directiveClasses).map(k => k.replace("d", "d-").toLowerCase());
            let element;
            let skipChildren = false;
            if (target.hasAttributes()) {
                let directives = Array.from(target.attributes).map(({ name, value }) => {
                    const isNotDupeRdo = name !== "sd-rdo" || SdRdo.isFirstRdoOfGroup(this, target);
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
                Array.from(target.children).forEach(child => this.register(child, scope));
            }
        }
        runner() {
            this.pointers.forEach(pointer => pointer.run());
            setTimeout(() => this.runner(), 200);
        }
        unregister(target) {
            this.elements = this.elements.map(element => {
                const { scope, unregister } = element;
                return scope.element === target || target.contains(scope.element) ? unregister() : element;
            });
            removeNulls(this.elements);
        }
        getSimpleElement(target) {
            let simpleElements = [];
            this.elements.forEach(element => {
                if (element.scope.element === target) {
                    simpleElements.push(element);
                }
            });
            return simpleElements;
        }
    }
    class SimpleElement {
        constructor(instance, element, directives, scope) {
            this.directives = [];
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
                const parent = SimpleReference.bubbleUp(pointer);
                return parent.element === this ? null : pointer;
            });
            removeNulls(this.instance.pointers);
            return null;
        }
    }
    class SimpleDirective {
        constructor(element, expression) {
            Object.assign(this, { element, expression, scope: element.scope });
        }
        static getDirective(element, name, expression) {
            const className = "Sd" + name.substring(3, 4).toUpperCase() + name.substring(4);
            return new directiveClasses[className](element, expression);
        }
    }
    class SdAttr extends SimpleDirective {
        constructor(element, expression) {
            super(element, expression);
            const [attribute, reference] = splitFirstPart(expression);
            this.attribute = attribute;
            this.scope.attributeName = attribute;
            this.reference = SimpleReference.getReference(this, reference);
        }
        run(value) {
            const attribute = this.attribute;
            const element = this.scope.element;
            if (attribute === "value" && element.tagName === "SELECT") {
                Array.from(element.getElementsByTagName("option")).forEach(optionElement => {
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
        constructor(element, expression) {
            super(element, expression);
            this.cachedState = 2;
            const [classes, reference] = splitFirstPart(expression);
            this.classes = classes.split(",");
            this.scope.classNames = this.classes;
            this.reference = SimpleReference.getReference(this, reference);
        }
        run(value) {
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
        constructor(element, expression) {
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
        run($collection) {
            if (!$collection) {
                return;
            }
            const { instance, directives } = this.element;
            const { appendChild, children, lastChild, removeChild, tagName } = this.scope.element;
            const orphan = document.createElement("div");
            orphan.innerHTML = this.originalHTML.repeat($collection.length);
            Array.from(children).forEach(child => {
                instance.unregister(child);
            });
            if (children.length > orphan.children.length) {
                Array.from(Array(children.length - orphan.children.length)).forEach(() => {
                    removeChild(lastChild);
                });
            } else if (children.length < orphan.children.length) {
                const childrenToAdd = Array.from(orphan.children).slice(children.length);
                childrenToAdd.forEach(child => {
                    appendChild(child);
                });
            }
            Array.from(children).forEach((child, index) => {
                const $index = Math.floor(index / this.originalChildren);
                const scope = Object.assign({}, this.scope);
                scope[this.alias] = Object.assign({ $collection, $index }, $collection[$index]);
                instance.register(child, scope);
            });
            if (tagName === "SELECT") {
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
        constructor(element, expression) {
            super(element, expression);
            this.reference = SimpleReference.getReference(this, expression);
        }
        run(value) {
            const instance = this.element.instance;
            const element = this.scope.element;
            Array.from(element.children).forEach(child => instance.unregister(child));
            element.innerHTML = value;
            Array.from(element.children).forEach(child => instance.register(child, this.scope));
        }
    }
    class SdIf extends SimpleDirective {
        constructor(element, expression) {
            super(element, expression);
            this.cachedState = 2;
            this.reference = SimpleReference.getReference(this, expression);
        }
        run(value) {
            if (this.cachedState === 2) {
                this.cachedState = value ? 1 : 0;
            } else if (value && this.cachedState === 0) {
                this.cachedState = 1;
            } else if (!value && this.cachedState === 1) {
                this.cachedState = 0;
            } else {
                return;
            }
            const { register, unregister } = this.element.instance;
            const { style, children } = this.scope.element;
            if (value) {
                style.display = null;
                Array.from(children).forEach(child => register(child, Object.assign({}, this.scope)));
            } else {
                style.display = "none";
                Array.from(children).forEach(child => unregister(child));
            }
        }
    }
    class SdRdo extends SimpleDirective {
        constructor(element, expression) {
            super(element, expression);
            this.reference = SimpleReference.getReference(this, expression);
        }
        run(value) {
            const groupName = this.scope.element.getAttribute("name");
            const radioInputs = Array.from(document.getElementsByName(groupName));
            radioInputs.forEach(radioInput => {
                if (radioInput.value === value) {
                    radioInput.checked = true;
                } else {
                    radioInput.checked = false;
                }
            });
        }
        static isFirstRdoOfGroup(instance, target) {
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
        constructor(element, expression) {
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
        getUpdater() {
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
        constructor(directive) {
            this.directive = directive;
            this.scope = directive.scope;
        }
    }
    class SimpleCaller extends SimpleAction {
        constructor(directive, action) {
            super(directive);
            this.callee = SimpleReference.getReference(this, action);
        }
        run(event) {
            const callee = this.callee.obj[this.callee.key];
            const args = this.callee.args.map(arg => {
                return arg.bang ? !arg.obj[arg.key] : arg.obj[arg.key];
            });
            callee.apply(Object.assign({ event: event }, this.scope), args);
        }
    }
    class SimpleAssigner extends SimpleAction {
        constructor(directive, action) {
            super(directive);
            const parts = action.split("=");
            this.left = SimpleReference.getReference(this, parts[0]);
            this.right = SimpleReference.getReference(this, parts[1]);
        }
        run() {
            const right = this.right.get();
            this.left.obj[this.left.key] = right;
        }
    }
    class SimpleUpdater extends SimpleAction {}
    class ValueUpdater extends SimpleUpdater {
        constructor(directive) {
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
            const value = this.scope.element.value;
            if (typeof this.updatee.obj[this.updatee.key] === "number" && !isNaN(Number(value))) {
                this.updatee.obj[this.updatee.key] = Number(value);
            } else {
                this.updatee.obj[this.updatee.key] = value;
            }
        }
    }
    class CheckedUpdater extends SimpleUpdater {
        constructor(directive) {
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
            const element = this.scope.element;
            this.updatee.obj[this.updatee.key] = element.checked;
        }
    }
    class ContentEditableUpdater extends SimpleUpdater {
        constructor(directive) {
            super(directive);
            this.directive.element.directives.some(directive => {
                if (directive instanceof SdHtml && directive.reference instanceof SimplePointer) {
                    this.updatee = directive.reference;
                    return true;
                }
            });
        }
        run() {
            const { innerHTML } = this.scope.element;
            this.updatee.obj[this.updatee.key] = innerHTML;
        }
    }
    class RadioUpdater extends SimpleUpdater {
        constructor(directive) {
            super(directive);
            this.directive.element.directives.some(directive => {
                if (directive instanceof SdHtml && directive.reference instanceof SimplePointer) {
                    this.updatee = directive.reference;
                    return true;
                }
            });
        }
        run() {
            const groupName = this.scope.element.getAttribute("name");
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
    class SimpleReference {
        constructor(parent) {
            this.parent = parent;
            this.scope = parent.scope;
        }
        static bubbleUp(reference) {
            let parent = reference;
            while (parent instanceof SimpleReference) {
                parent = parent.parent;
            }
            return parent;
        }
        static getReference(parent, reference, isArg) {
            if (/[=<!>]/.test(reference.substring(1))) {
                return new SimpleComparison(parent, reference, isArg);
            } else {
                return new SimplePointer(parent, reference, isArg);
            }
        }
    }
    class SimpleComparison extends SimpleReference {
        constructor(parent, comparison, isArg) {
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
        constructor(parent, pointer, isArg) {
            super(parent);
            this.args = [];
            this.bang = false;
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
            let objAndKey = this.maybeGetObjAndKey(this.base, this.scope);
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
            let value = this.obj[this.key];
            if (typeof value === "function") {
                const args = this.args.map(arg => {
                    return arg.bang ? !arg.obj[arg.key] : arg.obj[arg.key];
                });
                value = value.apply(this.scope, args);
            }
            return this.bang ? !value : value;
        }
        maybeGetObjAndKey(base, scope) {
            const fallback = { nah: true };
            const hasBrackets = is("[").in(base);
            let hasDots = is(".").in(base);
            let obj;
            if (scope) {
                obj = scope;
            } else {
                let root = SimpleReference.bubbleUp(this);
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
                    return typeof key === "string" ? { obj, key } : fallback;
                }
            }
        }
        run(skipDiffCheck) {
            let currentValue = this.get();
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
                const { reference, run } = SimpleReference.bubbleUp(this);
                this.value = currentValue;
                try {
                    run(reference.get());
                } catch (e) {
                    setTimeout(() => run(reference.get()));
                }
            }
        }
    }
    function is(target) {
        return {
            in: str => str.indexOf(target) !== -1,
            oneOf: arr => arr.some(item => item === target)
        };
    }
    function removeNulls(arr) {
        let index;
        while ((index = arr.indexOf(null)) !== -1) {
            arr.splice(index, 1);
        }
    }
    function splitFirstPart(expression) {
        const parts = expression.split(":");
        const firstPart = parts.shift();
        const theRest = parts.join(":");
        return [firstPart, theRest];
    }
    const directiveClasses = { SdAttr, SdClass, SdFor, SdHtml, SdIf, SdRdo, SdOn };
    simpleDirectives.register = (element, root) => new SimpleRegistrar(element, root);
})(simpleDirectives);
