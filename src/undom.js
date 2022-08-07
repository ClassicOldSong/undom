import {
	toLower,
	splice,
	findWhere,
	createAttributeFilter,
	named
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

class Event {
	constructor(type, {bubbles, cancelable} = {}) {
		this.initEvent(type, bubbles, cancelable)
	}
	initEvent(type, bubbles, cancelable) {
		this.type = type
		this.bubbles = !!bubbles
		this.cancelable = !!cancelable
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

function createEnvironment({
	silent,
	createBasicElements = true,
	scope = {},
	onGetData,
	onSetData,
	onCreateNode,
	onInsertBefore,
	onRemoveChild,
	onSetAttributeNS,
	onGetAttributeNS,
	onRemoveAttributeNS,
	onAddEventListener,
	onRemoveEventListener
} = {}) {

	function isElement(node) {
		return node.nodeType === 1
	}

	const makeNode = named(
		'__undom_isNode',
		(_ = Object) => class Node extends _ {
			constructor(nodeType, nodeName) {
				super()

				this.nodeType = nodeType
				this.nodeName = String(nodeName).toUpperCase()
				this.childNodes = []

				if (onCreateNode) {
					onCreateNode.call(this, nodeType, nodeName)
				}
			}

			get nextSibling() {
				let p = this.parentNode
				if (p) {
					let nextIndex = findWhere(p.childNodes, this, true, true) + 1

					return p.childNodes[nextIndex]
				}
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
					const children = child.childNodes.slice()

					for (let i of children) {
						this.insertBefore(i, ref)
					}
				} else {
					child.remove()
					child.parentNode = this
					if (ref) splice(this.childNodes, ref, child, true)
					else this.childNodes.push(child)
				}

				if (onInsertBefore) {
					onInsertBefore.call(this, child, ref)
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
				const childIndex = this.childNodes.indexOf(child)
				if (childIndex < 0) return
				this.childNodes.splice(childIndex, 1)

				if (onRemoveChild) {
					onRemoveChild.call(this, child)
				}

				return child
			}
			remove() {
				if (this.parentNode) this.parentNode.removeChild(this)
			}
		}
	)


	const makeDocumentFragment = named(
		'__undom_isDocumentFragment',
		_ => class DocumentFragment extends makeNode(_) {
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
	)

	function setData(data) {
		this.__data = String(data)
	}

	const makeCharacterData = named(
		'__undom_isCharacterData',
		_ => class CharacterData extends makeNode(_) {
			get data() {
				if (onGetData) onGetData.call(this, data => setData.call(this, data))

				return this.__data
			}
			set data(data) {
				this.__data = String(data)

				if (onSetData) onSetData.call(this, data)
			}
			get length() {
				return this.data.length
			}

			appendData(data) {
				this.data += data
			}
		}
	)


	const makeComment = named(
		'__undom_isComment',
		_ => class Comment extends makeCharacterData(_) {
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
	)


	const makeText = named(
		'__undom_isText',
		_ => class Text extends makeCharacterData(_) {
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
	)

	function updateAttributeNS(ns, name, value) {
		let attr = findWhere(this.attributes, createAttributeFilter(ns, name), false, false)
		if (!attr) this.attributes.push(attr = { ns, name })
		attr.value = String(value)
	}

	const makeElement = named(
		'__undom_isElement',
		(aaa, name) => class Element extends makeNode(aaa) {
			constructor(nodeType, nodeName) {
				super(nodeType || 1, nodeName || name)		// ELEMENT_NODE
				this.attributes = []
				this.__undom_handlers = {}
				if (!this.style) this.style = {}
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
				updateAttributeNS.call(this, ns, name, value)

				if (onSetAttributeNS) {
					onSetAttributeNS.call(this, ns, name, value)
				}
			}
			getAttributeNS(ns, name) {
				if (onGetAttributeNS) {
					onGetAttributeNS.call(this, ns, name, value => updateAttributeNS.call(this, ns, name, value))
				}

				let attr = findWhere(this.attributes, createAttributeFilter(ns, name), false, false)
				return attr && attr.value
			}
			removeAttributeNS(ns, name) {
				splice(this.attributes, createAttributeFilter(ns, name), false, false)

				if (onRemoveAttributeNS) {
					onRemoveAttributeNS.call(this, ns, name)
				}
			}

			addEventListener(type, handler) {
				if (!this.__undom_handlers) return super.addEventListener(type, handler)

				let skip = false
				if (onAddEventListener) {
					skip = onAddEventListener.call(this, type, handler)
				}

				if (!skip) {
					if (!this.__undom_handlers[toLower(type)]) this.__undom_handlers[toLower(type)] = []
					this.__undom_handlers[toLower(type)].push(handler)
				}
			}
			removeEventListener(type, handler) {
				if (!this.__undom_handlers) return super.removeEventListener(type, handler)

				splice(this.__undom_handlers[toLower(type)], handler, false, true)

				if (onRemoveEventListener) {
					onRemoveEventListener.call(this, type, handler)
				}
			}
			dispatchEvent(event) {
				let t = event.target = this,
					c = event.cancelable,
					l = null
				do {
					event.currentTarget = t
					l = t.__undom_handlers && t.__undom_handlers[toLower(event.type)]
					if (l) for (let i = l.length - 1; i >= 0; i -= 1) {
						if ((l[i].call(t, event) === false || event._end) && c) {
							event.defaultPrevented = true
						}
					}
				} while (event.bubbles && !event._stop && (t = t.parentNode))
				return l !== null
			}
		}
	)


	const makeDocument = named(
		'__undom_isDocument',
		_ => class Document extends makeElement(_) {
			constructor() {
				super(9, '#document')			// DOCUMENT_NODE
			}

			// eslint-disable-next-line class-methods-use-this
			createDocumentFragment() {
				return new scope.DocumentFragment()
			}

			// eslint-disable-next-line class-methods-use-this
			createElement(type) {
				if (scope[type]) return new scope[type]()
				if (!silent) console.warn(`UNDOM: Element type '${type}' is not registered.`)
				return new scope.Element(null, type)
			}

			createElementNS(ns, type) {
				const element = this.createElement(type)
				element.namespace = ns
				return element
			}

			// eslint-disable-next-line class-methods-use-this
			createComment(data) {
				return new scope.Comment(data)
			}

			// eslint-disable-next-line class-methods-use-this
			createTextNode(text) {
				return new scope.Text(text)
			}

			// eslint-disable-next-line class-methods-use-this
			createEvent(type) {
				return new Event(type)
			}

			// eslint-disable-next-line class-methods-use-this
			get defaultView() {
				return scope
			}
		}
	)

	function createDocument() {
		const document = new scope.Document()

		if (createBasicElements) {
			document.documentElement = document.createElement('html')
			document.head = document.createElement('head')
			document.body = document.createElement('body')

			document.documentElement.appendChild(document.head)
			document.documentElement.appendChild(document.body)
		}


		return document
	}

	scope.Event = Event
	scope.Node = makeNode()
	scope.CharacterData = makeCharacterData(scope.Node)
	scope.Text = makeText(scope.CharacterData)
	scope.Comment = makeComment(scope.CharacterData)
	scope.Element = makeElement(scope.Node)
	scope.DocumentFragment = makeDocumentFragment(scope.Node)
	scope.Document = makeDocument(scope.Element)

	const registerElement = (name, val) => {
		if (scope[name]) throw new Error(`Element type '${name}' has already been registered.`)
		scope[name] = makeElement(val, name)
		Object.defineProperty(scope[name].prototype, 'typeName', {
			get() {
				return name
			}
		})
	}

	createDocument.env = createEnvironment
	createDocument.registerElement = registerElement
	return createDocument
}

export default createEnvironment
export {Event}
