import {
	splice,
	findWhere,
	createAttributeFilter,
	named
} from './util.js'
import * as symbol from './symbols.js'

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

const isElement = node => node.nodeType === 1

const isNode = node => node[symbol.isNode]

const setData = (self, data) => {
	self[symbol.data] = String(data)
}

// eslint-disable-next-line max-params
const updateAttributeNS = (self, ns, name, value) => {
	let attr = findWhere(self.attributes, createAttributeFilter(ns, name), false, false)
	if (!attr) self.attributes.push(attr = { ns, name })
	attr.value = String(value)
}

function createEnvironment({
	silent = true,
	createBasicElements = true,
	preserveClassNameOnRegister = false,
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

	const makeNode = named(
		'Node',
		(_ = Object) => {
			class Node extends _ {
				constructor(nodeType, localName) {
					super()

					this.nodeType = nodeType
					this.nodeName = String(localName).toUpperCase()
					this.childNodes = []
					this.localName = localName

					Object.defineProperty(this, symbol.eventHandlers, { value: {} })

					if (onCreateNode) {
						onCreateNode.call(this, nodeType, localName)
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

				addEventListener(type, handler, options) {
					if (!this[symbol.eventHandlers]) {
						if (super.addEventListener) return super.addEventListener(type, handler, options)
						return
					}

					let skip = false
					if (onAddEventListener) {
						skip = onAddEventListener.call(this, type, handler, options)
					}

					if (!skip) {
						if (!this[symbol.eventHandlers][type]) this[symbol.eventHandlers][type] = []
						this[symbol.eventHandlers][type].push(handler)
					}
				}
				removeEventListener(type, handler, options) {
					if (!this[symbol.eventHandlers]) {
						if (super.removeEventListener) return super.removeEventListener(type, handler, options)
						return
					}

					let skip = false
					if (onRemoveEventListener) {
						skip = onRemoveEventListener.call(this, type, handler, options)
					}

					if (!skip) splice(this[symbol.eventHandlers][type], handler, false, true)
				}
				dispatchEvent(event) {
					let t = event.target = this,
						c = event.cancelable,
						l = null
					do {
						event.currentTarget = t
						l = t[symbol.eventHandlers] && t[symbol.eventHandlers][event.type]
						if (l) for (let i = l.length - 1; i >= 0; i -= 1) {
							if ((l[i].call(t, event) === false || event._end) && c) {
								event.defaultPrevented = true
							}
						}
					} while (event.bubbles && !event._stop && (t = t.parentNode))
					return l !== null
				}
			}

			Object.defineProperty(Node.prototype, symbol.isNode, {
				value: true
			})

			return Node
		}
	)


	const makeDocumentFragment = named(
		'DocumentFragment',
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


	const makeCharacterData = named(
		'CharacterData',
		_ => class CharacterData extends makeNode(_) {
			constructor(...args) {
				super(...args)

				// eslint-disable-next-line init-declarations
				let data
				Object.defineProperty(this, symbol.data, {
					get() {
						return data
					},
					set(val) {
						data = val
					}
				})
			}

			get data() {
				if (onGetData) onGetData.call(this, data => setData(this, data))

				return this[symbol.data]
			}
			set data(data) {
				setData(this, data)

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
		'Comment',
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
		'Text',
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


	const makeElement = named(
		'Element',
		(aaa, name) => class Element extends makeNode(aaa) {
			constructor(nodeType, localName) {
				super(nodeType || 1, localName || name)		// ELEMENT_NODE
				this.attributes = []
				if (!this.style) this.style = {}
			}

			get tagName() {
				return this.nodeName
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
				updateAttributeNS(this, ns, name, value)

				if (onSetAttributeNS) {
					onSetAttributeNS.call(this, ns, name, value)
				}
			}
			getAttributeNS(ns, name) {
				if (onGetAttributeNS) {
					onGetAttributeNS.call(this, ns, name, value => updateAttributeNS(this, ns, name, value))
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
		}
	)


	const makeDocument = named(
		'Document',
		_ => class Document extends makeElement(_) {
			/* eslint-disable class-methods-use-this */
			constructor() {
				super(9, '#document')			// DOCUMENT_NODE
			}

			createDocumentFragment() {
				return new scope.DocumentFragment()
			}

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

			createComment(data) {
				return new scope.Comment(data)
			}

			createTextNode(text) {
				return new scope.Text(text)
			}

			createEvent(type) {
				return new Event(type)
			}

			get defaultView() {
				return scope
			}
		}
	)

	const createDocument = () => {
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
		if (preserveClassNameOnRegister) Object.defineProperties(scope[name].prototype, {
			typeName: {
				get() {
					return name
				}
			},
			name: {
				get() {
					return name
				}
			}
		})
	}

	return {scope, createDocument, makeNode, makeText, makeComment, makeElement, makeDocument, registerElement}
}

export {createEnvironment, Event, isElement, isNode, symbol}
