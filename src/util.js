export const toLower = str => String(str).toLowerCase()

export const findWhere = (arr, fn, returnIndex, byValue) => {
	let i = arr.length
	while (i) {
		i -= 1
		const val = arr[i]
		if (byValue) {
			if (val === fn) return returnIndex ? i : val
		} else if (fn(val)) return returnIndex ? i : val
	}
}

export const splice = (arr, item, add, byValue) => {
	let i = arr ? findWhere(arr, item, true, byValue) : -1
	if (i !== -1) {
		if (add) arr.splice(i, 0, add)
		else arr.splice(i, 1)
	}
	return i
}

export const createAttributeFilter = (ns, name) => o => o.ns === ns && toLower(o.name) === toLower(name)

export const named = (key, creator) => (_, ...args) => {
	if (_ && _.prototype[key]) return _
	const createdClass = creator(_, ...args)
	createdClass.prototype[key] = true
	return createdClass
}
