# A Simple Directives Library

```html
<script src="directives.min.js"></script>
```

## Directives

### Conditionals with `sd-if`

```html
<element sd-if="reference" />
```

If `reference` is a function, `this.element` will be available inside.

If `reference` evaluates falsy, the element will be hidden and any bindings within will be paused.

### Content Binds with `sd-html`

```html
<element sd-html="reference" />
```

If `reference` is a function, `this.element` will be available inside.

`reference` should evaluate to plain text or a valid HTML fragment.

### Attribute Binds with `sd-attr`

```html
<element sd-attr="attribute:reference" />

<!-- allows for multiple attribute:reference sets -->
<element sd-attr="attribute1:reference1;attribute2:reference2;..." />
```

If `reference` is a function, `this.element` and `this.attributeName` will be available inside.

`reference` should evaluate to a valid value for the given attribute.

If `reference` evaluates to `undefined`, the attribute will be removed from the element if it exists.

### Class Toggles with `sd-class`

```html
<element sd-class="class:reference" />

<!-- allows for multiple class:reference sets -->
<element sd-class="class1:reference1;class2:reference2;..." />

<!-- allows for multiple classes to one reference -->
<element sd-class="class1,class2:reference1" />
```

If `reference` is a function, `this.element` and `this.className` will be available inside.

If `reference` evaluates truthy, the given class will exist in the element's classList.

### Loops with `sd-for`

```html
<element sd-for="item:reference" />
```

If `reference` is a function, `this.element` and `this.itemName` will be available inside.

`reference` should evaluate to an array or object.

The contents of the element will be repeated once for each item.

References made within the loop will also have `this[itemName]` available.

If the item is an object, `this[itemName]` will be populated with the item itself, plus:

-   `$collection`
-   `$index`
-   `$key`

If the item is not an object, `this[itemName]` will be empty except for the properties above, plus `value`.

### Event Listeners with `sd-on`

```html
<element sd-on="eventName:reference" />

<!-- allows for multiple event:reference sets -->
<element sd-on="event1:reference1;event2:reference2;..." />

<!-- allows for multpile events for a single reference -->
<element sd-on="event1,event2:reference1" />

<!-- allows for multiple references for a single event -->
<element sd-on="event:reference1,reference2" />

<!-- example: both events to fire both functions -->
<element sd-on="event1,event2:reference1,reference2" />
```

`reference` should be a function to run when the event is triggered on the element.

`this.element` and `this.event` will be available inside the function.

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

### Two-Way Binding with `$update`

```html
<!-- examples -->
<input type="text" sd-attr="value:reference" sd-on="keyup:$update" />
<input type="checkbox" sd-attr="checked:reference" sd-on="change:$update" />
<textarea sd-attr="value:reference" sd-on="keydown:$update"></textarea>
<select sd-attr="value:reference" sd-on="change:$update"></select>
<div contenteditable="true" sd-html="reference" sd-on="keyup:$update"></div>
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
