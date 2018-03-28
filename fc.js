let fs = require('fs');
let util = require('util');

function captureExpression(text, symbol) {
	let match = text.match(new RegExp(`${symbol}\\W\\\`(.*?)\\\``));
	if(match && match.length > 1) return { value: match[1] };

	match = text.match(new RegExp(`${symbol}\\W\\\$(.*?)\\\$`));

	return match && match.length > 1 ? { variable: match[1] } : null;
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
	let currentObjects = [null];
	assignLayers(lines).forEach((line, i) => {
		if(!line.text) return;

		if(line.layer === 0) {
			currentObjects[0] = {text: line.text, line: i}
			statements.push(currentObjects[0]);
		} else {
			let newObject = {text: line.text, line: i};
			currentObjects[line.layer] = newObject;
			currentObjects[line.layer - 1].children ? currentObjects[line.layer - 1].children.push(newObject) : currentObjects[line.layer - 1].children = [newObject];
		}
	});

	return statements;
}

function compilePlace(statement, compiled) {
	if(!statement.children) errorAndExit("Empty 'place' statement", statement);

	let placeName = captureExpression(statement.text, 'named');
	if(!placeName || placeName.variable) errorAndExit("Place must be named and name must not be a variable", statement);

	let newPlace = {};

	statement.children.forEach(child => {
		compileStatement(child, newPlace);
	});

	if(!compiled.places) compiled.places = {};
	compiled.places[placeName.value] = newPlace;
}

function compileThing(statement, compiled) {
	if(!statement.children) errorAndExit("Empty 'thing' statement", statement);

	let thingName = captureExpression(statement.text, 'named');
	if(!thingName || thingName.variable) errorAndExit("Thing must be named and name must not be a variable", statement);

	let thingLocation = captureExpression(statement.text, 'is in');
	if(!thingLocation || thingLocation.variable) errorAndExit("Thing must have a location and location must not be a variable", statement);

	let thingDescription = captureExpression(statement.text, 'looks like');
	if(!thingDescription || thingDescription.variable) errorAndExit("Thing must have a description and description must not be a variable", statement);

	let newThing = {
		location: thingLocation.value,
		description: thingDescription.value
	};

	statement.children.forEach(child => {
		compileStatement(child, newThing);
	});

	if(!compiled.things) compiled.things = {};
	compiled.things[thingName.value] = newThing;
}

function compileDo(statement, compiled) {
	if(!statement.children) errorAndExit("Empty 'do' statement", statement);

	compiled.do = []

	statement.children.forEach(child => {
		let newCommand = {};
		compileStatement(child, newCommand);
		compiled.do.push(newCommand);
	})
}

function compileIf(statement, compiled) {
	if(!statement.children || statement.children.length > 1) errorAndExit(`'If' statements must have one (and no more than one) child.`, statement);

	let comparisons = {
		"is": "eq",
		"is not": "neq",
		"is in": "in",
		"is not in": "nin",
		"has": "in",											// converted to in with operands flipped
		"does not have": "nin"						// converted to nin with operands flipped
	}

	let leftHandOperand = captureExpression(statement.text, 'if');

	if(!leftHandOperand) errorAndExit(`No left hand operand in 'if' statement.`, statement);

	let rightHandOperand;
	let operator;
	Object.keys(comparisons).some(key => {
		rightHandOperand = captureExpression(statement.text, key);
		if(rightHandOperand) operator = key;
		return rightHandOperand;
	});

	if(!rightHandOperand) errorAndExit(`Missing right hand operand or invalid operator in 'if' statement.`, statement);

	if(operator === 'has' || operator === 'does not have') {
		let temp = leftHandOperand;
		leftHandOperand = rightHandOperand;
		rightHandOperand = temp;
	}

	compiled.if = {};
	compiled.then = {};
	compiled.if[comparisons[operator]] = [leftHandOperand, rightHandOperand];
	compileStatement(statement.children[0], compiled.then);
}

function compileVariable(statement, compiled) {}

function compileTravel(statement, compiled) {}

function compileSay(statement, compiled) {}

function compileMove(statement, compiled) {}

let compile = {
	"place": 		compilePlace,
	"do":				compileDo,
	"if":				compileIf,
	"thing":		compileThing,
	"variable": compileVariable,
	"travel":		compileTravel,
	"say":			compileSay,
	"move":			compileMove
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

	for(let statement of grouped) {
		compileStatement(statement, compiled);
	}

	//console.log(util.inspect(compiled, false, 20));
	console.log(JSON.stringify(compiled));
	process.exit(0);
})();
