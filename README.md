# A Simple Directives Library

Place in `<head>` with `defer` or at the bottom of `<body>`:

    <script src="directives.js"></script>

> `functionRef` below accepts simple object dot and bracket notation but won't evaluate expressions.

## Register An Event Listener

    <element sd-on:eventName="functionRef" />

Available on `this` within the function:

-   `element`
-   `event`

## Bind Contents

    <element sd-html="functionRef" />

Available on `this` within the function:

-   `element`

Function should return valid HTML with all opened tags closed.

## Bind Attributes

    <element sd-attr:attribute="functionRef" />

Available on `this` within the function:

-   `attributeName`
-   `element`

Function should return a valid value for the given attribute.

If the function returns `undefined`, the attribute will be removed from the element if it exists.

## Toggle Classes

    <element sd-class:class="functionRef" />

Available on `this` within the function:

-   `className`
-   `element`

The given class will exist in the element's classList as long as the function returns truthy.

## Create A Bound Loop

    <element sd-for:item="functionRef" />

Available on `this` within the function:

-   `element`
-   `itemName`

The function should return an array or object.

The contents of the element will be repeated once for each item.

Available on `this` within functions referenced within the loop if looping over an `array`:

-   `[item].index`
-   `[item].item`

Available on `this` within functions referenced within the loop if looping over an `object`:

-   `[item].index`
-   `[item].key`
-   `[item].value`

## Add Conditions

    <element sd-if="functionRef" />

Available on `this` within the function:

-   `element`

If the function returns falsy, the element will be hidden and any bindings within will be paused.

## Set The Refresh Rate

    <element sd-refresh="milliseconds" />

If set, any bindings on the element will only refresh every `milliseconds` milliseconds.

This won't do anything for `sd-on` since there's nothing to refresh.
