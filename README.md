# undom

[![NPM](https://img.shields.io/npm/v/@utls/undom-ef.svg?style=flat)](https://www.npmjs.org/package/@utls/undom-ef)

### **Minimally viable DOM Document implementation for ef.js**

**NOTE** THIS IS A FORK SPECIALLY FOR [ef.js](https://github.com/TheNeuronProject/ef.js) WITH SOME MINOR CHANGES THAT MIGHT NOT FIT THE GOAL OF THE [ORIGINAL PROJECT](https://github.com/developit/undom).

> A bare-bones HTML DOM in a box. If you want the DOM but not a parser, this might be for you.
>
> `1kB`, works in Node and browsers, plugins coming soon!


[**JSFiddle Demo:**](https://jsfiddle.net/developit/4qv3v6r3/) Rendering [preact](https://github.com/developit/preact/) components into an undom Document.

[![preview](https://i.gyazo.com/7fcca9dd3e562b076293ef2cf3979d23.gif)](https://jsfiddle.net/developit/4qv3v6r3/)

---


## Project Goals

Undom aims to find a sweet spot between size/performance and utility. The goal is to provide the simplest possible implementation of a DOM Document, such that libraries relying on the DOM can run in places where there isn't one available.

The intent to keep things as simple as possible means undom lacks some DOM features like HTML parsing & serialization, Web Components, etc. These features can be added through additional libraries.


---


## Installation

Via npm:

`npm install @utls/undom-ef`


---


## Usage

```js
import {geDOMImpl} from '@utls/undom-ef'

const {document} = getDOMImpl()

let foo = document.createElement('foo')
foo.appendChild(document.createTextNode('Hello, World!'))
document.body.appendChild(foo);
```

with ef.js

```js
import {getDOMImpl} from '@utls/undom-ef'
import {setDOMImpl} from 'ef.js'
import Tpl from 'tpl.eft'

const domImpl = getDOMImpl()

setDOMImpl(domImpl)

const tpl = new Tpl()

tpl.$mount({target: domImpl.document.body})
```

---


## Serialize to HTML

```js
import {serialize} from '@utls/undom-ef'

console.log(serialize(element))
```
