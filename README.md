# A Simple Directives Library

Place in `<head>` with `defer` or at the bottom of `<body>`:

    <script src="directives.js"></script>

`reference` below can be a reference to a function, string, or number using object dot and bracket notation.

## Add Event Listeners

    <element sd-on="eventName:reference" />
    <element sd-on="event1:reference1;event2:reference2;...">

Available on `this` within the function:

-   `element`
-   `event`

`reference` here should be a function to run when the event is triggered on the element.

## Bind Contents

    <element sd-html="reference" />

Available on `this` within the function:

-   `element`

`reference` here should evaluate to valid HTML with all opened tags closed.

## Bind Attributes

    <element sd-attr="attribute:reference" />
    <element sd-attr="attribute1:reference1;attribute2:reference2;...">

Available on `this` within the function:

-   `attributeName`
-   `element`

`reference` here should evaluate to a valid value for the given attribute.

If `reference` evaluates to `undefined`, the attribute will be removed from the element if it exists.

## Toggle Classes

    <element sd-class="class:reference" />
    <element sd-class="class1:reference1;class2:reference2;...">

Available on `this` within the function:

-   `className`
-   `element`

If `reference` evaluates truthy, the given class will exist in the element's classList.

## Create A Bound Loop

    <element sd-for="item:reference" />

Available on `this` within the function:

-   `element`
-   `itemName`

`reference` here should evaluate to an array or object.

The contents of the element will be repeated once for each item.

`index`, `key`, `item`, `value` and `collection` will be available at `(itemName)` in references and on `this` in functions within.

## Add A Condition

    <element sd-if="reference" />

Available on `this` within the function:

-   `element`

If `reference` evaluates falsy, the element will be hidden and any bindings within will be paused.

## Add Arguments To A Function Reference

    <element sd-on="event:reference:arg1:arg2:...">
    <element sd-on="event1:reference1:arg1:arg2:...;event2,event3:reference2:;...">
    <element sd-html="reference:arg1:arg2:...">
    <element sd-attr="attribute:reference:arg1:arg2:...">
    <element sd-attr="attribute1:reference1:arg1:arg2:...;attribute2:reference2;...">
    <element sd-class="class:reference:arg1:arg2:...">
    <element sd-class="class1:reference1:arg1:arg2:...;class2,class3:!reference2;...">
    <element sd-for="item:reference:arg1:arg2:...">
    <element sd-if="reference:arg1:arg2:...">

## Available In Script

    directives.baseReference = object;
    directives.refreshRate = milliseconds;
    directives.register(parentElement);
    directives.unregister(parentElement);
