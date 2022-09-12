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
					this.localName = localName

					Object.defineProperty(this, symbol.eventHandlers, { value: {} })

					if (onCreateNode) {
						onCreateNode.call(this, nodeType, localName)
					}
				}

				get previousElementSibling() {
					let currentNode = this.previousSibling
					while (currentNode) {
						if (isElement(currentNode)) return currentNode
						currentNode = currentNode.previousSibling
					}

					return null
				}
				get nextElementSibling() {
					let currentNode = this.nextSibling
					while (currentNode) {
						if (isElement(currentNode)) return currentNode
						currentNode = currentNode.nextSibling
					}

					return null
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


	const makeCharacterData = named(
		'CharacterData',
		(_ = scope.Node) => class CharacterData extends makeNode(_) {
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
		(_ = scope.CharacterData) => class Comment extends makeCharacterData(_) {
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
		(_ = scope.CharacterData) => class Text extends makeCharacterData(_) {
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


	const makeParentNode = named(
		'ParentNode',
		(_ = scope.Node) => class ParentNode extends makeNode(_) {

			get firstElementChild() {
				let currentNode = this.firstChild
				while (currentNode) {
					if (isElement(currentNode)) return currentNode
					currentNode = currentNode.nextSibling
				}

				return null
			}
			get lastElementChild() {
				let currentNode = this.lastChild
				while (currentNode) {
					if (isElement(currentNode)) return currentNode
					currentNode = currentNode.previousSibling
				}

				return null
			}

			get childNodes() {
				const childNodes = []

				let currentNode = this.firstChild
				while (currentNode) {
					childNodes.push(currentNode)
					currentNode = currentNode.nextSibling
				}

				return childNodes
			}
			get children() {
				const children = []

				let currentNode = this.firstElementChild
				while (currentNode) {
					children.push(currentNode)
					currentNode = currentNode.nextElementSibling
				}

				return children
			}
			get childElementCount() {
				let count = 0

				let currentNode = this.firstElementChild
				while (currentNode) {
					count += 1
					currentNode = currentNode.nextElementSibling
				}

				return count
			}

			insertBefore(child, ref) {
				if (ref && ref.parentNode !== this) throw new Error(`Failed to execute 'insertBefore' on 'Node': The node before which the new node is to be inserted is not a child of this node.`)
				if (child === ref) return

				if (child.nodeType === 11) {
					let currentNode = child.firstChild
					while (currentNode) {
						const nextSibling = currentNode.nextSibling
						this.insertBefore(currentNode, ref)
						currentNode = nextSibling
					}
				} else {
					child.remove()
					child.parentNode = this

					if (ref) {
						child.previousSibling = ref.previousSibling
						child.nextSibling = ref
						ref.previousSibling = child
					} else {
						child.previousSibling = this.lastChild
						this.lastChild = child
					}

					if (child.previousSibling) child.previousSibling.nextSibling = child
					else this.firstChild = child
				}

				if (onInsertBefore) {
					onInsertBefore.call(this, child, ref)
				}

				return child
			}

			appendChild(child) {
				return this.insertBefore(child)
			}

			append(...children) {
				for (let i of children) {
					this.appendChild(i)
				}
			}

			replaceChild(child, ref) {
				if (ref.parentNode !== this) throw new Error(`Failed to execute 'replaceChild' on 'Node': The node to be replaced is not a child of this node.`)

				this.insertBefore(child, ref)
				ref.remove()

				return ref
			}

			removeChild(child) {
				if (child.parentNode !== this) return

				if (this.firstChild === child) this.firstChild = child.nextSibling
				if (this.lastChild === child) this.lastChild = child.previousSibling

				if (child.previousSibling) child.previousSibling.nextSibling = child.nextSibling
				if (child.nextSibling) child.nextSibling.previousSibling = child.previousSibling

				child.parentNode = null
				child.previousSibling = null
				child.nextSibling = null

				if (onRemoveChild) {
					onRemoveChild.call(this, child)
				}

				return child
			}
		}
	)


	const makeDocumentFragment = named(
		'DocumentFragment',
		(_ = scope.ParentNode) => class DocumentFragment extends makeParentNode(_) {
			constructor() {
				super(11, '#document-fragment')
			}
		}
	)


	const makeElement = named(
		'Element',
		(_ = scope.ParentNode, name) => class Element extends makeParentNode(_) {
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
		(_ = scope.Element) => class Document extends makeElement(_) {
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
	scope.CharacterData = makeCharacterData()
	scope.Text = makeText()
	scope.Comment = makeComment()
	scope.ParentNode = makeParentNode()
	scope.DocumentFragment = makeDocumentFragment()
	scope.Element = makeElement()
	scope.Document = makeDocument()

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

	return {scope, createDocument, makeNode, makeParentNode, makeText, makeComment, makeDocumentFragment, makeElement, makeDocument, registerElement}
}

export {createEnvironment, Event, isElement, isNode, symbol}
