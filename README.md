# A Simple Directives Library

Place in `<head>` with `defer` or at the bottom of `<body>`:

    <script src="directives.js"></script>

## Register An Event Listener

    <element gt-on:eventName="functionName" />

Available on `this` within the function:

-   `element`
-   `event`

## Bind Contents

    <element gt-html="functionName" />

Function should return valid HTML.

Available on `this` within the function:

-   `element`

## Bind Attributes

    <element gt-attr:attribute="functionName" />

Function should return a valid value for the given attribute.

Available on `this` within the function:

-   `attributeName`
-   `element`

## Toggle Classes

    <element gt-class:class="functionName" />

Available on `this` within the function:

-   `className`
-   `element`

## Create A Bound Loop

    <element gt-for:itemName="functionName" />

Available on `this` within the function:

-   `element`
-   `itemName`

The contents of the element will be repeated once for each item.

Available on `this` within functions referenced within the loop if looping over an `array`:

-   `[itemName].index`
-   `[itemName].item`

Available on `this` within functions referenced within the loop if looping over an `object`:

-   `[itemName].key`
-   `[itemName].value`

## Control Flow

    <element gt-if="functionName" />

Available on `this` within the function:

-   `element`

If the function returns falsy, the element will be hidden and any bindings within will be paused.

## Set The Refresh Rate

    <element gt-refresh="milliseconds" />

If set, any bindings on the element will only refresh every `milliseconds` milliseconds.

This won't do anything for `gt-on` since there's nothing to refresh.
