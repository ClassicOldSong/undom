import * as NativeViews from './native-views'

import createEnvironment, {Event} from './undom.js'

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

const silent = false

const undom = createEnvironment({
	silent,
	createBasicElements: false,
	onSetData(data) {
		if (this.nodeType === 8) {
			if (!silent) console.log('[DOM COMMENT]', data)
		} else if (this.nodeType === 3 && this.parentNode && this.parentNode.__isNative && this.parentNode.__nativeIsText) {
			this.parentNode.updateText()
		}
	},
	onCreateNode(nodeType) {
		if (nodeType === 1) {
			this.__nativeEventHandlers = {}
		}
	},
	onInsertBefore(child, ref) {
		if (!this.__isNative) return
		while (ref && !ref.__isNative) ref = ref.nextSibling
		this.onInsertChild(child, ref)
	},
	onRemoveChild(child) {
		if (!this.__isNative) return
		this.onRemoveChild(child)
	},
	onSetAttributeNS(ns, name, value) {
		if (!this.__isNative) return
		this.onSetAttributeNS(ns, name, value)
	},
	onGetAttributeNS(ns, name, updateValue) {
		if (!this.__isNative) return
		this.onGetAttributeNS(ns, name, updateValue)
	},
	onRemoveAttributeNS(ns, name) {
		if (!this.__isNative) return
		this.onRemoveAttributeNS(ns, name)
	},
	onAddEventListener(type, handler, options) {
		if (!this.__isNative) return
		if (options && options.efInternal && !this.__nativeEventHandlers[type]) {
			this.__nativeEventHandlers[type] = () => this.dispatchEvent(new Event(type))
			this.onAddEventListener(type, this.__nativeEventHandlers[type])
			return
		}
		this.onAddEventListener(type, handler)
		return true
	},
	onRemoveEventListener(type, handler, options) {
		if (!this.__isNative) return
		if (options && options.efInternal && this.__nativeEventHandlers[type]) {
			if (this.__undom_handlers[type] && !this.__undom_handlers[type].length) {
				handler = this.__nativeEventHandlers[type]
				delete this.__nativeEventHandlers[type]
			}
		}
		this.onRemoveEventListener(type, handler)
	}
})

for (let [key, val] of Object.entries(NativeViews)) {
	undom.registerElement(key, val)
}

export default undom
