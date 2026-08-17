#!/usr/bin/env node
'use strict'

const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = __dirname;

function load(relativePath) {
	const filename = path.join(root, relativePath);
	vm.runInThisContext(fs.readFileSync(filename, 'utf8'), { filename });
}

load('lib/jasmine-3.8.0/jasmine.js');

const jasmineCore = jasmineRequire.core(jasmineRequire);
const env = jasmineCore.getEnv();
Object.assign(globalThis, jasmineRequire.interface(jasmineCore, env));

[
	'src/constants.js',
	'src/validation.js',
	'src/od.js',
	'src/file_io.js',
	'src/backup.js',
	'src/binaries.js',
	'src/readers/xml_reader.js',
	'src/generators/EEPROM.js',
	'src/generators/esi_xml.js',
	'src/generators/ecat_options.js',
	'src/generators/objectlist.js',
	'src/generators/utypes.js',
	'spec/helpers/customMatchers.js',
	'spec/helpers/formMockHelper.js',
	'spec/backupSpecs.js',
	'spec/binariesSpecs.js',
	'spec/odSpecs.js',
	// xml_reader specs require the browser's DOMParser.
	'spec/generators/emptyProjectSpecs.js',
	'spec/generators/cia402exampleProjectSpecs.js',
	'spec/generators/enabledFoEProjectSpecs.js',
	'spec/generators/escSpecificSpecs.js',
	'spec/generators/spiModeHexSpecs.js',
	'spec/generators/VAR/ARRAY_Specs.js',
	'spec/generators/VAR/INTEGER8_Specs.js',
	'spec/generators/VAR/INTEGER64_Specs.js',
	'spec/generators/VAR/VISIBLE_STRING_Specs.js',
].forEach(load);

let failures = 0;
env.addReporter({
	specDone(result) {
		if (result.status === 'failed') {
			failures++;
			console.error(`FAIL: ${result.fullName}`);
			result.failedExpectations.forEach(failure => console.error(failure.message));
		}
	},
	jasmineDone(result) {
		if (result.failedExpectations) {
			failures += result.failedExpectations.length;
			result.failedExpectations.forEach(failure => console.error(failure.message));
		}
		if (failures) {
			console.error(`${failures} test(s) failed`);
			process.exitCode = 1;
		} else {
			console.log('All EEPROM_generator tests passed');
		}
	},
});

env.execute();
