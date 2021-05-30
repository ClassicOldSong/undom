import undom from './undom.js'
import serialize from './serializer.js'

const document = undom()

const domImpl = {
	Node: document.defaultView.Node,
	document
}

export {document, domImpl, undom, serialize}
