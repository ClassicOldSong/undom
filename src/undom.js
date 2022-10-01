/* eslint-disable camelcase */

import {
	splice,
	findWhere,
	createAttributeFilter,
	named
} from './util.js'
import serialize from './serializer.js'

/*
const NODE_TYPES = {
	ELEMENT_NODE: 1,
	ATTRIBUTE_NODE: 2,
	TEXT_NODE: 3,
	CDATA_SECTION_NODE: 4,
	ENTITY_REFERENCE_NODE: 5,
	PROCESSING_INSTRUCTION_NODE: 7,
	COMMENT_NODE: 8,
	DOCUMENT_NODE: 9,
	DOCUMENT_FRAGMENT_NODE: 11
}
*/

const HTMLNS = 'http://www.w3.org/1999/xhtml'
const SVGNS = 'http://www.w3.org/2000/svg'

class Event {
	constructor(type, {bubbles, captures, cancelable} = {}) {
		this.initEvent(type, bubbles, cancelable, captures)
	}
	// eslint-disable-next-line max-params
	initEvent(type, bubbles, cancelable = true, captures) {
		this.type = type
		this.bubbles = !!bubbles
		this.cancelable = !!cancelable
		this.captures = !!captures
	}
	stopPropagation() {
		this.__undom_event_stop = true
	}
	stopImmediatePropagation() {
		this.__undom_event_end = this.__undom_event_stop = true
	}
	preventDefault() {
		if (this.__undom_event_passive) {
			console.error('[UNDOM-NG] Unable to preventDefault inside passive event listener invocation.')
			return
		}

		this.defaultPrevented = true
	}
}

const createEvent = eventName => new Event(eventName)

// eslint-disable-next-line max-params
const getEventDescriptor = (target, type, handler, options) => {
	if (typeof option === 'object') {
		const { capture, once, passive, signal } = options
		return { target, capture, once, passive, signal, handler }
	}

	return { target, capture: !!options, type, handler }
}


const runEventHandlers = (store, event, cancelable) => {
	for (let descriptor of [...store.values()]) {
		const { target, handler, removed } = descriptor
		if (!removed) {
			event.__undom_event_passive = !cancelable || !!descriptor.passive
			event.currentTarget = target
			handler.call(target, event)
			if (event.__undom_event_end) return
		}
	}
}

const isElement = node => node && node.__undom_is_Element || false

const isNode = node => node && node.__undom_is_Node || false

const setData = (self, data) => {
	self.__undom_data = data
}

const defaultInitDocument = (document) => {
	document.documentElement = document.createElement('html')
	document.head = document.createElement('head')
	document.body = document.createElement('body')

	document.documentElement.appendChild(document.head)
	document.documentElement.appendChild(document.body)

	document.appendChild(document.documentElement)
}

// eslint-disable-next-line max-params
const updateAttributeNS = (self, ns, name, value) => {
	let attr = findWhere(self.attributes, createAttributeFilter(ns, name), false, false)
	if (!attr) self.attributes.push(attr = { ns, name })
	attr.value = value
}

function createEnvironment({
	silent = true,
	scope = {},
	commonAncestors = {},
	initDocument = defaultInitDocument,
	preserveClassNameOnRegister = false,
	onGetData,
	onSetData,
	onCreateNode,
	onInsertBefore,
	onRemoveChild,
	onSetInnerHTML,
	onSetOuterHTML,
	onSetTextContent,
	onGetTextContent,
	onSetAttributeNS,
	onGetAttributeNS,
	onRemoveAttributeNS,
	onAddEventListener,
	onAddedEventListener,
	onRemoveEventListener,
	onRemovedEventListener
} = {}) {

	const createElement = (type) => {
		if (scope[type]) return new scope[type]()
		if (!silent) console.warn(`[UNDOM-NG] Element type '${type}' is not registered.`)
		return new scope.HTMLElement(null, type)
	}

	const makeNode = named(
		'Node',
		(_ = commonAncestors.Node || Object) => {
			class Node extends _ {
				constructor(nodeType, localName) {
					super()

					this.nodeType = nodeType
					if (localName) this.nodeName = localName[0] === '#' ? localName : String(localName).toUpperCase()

					this.__undom_eventHandlers = {
						capturePhase: {},
						bubblePhase: {}
					}

					if (onCreateNode) {
						onCreateNode.call(this, nodeType, localName)
					}
				}

				get [Symbol.toStringTag]() {
					return this.constructor.name
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

				replaceWith(...nodes) {
					if (!this.parentNode) return

					const ref = this.nextSibling
					const parent = this.parentNode
					for (let i of nodes) {
						i.remove()
						parent.insertBefore(i, ref)
					}
				}

				cloneNode(deep) {
					let clonedNode = null

					if (this.__undom_is_ParentNode) {
						if (this.nodeType === 9) clonedNode = new scope.Document()
						else if (this.nodeType === 11) clonedNode = new scope.DocumentFragment()
						else {
							clonedNode = createElement(this.localName)
							const sourceAttrs = this.attributes
							for (let {ns, name, value} of sourceAttrs) {
								clonedNode.setAttributeNS(ns, name, value)
							}
						}

						if (deep) {
							let currentNode = this.firstChild
							while (currentNode) {
								clonedNode.appendChild(currentNode.clonedNode(deep))
								currentNode = currentNode.nextSibling
							}
						}
					} else if (this.nodeType === 3) clonedNode = new scope.Text(this.nodeValue)
					else if (this.nodeType === 8) clonedNode = new scope.Comment(this.nodeValue)

					return clonedNode
				}

				hasChildNodes() {
					return !!this.firstChild
				}

				addEventListener(...args) {
					// Method could be called before constructor
					if (!this.__undom_eventHandlers) {
						return super.addEventListener(...args)
					}

					const [type, handler, options] = args

					let skip = false
					if (onAddEventListener) {
						skip = onAddEventListener.call(this, ...args)
					}

					if (!skip) {
						const descriptor = getEventDescriptor(this, type, handler, options)

						const phase = descriptor.capture && 'capturePhase' || 'bubblePhase'

						let store = this.__undom_eventHandlers[phase][type]
						if (!store) store = this.__undom_eventHandlers[phase][type] = new Map()
						else if (store.has(handler)) return

						store.set(handler, descriptor)

						const abortHandler = () => {
							if (!descriptor.removed) this.removeEventListener(...args)
						}

						descriptor.abortHandler = abortHandler

						if (descriptor.once) {
							descriptor.handler = function (...handlerArgs) {
								abortHandler()
								handler.call(this, ...handlerArgs)
							}
						}

						if (descriptor.signal) {
							descriptor.signal.addEventListener('abort', abortHandler)
						}

						if (onAddedEventListener) {
							onAddedEventListener.call(this, ...args)
						}
					}
				}
				removeEventListener(...args) {
					// Method could be called before constructor
					if (!this.__undom_eventHandlers) {
						return super.removeEventListener(...args)
					}

					const [type, handler, options] = args

					let skip = false
					if (onRemoveEventListener) {
						skip = onRemoveEventListener.call(this, ...args)
					}

					if (!skip) {
						let capture = false
						if (typeof options === 'object') capture = !!options.capture
						else capture = !!options

						const phase = capture && 'capturePhase' || 'bubblePhase'

						const store = this.__undom_eventHandlers[phase][type]
						if (!store) return

						const descriptor = store.get(handler)
						if (!descriptor) return

						if (descriptor.signal) descriptor.signal.removeEventListener('abort', descriptor.abortHandler)
						store.delete(handler)

						descriptor.remove = true

						if (!store.size) delete this.__undom_eventHandlers[phase][type]

						if (onRemovedEventListener) {
							onRemovedEventListener.call(this, ...args)
						}
					}
				}

				// eslint-disable-next-line complexity
				dispatchEvent(event) {
					const { cancelable, bubbles, captures, type } = event
					event.target = this

					const capturePhase = []
					const bubblePhase = []

					if (bubbles || captures) {
						// eslint-disable-next-line consistent-this
						let currentNode = this
						while (currentNode) {
							if (captures && currentNode.__undom_eventHandlers.capturePhase[type]) capturePhase.unshift(currentNode.__undom_eventHandlers.capturePhase[type])
							if (bubbles && currentNode.__undom_eventHandlers.bubblePhase[type]) bubblePhase.push(currentNode.__undom_eventHandlers.bubblePhase[type])
							currentNode = currentNode.parentNode
						}
					}

					if (!captures && this.__undom_eventHandlers.capturePhase[type]) capturePhase.push(this.__undom_eventHandlers.capturePhase[type])
					if (!bubbles && this.__undom_eventHandlers.bubblePhase[type]) bubblePhase.push(this.__undom_eventHandlers.bubblePhase[type])

					for (let i of capturePhase) {
						runEventHandlers(i, event, cancelable)
						if (!event.bubbles || event.__undom_event_stop) return !event.defaultPrevented
					}

					for (let i of bubblePhase) {
						runEventHandlers(i, event, cancelable)
						if (!event.bubbles || event.__undom_event_stop) return !event.defaultPrevented
					}

					return !event.defaultPrevented
				}
			}

			return Node
		}
	)


	const makeCharacterData = named(
		'CharacterData',
		(_ = commonAncestors.CharacterData || scope.Node) => class CharacterData extends makeNode(_) {
			get data() {
				if (onGetData) onGetData.call(this, data => setData(this, data))

				return this.__undom_data
			}
			set data(data) {
				setData(this, data)

				if (onSetData) onSetData.call(this, data)
			}
			get length() {
				return this.data.length
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

			appendData(data) {
				this.data += data
			}
		}
	)


	const makeComment = named(
		'Comment',
		(_ = commonAncestors.Comment || scope.CharacterData) => class Comment extends makeCharacterData(_) {
			constructor(data) {
				super(8, '#comment')
				this.data = data
			}
		}
	)


	const makeText = named(
		'Text',
		(_ = commonAncestors.Text || scope.CharacterData) => class Text extends makeCharacterData(_) {
			constructor(text) {
				super(3, '#text')					// TEXT_NODE
				this.data = text
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

			get textContent() {
				if (onGetTextContent) {
					const textContent = onGetTextContent.call(this)
					if (textContent) return textContent
				}

				const textArr = []

				let currentNode = this.firstChild
				while (currentNode) {
					if (currentNode.nodeType !== 8) {
						const textContent = currentNode.textContent
						if (textContent) textArr.push(textContent)
					}
					currentNode = currentNode.nextSibling
				}

				return ''.concat(...textArr)
			}
			set textContent(val) {
				if (onSetTextContent) onSetTextContent.call(this, val)
			}

			insertBefore(child, ref) {
				if (ref && ref.parentNode !== this) throw new Error(`[UNDOM-NG] Failed to execute 'insertBefore' on 'Node': The node before which the new node is to be inserted is not a child of this node.`)
				if (child === ref) return

				if (child.nodeType === 11) {
					const {firstChild, lastChild} = child

					if (firstChild && lastChild) {
						let currentNode = firstChild
						while (currentNode) {
							const nextSibling = currentNode.nextSibling

							currentNode.parentNode = this
							if (onRemoveChild) onRemoveChild.call(child, currentNode)
							if (onInsertBefore) onInsertBefore.call(this, currentNode, ref)

							currentNode = nextSibling
						}

						if (ref) {
							firstChild.previousSibling = ref.previousSibling
							lastChild.nextSibling = ref
							ref.previousSibling = lastChild
						} else {
							firstChild.previousSibling = this.lastChild
							lastChild.nextSibling = null
						}

						if (!firstChild.previousSibling) this.firstChild = firstChild
						if (!lastChild.nextSibling) this.lastChild = lastChild

						child.firstChild = null
						child.lastChild = null
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

				if (onInsertBefore) onInsertBefore.call(this, child, ref)

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

			replaceChild(child, oldChild) {
				if (oldChild.parentNode !== this) throw new Error(`[UNDOM-NG] Failed to execute 'replaceChild' on 'Node': The node to be replaced is not a child of this node.`)

				const ref = oldChild.nextSibling
				oldChild.remove()

				this.insertBefore(child, ref)

				return oldChild
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

				if (onRemoveChild) onRemoveChild.call(this, child)

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
		(_ = commonAncestors.Element || scope.ParentNode, name) => {
			const protoHasInnerHTML = 'innerHTML' in _.prototype
			const protoHasOuterHTML = 'outerHTML' in _.prototype

			class Element extends makeParentNode(_) {
				constructor(nodeType, localName) {
					super(nodeType || 1, localName || name)		// ELEMENT_NODE
					this.localName = localName || name
					this.attributes = []
					if (!this.style) this.style = {}
				}

				get tagName() {
					return this.nodeName
				}

				get namespaceURI() {
					return this.__undom_namespace
				}

				get className() {
					return this.getAttribute('class')
				}
				set className(val) {
					this.setAttribute('class', val)
				}

				// Actually innerHTML and outerHTML is out of DOM's spec
				// But we just put it here for some frameworks to work
				// Or warn people not trying to treat undom like a browser
				get innerHTML() {
					if (protoHasInnerHTML) return super.innerHTML

					const serializedChildren = []
					let currentNode = this.firstChild
					while (currentNode) {
						serializedChildren.push(serialize(currentNode, true))
						currentNode = currentNode.nextSibling
					}
					return ''.concat(...serializedChildren)
				}
				set innerHTML(value) {
					if (protoHasInnerHTML) {
						super.innerHTML = value
						return
					}

					// Setting innerHTML with an empty string just clears the element's children
					if (value === '') {
						let currentNode = this.firstChild

						while (currentNode) {
							const nextSibling = currentNode.nextSibling
							currentNode.remove()
							currentNode = nextSibling
						}

						return
					}

					if (onSetInnerHTML) return onSetInnerHTML(this, value)

					throw new Error(`[UNDOM-NG] Failed to set 'innerHTML' on '${this.localName}': Not implemented.`)
				}

				get outerHTML() {
					if (protoHasOuterHTML) return super.outerHTML

					return serialize(this, true)
				}
				set outerHTML(value) {
					if (protoHasOuterHTML) {
						super.outerHTML = value
						return
					}

					// Setting outehHTMO with an empty string just removes the element form it's parent
					if (value === '') return this.remove()
					if (onSetOuterHTML) return onSetOuterHTML.call(this, value)
					throw new Error(`[UNDOM-NG] Failed to set 'outerHTML' on '${this.localName}': Not implemented.`)
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

			return Element
		}
	)

	const makeHTMLElement = named(
		'HTMLElement',
		(_ = commonAncestors.HTMLElement || scope.Element, name) => class HTMLElement extends makeElement(_, name) {
			constructor(...args) {
				super(...args)
				this.__undom_namespace = HTMLNS
			}
		}
	)


	const makeSVGElement = named(
		'SVGElement',
		(_ = commonAncestors.SVGElement || scope.Element, name) => class SVGElement extends makeElement(_, name) {
			constructor(...args) {
				super(...args)
				this.__undom_namespace = SVGNS
			}
		}
	)


	const makeDocument = named(
		'Document',
		(_ = commonAncestors.Document || scope.ParentNode) => class Document extends makeParentNode(_) {
			/* eslint-disable class-methods-use-this */
			constructor() {
				super(9, '#document')			// DOCUMENT_NODE
			}

			createDocumentFragment() {
				return new scope.DocumentFragment()
			}

			createElement(type) {
				return createElement(type)
			}

			createElementNS(ns, type) {
				const element = this.createElement(type)
				element.__undom_namespace = ns
				return element
			}

			createComment(data) {
				return new scope.Comment(data)
			}

			createTextNode(text) {
				return new scope.Text(text)
			}

			createEvent(type) {
				return createEvent(type)
			}

			get defaultView() {
				return scope
			}
		}
	)

	const createDocument = (_initDocument = initDocument) => {
		const document = new scope.Document()

		if (_initDocument) _initDocument(document)

		return document
	}

	scope.Event = Event
	scope.Node = makeNode.master()
	scope.CharacterData = makeCharacterData.master()
	scope.Text = makeText.master()
	scope.Comment = makeComment.master()
	scope.ParentNode = makeParentNode.master()
	scope.DocumentFragment = makeDocumentFragment.master()
	scope.Element = makeElement.master()
	scope.HTMLElement = makeHTMLElement.master()
	scope.SVGElement = makeSVGElement.master()
	scope.Document = makeDocument.master()

	const registerElement = (name, val, isSVG) => {
		if (scope[name]) throw new Error(`[UNDOM-NG] Element type '${name}' has already been registered.`)
		const element = isSVG ? makeSVGElement(val, name) : makeHTMLElement(val, name)
		scope[name] = element
		if (preserveClassNameOnRegister) Object.defineProperty(element, 'name', { value: name })

		return element
	}

	return {scope, createEvent, createDocument, createElement, makeNode, makeParentNode, makeText, makeComment, makeDocumentFragment, makeElement, makeHTMLElement, makeSVGElement, makeDocument, registerElement}
}

export {createEnvironment, createEvent, Event, isElement, isNode}
