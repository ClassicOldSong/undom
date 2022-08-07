import createEnvironment, { isNode, isElement } from './undom.js'
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

export {createEnvironment, getDOMImpl, isNode, isElement, serialize}
