# WIP: A Simple Directives Library

```html
<script src="directives.min.js"></script>
```

Usage:

```html
<element directive="expression" />
```

Multiple expressions allowed on `sd-attr`, `sd-class`, and `sd-on`:

```html
<element directive="expression;expression;..." />
```

Notes on vocabulary:

-   "Expression" refers to a custom syntax different from normal JavaScript expressions.
-   "Argument" sometimes refers to a section of an expression as separated by a colon.
-   "Reference" is a dot-and-bracket JSON reference (on `window` by default).
    -   If the reference is a function, it will be evaluated without the use of parentheses.
    -   You may assign `directives.baseReference` to an object of your choice.
-   "Reference Scope" refers to additional data available to the reference.
    -   References to this data can be made as though it is at the root of the base reference.
    -   If the reference is a function, the function will have the reference scope available on `this`.

## The Directives

### `attr` Bind Attributes

`sd-attr="attribute:reference"`

Multiple semicolon-separated expressions are allowed.

Reference Scope:

-   `element`
-   `attributeName`

Truthy: The given attribute's value will be that of the reference.

Falsy: The given attribute will not be present on the element.

### `class` Toggle Classes

`sd-class="class:reference"`

Multiple semicolon-separated expressions are allowed.

Multiple comma-separated classes are allowed.

Reference Scope:

-   `element`
-   `className`

The reference can be a comparison of two references.

Truthy: The element will have the given class(es).

### `for` Loop Contents Over Data

`sd-for="item:reference"`

"Item" should be the alias you would like to assign to each item in the collection.

-   The item will be added under the alias name to each Reference Scope inside the loop.
-   The item will also have these helpful properties added:
    -   `$collection`
    -   `$index`
    -   `$key`

> Use unique item names in nested loops lest existing aliases be overwritten.

Reference Scope:

-   `element`
-   `itemName`

The reference should evaluate to an array of objects.

### `html` Bind Contents

`sd-html="reference"`

Reference Scope:

-   `element`

The reference should evaluate to plain text or a valid HTML fragment.

### `if` Set Conditions

`sd-if="expression"`

Reference Scope:

-   `element`

The reference can be a comparison of two references.

Falsy: The element will be hidden and any bindings within will be paused.

### `on` Set Event Listeners

`sd-on="event:reference"`

Multiple semicolon-separated expressions are allowed.

Multiple comma-separated events are allowed.

Multiple comma-separated references are allowed.

Reference Scope:

-   `element`
-   `event`

The reference should be a function or `assignableReference = referenceOrStringWithoutQuotes`.

All events will be assigned all references in each expression.

Only include one `sd-on` per radio button group (listeners will be assigned to all radio buttons in the group).

#### Two-Way Binding Shortcut

`sd-on:event:$update`

```html
<!-- examples -->
<input type="text" sd-attr="value:reference" sd-on="change,keyup:$update" />
<input type="checkbox" sd-attr="checked:reference" sd-on="change:$update" />
<input type="radio" name="name" value="value" sd-rdo="reference" sd-on="change:$update" />
<textarea sd-attr="value:reference" sd-on="keydown:$update"></textarea>
<select sd-attr="value:reference" sd-on="change:$update"></select>
<div contenteditable="true" sd-html="reference" sd-on="keyup:$update"></div>

<!-- example using $update as one of multiple references -->
<input type="text" sd-attr="value:reference" sd-on="change:$update,reference" />
<input type="text" sd-attr="value:reference" sd-on="change:reference,$update,..." />
```

### `rdo` Bind Radio Groups

`sd-rdo="reference"`

Reference Scope:

-   `element`

The reference should evaluate to a string or number.

Only add `sd-rdo` to `<input type="radio">` elements with populated `name` and `value` attributes.

Only add one `sd-rdo` per radio group.

## Extras

### Function Arguments

Examples:

`sd-class="class:reference:arg"`

`sd-on="event:reference:arg1:arg2:..."`

If the argument is a reference to a defined variable, the function will receive the variable itself.

If the argument is not a valid reference, it will be passed to the function as a string.

If you intend to pass a string as the argument, don't place quotes around it.

Arguments may not include the `:`, `;`, or `,` characters.

### Registry Controls

Synchronously with directives.js, next in load order: `directives.skipInit()`

`directives.register(parentElement)`

`directives.unregister(parentElement)`

### Config

`directives.baseReference` can be assigned to another object. It defaults to `window`.

`directives.refreshRate` can be assigned a number of milliseconds.
