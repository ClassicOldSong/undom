import {
	toLower,
	splice,
	findWhere,
	createAttributeFilter
} from './util.js'

/*
const NODE_TYPES = {
	ELEMENT_NODE: 1,
	ATTRIBUTE_NODE: 2,
	TEXT_NODE: 3,
	CDATA_SECTION_NODE: 4,
	ENTITY_REFERENCE_NODE: 5,
	PROCESSING_INSTRUCTION_NODE: 7,
	COMMENT_NODE: 8,
	DOCUMENT_NODE: 9
}
*/

function createEnvironment() {

	function isElement(node) {
		return node.nodeType === 1
	}

	class Node {
		constructor(nodeType, nodeName) {
			this.nodeType = nodeType
			this.nodeName = nodeName
			this.childNodes = []
		}
		get nextSibling() {
			let p = this.parentNode
			if (p) return p.childNodes[findWhere(p.childNodes, this, true, true) + 1]
			return null
		}
		get previousSibling() {
			let p = this.parentNode
			if (p) return p.childNodes[findWhere(p.childNodes, this, true, true) - 1]
			return null
		}
		get firstChild() {
			return this.childNodes[0]
		}
		get lastChild() {
			return this.childNodes[this.childNodes.length - 1]
		}
		appendChild(child) {
			this.insertBefore(child)
			return child
		}
		insertBefore(child, ref) {
			if (child.nodeType === 11) {
				const children = Array.from(child.childNodes)

				for (let i of children) {
					this.insertBefore(i, ref)
				}
			} else {
				child.remove()
				child.parentNode = this
				if (ref) splice(this.childNodes, ref, child, true)
				else this.childNodes.push(child)
			}
			return child
		}
		replaceChild(child, ref) {
			if (ref.parentNode === this) {
				this.insertBefore(child, ref)
				ref.remove()
				return ref
			}
		}
		removeChild(child) {
			splice(this.childNodes, child, false, true)
			return child
		}
		remove() {
			if (this.parentNode) this.parentNode.removeChild(this)
		}
	}


	class DocumentFragment extends Node {
		constructor() {
			super(11, '#document-fragment')
		}
		get children() {
			return this.childNodes.filter(isElement)
		}
		get firstElementChild() {
			return this.children[0]
		}
		get lastElementChild() {
			const children = this.children
			return children[children.length - 1]
		}
		get childElementCount() {
			return this.childNodes.length
		}

		append(...children) {
			for (let i of children) {
				this.appendChild(i)
			}
		}
	}


	class CharacterData extends Node {
		get data() {
			return this.__data
		}
		set data(data) {
			this.__data = String(data)
		}
		get length() {
			return this.__data.length
		}

		appendData(data) {
			this.data += data
		}

		// deleteData(offset, count) {
		// 	throw new DOMError('Feature unimplemented')
		// }

		// inserteData(offset, count) {
		// 	throw new DOMError('Feature unimplemented')
		// }

		// replaceData(offset, count, data) {
		// 	throw new DOMError('Feature unimplemented')
		// }

		// substringData(offset, count) {
		// 	throw new DOMError('Feature unimplemented')
		// }
	}


	class Comment extends CharacterData {
		constructor(data) {
			super(8, '#comment')
			this.data = data
		}
		get nodeValue() {
			return this.data
		}
		set nodeValue(data) {
			this.data = data
		}
	}


	class Text extends CharacterData {
		constructor(text) {
			super(3, '#text')					// TEXT_NODE
			this.data = text
		}
		get nodeValue() {
			return this.data
		}
		set nodeValue(data) {
			this.data = data
		}
		get textContent() {
			return this.data
		}
		set textContent(text) {
			this.data = `${text}`
		}
	}


	class Element extends Node {
		constructor(nodeType, nodeName) {
			super(nodeType || 1, nodeName)		// ELEMENT_NODE
			this.attributes = []
			this.__handlers = {}
			this.style = {}
		}

		get className() {
			return this.getAttribute('class')
		}
		set className(val) {
			this.setAttribute('class', val)
		}

		get cssText() {
			return this.getAttribute('style')
		}
		set cssText(val) {
			this.setAttribute('style', val)
		}

		get children() {
			return this.childNodes.filter(isElement)
		}

		append(...children) {
			for (let i of children) {
				this.appendChild(i)
			}
		}

		setAttribute(key, value) {
			this.setAttributeNS(null, key, value)
		}
		getAttribute(key) {
			return this.getAttributeNS(null, key)
		}
		removeAttribute(key) {
			this.removeAttributeNS(null, key)
		}

		setAttributeNS(ns, name, value) {
			let attr = findWhere(this.attributes, createAttributeFilter(ns, name), false, false)
			if (!attr) this.attributes.push(attr = { ns, name })
			attr.value = String(value)
		}
		getAttributeNS(ns, name) {
			let attr = findWhere(this.attributes, createAttributeFilter(ns, name), false, false)
			return attr && attr.value
		}
		removeAttributeNS(ns, name) {
			splice(this.attributes, createAttributeFilter(ns, name), false, false)
		}

		addEventListener(type, handler) {
			(this.__handlers[toLower(type)] || (this.__handlers[toLower(type)] = [])).push(handler)
		}
		removeEventListener(type, handler) {
			splice(this.__handlers[toLower(type)], handler, false, true)
		}
		dispatchEvent(event) {
			let t = event.target = this,
				c = event.cancelable,
				l = null
			do {
				event.currentTarget = t
				l = t.__handlers && t.__handlers[toLower(event.type)]
				if (l) for (let i = l.length - 1; i >= 0; i -= 1) {
					if ((l[i].call(t, event) === false || event._end) && c) {
						event.defaultPrevented = true
					}
				}
			} while (event.bubbles && !event._stop && (t = t.parentNode))
			return l !== null
		}
	}

	class Event {
		constructor(type, opts) {
			this.type = type
			this.bubbles = !!(opts && opts.bubbles)
			this.cancelable = !!(opts && opts.cancelable)
		}
		stopPropagation() {
			this._stop = true
		}
		stopImmediatePropagation() {
			this._end = this._stop = true
		}
		preventDefault() {
			this.defaultPrevented = true
		}
	}


	class Document extends Element {
		constructor() {
			super(9, '#document')			// DOCUMENT_NODE
		}

		createDocumentFragment() {
			return new DocumentFragment()
		}

		createElement(type) {
			return new Element(null, String(type).toUpperCase())
		}

		createElementNS(ns, type) {
			let element = this.createElement(type)
			element.namespace = ns
			return element
		}

		createComment(data) {
			return new Comment(data)
		}

		createTextNode(text) {
			return new Text(text)
		}
	}

	/** Create a minimally viable DOM Document
 *	@returns {Document} document
 */
	function createDocument() {
		const document = new Document()

		document.defaultView = {
			document,
			Document,
			Node,
			Text,
			Comment,
			Element,
			SVGElement: Element,
			DocumentFragment,
			Event
		}

		document.documentElement = document.createElement('html')
		document.head = document.createElement('head')
		document.body = document.createElement('body')

		document.documentElement.appendChild(document.head)
		document.documentElement.appendChild(document.body)

		return document
	}

	createDocument.env = createEnvironment
	return createDocument
}

export default createEnvironment()
