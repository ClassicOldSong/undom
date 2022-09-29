import { createEnvironment, isNode, isElement, Event, createEvent } from './undom.js'
import serialize from './serializer.js'

const getDOMImpl = (env) => {
	const {scope, createDocument} = createEnvironment(env)
	const document = createDocument()

	return {
		Node: scope.Node,
		document,
		isNode
	}
}

export {createEnvironment, getDOMImpl, createEvent, Event, isNode, isElement, serialize}
