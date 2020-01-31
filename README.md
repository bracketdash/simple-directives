# A Simple Directives Library

Download: [directives.js](https://raw.githubusercontent.com/bracketdash/simple-directives/master/directives.js) (34k) or [directives.min.js](https://raw.githubusercontent.com/bracketdash/simple-directives/master/directives.min.js) (12k)

```html
<!-- basic syntax -->
<element sd-directive="expression" />

<!-- multiple expressions are allowed on `sd-attr`, `sd-class`, and `sd-on` -->
<element sd-class="class:reference;class:reference;..." />

<script src="directives.min.js"></script>
<script>
    // place where you want, but after the dom has finished loading
    var app = simpleDirectives.register(element, root);

    // if you want to inspect an element how simple-directives sees it
    var simpleElement = app.getSimpleElement(element);
    
    // memoizing is recommended for expensive bind functions
    var myFunction = simpleDirectives.memoize(function() { /* expensive logic */ }, refreshRate);
</script>
```

Directives on `element` and all children will be registered and start working.

`element` and `root` are optional and default to `document.body` and `window`.

`refreshRate` is optinoal on memoized functions and will default to 1000ms.

Notes on vocabulary:

-   "Expression" refers to a custom syntax that's slightly different from JavaScript expressions.
-   "Reference" refers to a JavaScript variable, function, comparison, or assignment.
    -   In most cases, references should evaluate to a primitive type.
    -   Don't add parentheses to function references.
-   "Reference scope" refers to data available in references in addition to the root.
    -   References to this data can be made as though it is at the root of the base reference.
    -   If the reference calls a function, that function will also have the scope available on `this`.

## Data Bindings

### `html` controls contents

`sd-html="reference"`

Reference Scope:

-   `element`

The reference should evaluate to plain text or a valid HTML fragment.

### `class` toggles classes

`sd-class="class:reference"`

`sd-class="class,class,..:reference;class:reference < reference;.."`

Reference Scope:

-   `element`
-   `classNames`

Truthy: The element will have the given class(es).

### `attr` controls attributes

`sd-attr="attribute:reference"`

`sd-attr="attribute:reference;attribute:reference;.."`

Reference Scope:

-   `element`
-   `attributeName`

Truthy: The given attribute's value will be that of the reference.

Falsy: The given attribute will not be present on the element.

### `rdo` controls radio groups

`sd-rdo="reference"`

Reference Scope:

-   `element`

The reference should evaluate to a string or number.

Only the first `sd-rdo` of each radio group will be registered.

## Looping Templates

### `for` loops contents over a collection

`sd-for="item:reference"`

"Item" should be the alias to assign to each item.

-   The aliased item will be in the scope of each reference inside the loop.
-   The item will also have `$collection` and `$index` available.

> Use unique item names in nested loops to avoid overwrites.

Reference Scope:

-   `element`
-   `itemName`

The reference should evaluate to an array of objects.

Optionally have `sd-for` assign unique suffixes to an attribute value each loop with `sd-for-unique`.

`<element attr1="value1" attr2="value2" sd-for-unique="attr1,attr2">`

## Conditionals

### `if` toggles the element

`sd-if="reference"`

`sd-if="reference === reference"`

Reference Scope:

-   `element`

Falsy: The element will be hidden; bindings within paused.

## User Interaction

### `on` adds event listeners

`sd-on="event:function;event:assignableReference = reference"`

`sd-on="event,event,..:function,function,..;event:function;.."`

Reference Scope:

-   `element`
-   `eventNames`
-   `event` (only available when event fires)

All events will be assigned all references in each expression.

### Two-Way Binding Shortcut

`sd-on="event:$update"`

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

## Function Arguments

Examples:

`sd-class="class:reference:arg"`

`sd-on="event:reference:arg1:arg2:..."`

Each argument can be treated as a reference except that functions will be passed as-is.

If an argument is not a valid reference, it will be passed as a string.

If you intend to pass a string as an argument, don't place quotes around it.

Arguments may not include the `:`, `;`, or `,` characters.
