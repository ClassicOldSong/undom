const selfClosingTags = {
	area: true,
	base: true,
	br: true,
	col: true,
	command: true,
	embed: true,
	hr: true,
	img: true,
	input: true,
	keygen: true,
	link: true,
	menuitem: true,
	meta: true,
	param: true,
	source: true,
	track: true,
	wbr: true
}

const enc = (s) => {
	return ('' + s).replace(/[&'"<>\u2190-\u2199]/g, a => `&#${a.codePointAt(0)};`)
}

const attr = (a) => {
	if (a.value) return ` ${a.name}="${enc(a.value)}"`
	return ` ${a.name}`
}

function serialize(el) {
	switch (el.nodeType) {
		case 3: {
			return enc(el.nodeValue || '')
		}

		case 8: {
			return `<!--${enc(el.data || '')}-->`
		}

		default: {
			const xmlStringFrags = []

			const {nodeName, attributes, childNodes} = el

			if (!nodeName) return ''

			const tag = nodeName.toLowerCase()

			if (tag) xmlStringFrags.push(`<${tag}`)
			if (attributes) xmlStringFrags.push(attributes.map(attr))
			if (childNodes.length > 0) {
				if (tag) xmlStringFrags.push('>')
				xmlStringFrags.push(...childNodes.map(item => serialize(item)))
				if (tag) xmlStringFrags.push(`</${tag}>`)
			} else if (tag) {
				if (selfClosingTags[tag]) xmlStringFrags.push('/>')
				else xmlStringFrags.push(`></${tag}>`)
			}

			return xmlStringFrags.join('')
		}
	}
}

export default serialize
