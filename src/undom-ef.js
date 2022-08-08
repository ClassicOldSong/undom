import createEnvironment, { isNode, isElement, Event } from './undom.js'
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

export {createEnvironment, getDOMImpl, Event, isNode, isElement, serialize}
