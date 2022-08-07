import undom from './native-adapter.js'
import serialize from './serializer.js'

const document = undom()

const domImpl = {
	Node: document.defaultView.Node,
	document,
	isNode: node => node.__undom_isNode
}

export {document, domImpl, undom, serialize}
