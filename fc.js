let fs = require('fs');
let util = require('util');

function captureExpression(text, symbol) {
	let match = text.match(new RegExp(`${symbol}\\W\\\`(.*)\\\``));
	return match && match.length > 1 ? match[1] : null;
}

function errorAndExit(error, statement = null) {
	if(!statement) console.error(error);
	else {
		console.error(`Error at line ${statement.line}: '${statement.text}'`);
		console.error(`ERROR: ${error}`);
	}
	process.exit(1);
}

function validateFilePath(sourceFile) {
	if(!sourceFile || !fs.existsSync(sourceFile)) {
	  errorAndExit("Bad source file path");
	}
}

function assignLayers(lines) {
	let statements = [];
	for(let line of lines) {
		let layer = 0;
	  for(let i = 0; i < line.length; i++) {
			if(line[i] === '\t') layer++;
	  }
		statements.push({layer, text: line.trim()});
	}

	return statements;
}

function groupStatements(lines) {
	let statements = [];
	let currentObject;
	assignLayers(lines).forEach((line, i) => {
		if(!line.text) return;

		if(line.layer === 0) {
			currentObject = {text: line.text, line: i}
			statements.push(currentObject);
		} else {
			let newObject = {text: line.text, line: i};
			currentObject.children ? currentObject.children.push(newObject) : currentObject.children = [newObject];
			currentObject = newObject;
		}
	});

	return statements;
}

function compilePlace(statement, compiled) {
	if(!statement.children) errorAndExit("Empty 'place' statement", statement);

	let placeName = captureExpression(statement.text, 'named');
	if(!placeName) errorAndExit("place has no name", statement);

	let newPlace = {};

	statement.children.forEach(child => {
		compileStatement(child, newPlace);
	});

	if(!compiled.places) compiled.places = {};
	compiled.places[placeName] = newPlace;
}

function compileDo(statement, compiled) {
	if(!statement.children) errorAndExit("Empty 'do' statement", statement);

    compiled.do = []
	console.log(statement.children.length);
	statement.children.forEach(child => {
		let newCommand = {};
		compileStatement(child, newCommand);
		compiled.do.push(newCommand);
	})
}

function compileIf(statement, compiled) {
	compiled.if = true;
}

function compileThing(statement, compiled) {}

function compileVariable(statement, compiled) {}

let compile = {
	"place": 		compilePlace,
	"do":				compileDo,
	"if":				compileIf,
	"thing":		compileThing,
	"variable": compileVariable
}

function compileStatement(statement, compiled) {
	let command = statement.text.split(' ').shift();

	if(!compile[command]) {
		errorAndExit(`Invalid command '${command}'`, statement);
	}

	compile[command](statement, compiled);
}

(() => {
	let sourceFile = process.argv[2];
	validateFilePath(sourceFile);

	let source = fs.readFileSync(sourceFile, 'utf8');
	let grouped = groupStatements(source.split('\n'));
	let compiled = {};
console.log(grouped);
	for(let statement of grouped) {
		compileStatement(statement, compiled);
	}

	console.log(util.inspect(compiled, false, 20));

	process.exit(0);
})();
