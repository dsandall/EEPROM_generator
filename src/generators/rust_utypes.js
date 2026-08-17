/** Generate Rust FFI declarations matching the C _Objects layout. */
'use strict'

function rust_utypes_generator(form, od, indexes) {
	const rustTypes = {
		BOOLEAN: 'u8',
		INTEGER8: 'i8',
		INTEGER16: 'i16',
		INTEGER32: 'i32',
		INTEGER64: 'i64',
		REAL32: 'f32',
		REAL64: 'f64',
		UNSIGNED8: 'u8',
		UNSIGNED16: 'u16',
		UNSIGNED32: 'u32',
		UNSIGNED64: 'u64',
		VISIBLE_STRING: 'u8',
	};

	const dictionaryObjects = indexes.map(index => od[index]);
	const inputs = dictionaryObjects.filter(objd => objd.pdo_mappings && objd.pdo_mappings[0] == txpdo);
	const outputs = dictionaryObjects.filter(objd => objd.pdo_mappings && objd.pdo_mappings[0] == rxpdo);
	const parameters = dictionaryObjects.filter(objd => objd.isSDOitem);
	// Match utypes.h exactly: identity, inputs, outputs, then parameters.
	const objects = inputs.concat(outputs, parameters);

	let result = '/* Generated from the EtherCAT object dictionary. */\n\n';
	objects.filter(objd => objd.otype == OTYPE.RECORD).forEach(objd => {
		result += `#[repr(C)]\npub struct ${rustTypeName(objd.name)}\n{\n`;
		objd.items.slice(1).forEach(item => {
			result += `    pub ${rustFieldName(item.name)}: ${rustTypes[item.dtype]},\n`;
		});
		result += '}\n\n';
	});

	result += '#[repr(C)]\npub struct Objects\n{\n    pub serial: u32,\n';
	objects.forEach(objd => {
		result += `    pub ${rustFieldName(objd.name)}: ${rustDeclarationType(objd)},\n`;
	});
	result += '}\n\nunsafe extern "C" {\n    pub static mut Obj: Objects;\n}\n';
	return result;

	function rustDeclarationType(objd) {
		const type = rustTypes[objd.dtype];
		switch (objd.otype) {
		case OTYPE.VAR:
			return objd.dtype == DTYPE.VISIBLE_STRING ? `[${type}; ${objd.size}]` : type;
		case OTYPE.ARRAY:
			return `[${type}; ${objd.items.length - 1}]`;
		case OTYPE.RECORD:
			return rustTypeName(objd.name);
		default:
			throw new Error(`Cannot generate Rust type for ${objd.name}`);
		}
	}

	function rustFieldName(name) {
		let value = variableName(name)
			.replace(/([a-z0-9])([A-Z])/g, '$1_$2')
			.replace(/[^A-Za-z0-9_]/g, '_')
			.toLowerCase();
		if (/^[0-9]/.test(value)) value = `_${value}`;
		const keywords = new Set([
			'as', 'break', 'const', 'continue', 'crate', 'else', 'enum', 'extern',
			'false', 'fn', 'for', 'if', 'impl', 'in', 'let', 'loop', 'match', 'mod',
			'move', 'mut', 'pub', 'ref', 'return', 'self', 'Self', 'static', 'struct',
			'super', 'trait', 'true', 'type', 'unsafe', 'use', 'where', 'while',
		]);
		return keywords.has(value) ? `r#${value}` : value;
	}

	function rustTypeName(name) {
		let value = variableName(name)
			.replace(/[^A-Za-z0-9_]/g, '_')
			.split('_')
			.filter(part => part.length)
			.map(part => part[0].toUpperCase() + part.slice(1))
			.join('');
		if (/^[0-9]/.test(value)) value = `Object${value}`;
		return `${value}Fields`;
	}
}
