# A Simple Directives Library

```html
<script src="directives.min.js"></script>
```

Usage:

```html
<element directive="expression">
```

`directive` should be one of the directives below; `expression` is different depending on the directive.

## The Directives

### `sd-attr` binds attributes

`expression` should be an attribute name or multiple comma-separated attribute names followed by a colon, then one of...

-   a single reference to a variable that contains or a function that returns a value
-   a comparison of two references, both of which can be a variable that contains or a function that returns a value

If the reference is a function, `this.element` and `this.attributeName` will be available within. If the reference evaluates to `undefined`, the attribute will be removed from the element if it exists. `expression` can contain multiple semicolon-separated expressions.

### `sd-class` toggles classes

`expression` should be a class name or multiple comma-separated class names followed by a colon, then one of...

-   a single reference to a variable that contains or a function that returns a value
-   a comparison of two references, both of which can be a variable that contains or a function that returns a value

If the reference is a function, `this.element` and `this.className` will be available within. If the reference evaluates truthy, the target class(es) will exist on the element. `expression` can contain multiple semicolon-separated expressions.

### `sd-for` loops innerHTML

`expression` should be an alias, `itemName`, you would like to assign to each item in the collection followed by a colon and a single reference to a variable that contains or a function that returns an iterable object. If the reference is a function, `this.element` and `this.itemName` will be available within. The contents of the element will be repeated once for each item in the collection. Expressions on directives within the loop will have `this[itemName]` available in addition to any other data on `this` that would normally exist with those directives. `this[itemName]` will contain `$collection`, `$index`, and `$key`. If the item is an object, all the properties of the object will also exist on `this[itemName]`; otherwise, the item will be accessible at `this[itemName].value` instead.

### `sd-html` binds innerHTML

`expression` should be a single reference to a variable that contains or a function that returns a string of plain text or a valid HTML fragment. If the reference is a function, `this.element` will be available within.

### `sd-if` sets conditions

`expression` should be one of...
-   a single reference to a variable that contains or a function that returns a value
-   a comparison of two references, both of which can be a variable that contains or a function that returns a value

If the reference is a function, `this.element` will be available within. If the reference evaluates falsy, the element will be hidden and any bindings within will be paused.

### `sd-on` sets event listeners

`expression` should be an event name or multiple comma-separated event names followed by a colon and one of...
-   a reference to a function
-   multiple comma-separated references to functions
-   a simple variable value assignment expression (`assignable = something`)

...that you want called when the event(s) fire(s) on the element. Any referenced functions will have `this.element` and `this.event` available within. Only include one `sd-on` per radio button group (listeners will be assigned to all radio buttons in the group). `expression` can contain multiple semicolon-separated expressions.

### `sd-rdo` binds radio groups

`expression` should be a single reference to a variable that contains or a function that returns a string. If the reference is a function, `this.element` will be available within. If the reference evaluates to one of the radio group values, the associated radio button will be selected; otherwise, none of the radio buttons will be selected. A name and value must exist on each radio button in the group. If `sd-rdo` exists on more than one radio button of the same group, only the first one will register.

## Extras

### Function Reference Arguments

```html
<element sd-on="event:reference:arg" />

<!-- allows for multiple arguments -->
<element sd-on="event:reference:arg1:arg2" />
```

Argument will be ignored if the reference is not a function.

If the argument is a reference to a defined variable, the function will receive the variable itself.

If the argument is not a valid reference, it will be passed to the function as a string.

If you intend to pass a string as the argument, don't place quotes around it.

Arguments may not include the `:`, `;`, or `,` characters.

### Two-Way Bindings with \$update

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

### Available To Your Custom Scripts

```javascript
directives.baseReference = object;
directives.refreshRate = milliseconds;

// refresh the node tree for `parentElement` and all children
directives.register(parentElement);

// kill simple-directives for `parentElement` and all children
directives.unregister(parentElement);
```
