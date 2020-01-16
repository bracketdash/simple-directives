# A Simple Directives Library

    <script src="directives.min.js"></script>

## Directives

### Conditionals with `sd-if`

    <element sd-if="reference" />

Available on `this` within the function:

-   `element`

If `reference` evaluates falsy, the element will be hidden and any bindings within will be paused.

### Event Listeners with `sd-on`

    <element sd-on="eventName:reference" />
    <element sd-on="event1:reference1;event2:reference2;...">

Available on `this` within the function:

-   `element`
-   `event`

`reference` here should be a function to run when the event is triggered on the element.

### Content Binds with `sd-html`

    <element sd-html="reference" />

Available on `this` within the function:

-   `element`

`reference` here should evaluate to valid HTML with all opened tags closed.

### Attribute Binds with `sd-attr`

    <element sd-attr="attribute:reference" />
    <element sd-attr="attribute1:reference1;attribute2:reference2;...">

Available on `this` within the function:

-   `attributeName`
-   `element`

`reference` here should evaluate to a valid value for the given attribute.

If `reference` evaluates to `undefined`, the attribute will be removed from the element if it exists.

### Class Toggles with `sd-class`

    <element sd-class="class:reference" />
    <element sd-class="class1:reference1;class2:reference2;...">

Available on `this` within the function:

-   `className`
-   `element`

If `reference` evaluates truthy, the given class will exist in the element's classList.

### Loops with `sd-for`

    <element sd-for="item:reference" />

Available on `this` within the function:

-   `element`
-   `itemName`

`reference` here should evaluate to an array or object.

The contents of the element will be repeated once for each item.

References made within the loop will also have `this.(itemName)` available.

`this.(itemName)` will be populated with the item itself, as well as...

-   `$collection`
-   `$index`
-   `$key`

## Extras

### Function Reference Arguments

    <element sd-on="event:reference:arg">
    <element sd-attr="attribute1:reference1:arg1:arg2:...;attribute2:reference2;...">

If the argument is a reference to a defined variable, the function will receive the variable itself.

If the argument is not a valid reference, it will be passed to the function as a string.

If you intend to pass a string as the argument, don't place quotes around it.

Arguments may not include the `:`, `;`, or `,` characters.

### Two-Way Binding with `$update`

    <input type="text" sd-attr="value:reference" sd-on="keyup:$update">
    <input type="checkbox" sd-attr="checked:reference" sd-on="change:$update">
    <textarea sd-attr="value:reference" sd-on="keydown:$update">
    <select sd-attr="value:reference" sd-on="change:$update">
    <div contenteditable="true" sd-html="reference" sd-on="keyup:$update">

### Accessible Scope

    directives.baseReference = object;
    directives.refreshRate = milliseconds;
    directives.register(parentElement);
    directives.unregister(parentElement);
