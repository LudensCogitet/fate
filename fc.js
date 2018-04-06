let fs = require('fs');
let util = require('util');

function captureExpression(text, symbol = '') {
	let regex = [
		new RegExp(`${symbol}\\W\\\`(.*?)\\\``),
		new RegExp(`${symbol}\\W\\\$(.*?)\\\$`),
		new RegExp("^`(.*?)`"),
		new RegExp("^\\\$(.*?)\\\$")
	];

	for(let i = 0; i < regex.length; i++) {
		let match = text.match(regex[i]);
		if(match && match.length > 1) {
			switch(i) {
				case 0:
				case 2:
					return { value: match[1] };
				case 1:
				case 3:
				return { variable: match[1] };
			}
		}
	}

	return null;
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
	});
}

function compileComparison(command, statement) {
	let {text} = statement;
	let comparisons = {
		"is": "eq",
		"is not": "neq",
		"is in": "in",
		"is not in": "nin",
		"has": "in",											// converted to in with operands flipped
		"does not have": "nin"						// converted to nin with operands flipped
	}

	let leftHandOperand = captureExpression(statement.text, command);

	if(!leftHandOperand) errorAndExit(`No left hand operand in "${command}" statement.`, statement);

	let rightHandOperand;
	let operator;
	Object.keys(comparisons).some(key => {
		rightHandOperand = captureExpression(statement.text, key);
		if(rightHandOperand) operator = key;
		return rightHandOperand;
	});

	if(!operator) errorAndExit(`No known operator in "${command}" statement`, statement);
	if(!rightHandOperand) errorAndExit(`Missing right hand operand or invalid operator in "${command}" statement.`, statement);

	if(operator === 'has' || operator === 'does not have') {
		let temp = leftHandOperand;
		leftHandOperand = rightHandOperand;
		rightHandOperand = temp;
	}

	return { operator: comparisons[operator], operands: [leftHandOperand, rightHandOperand] };
}

function compileIf(statement, compiled) {
	if(!statement.children) errorAndExit(`'If' statements must have at least one child.`, statement);

	let orStatements = statement.children.filter(x => x.text.match(/^or/));
	let thenStatement = statement.children.find(x => x.text.match(/^then/));

	if(thenStatement && (!thenStatement.children || thenStatement.children.length !== 1))
		errorAndExit(`"then" statement must have one child and no more`, thenStatement);

	if(orStatements.length && !thenStatement) errorAndExit('"If" statment must have at least one "then" child if "or" children are present.', statement);

	let comparison = compileComparison('if', statement);

	compiled.if = {};
	compiled.if[comparison.operator] = comparison.operands;

	if(orStatements.length) {
		compiled.or = orStatements.map(x => {
			comparison = compileComparison('or', x);
			let newOr = {};
			newOr[comparison.operator] = comparison.operands;
			return newOr;
		});
	}

	compiled.then = {};
	compileStatement(thenStatement ? thenStatement.children[0] : statement.children[0], compiled.then);
}

function compileVariable(statement, compiled) {
	if(statement.children) errorAndExit(`Variable declarations must not have children`, statement);

	let variableName = captureExpression(statement.text, 'named');
	if(!variableName || variableName.variable)  errorAndExit("Variable must have a name and name must not be a variable", statement);

	let variableValue = captureExpression(statement.text, 'is');
	if(!variableValue || variableValue.variable)  errorAndExit("Variable must have a value and value cannot be a variable", statement);

	if(!compiled.variables) compiled.variables = {};
	compiled.variables[variableName.value] = variableValue;
}

function compileTravel(statement, compiled) {
	if(statement.children) errorAndExit(`Travel statements must not have children`, statement);

	let destination = captureExpression(statement.text, 'to');
	if(!destination)  errorAndExit("Travel statement must have a destination", statement);

	compiled.travel = destination;
}

function compileSay(statement, compiled) {
	if(!compiled.say) compiled.say = [];

	let inlineText = captureExpression(statement.text, '');

	if(inlineText) {
		compiled.say.push(inlineText);
		return;
	} else if(!statement.children) {
		errorAndExit("Empty say statement");
	}

	statement.children.forEach(child => {
		let newCommand = {};
		compileStatement(child, newCommand);
		compiled.say.push(newCommand);
	});
}

function compileMove(statement, compiled) {
	let thing = captureExpression(statement.text, 'move');
	if(!thing) errorAndExit("No thing specified to move", statement);

	let destination = captureExpression(statement.text, 'to');
	if(!destination)  errorAndExit("No destination specified", statement);

	compiled.move = [thing, destination];
}

function compilePlayer(statement, compiled) {
	if(statement.children) errorAndExit("Player initialization statements cannot have children");

	let location = captureExpression(statement.text, 'is in');
	if(!location || location.variable) errorAndExit("Player must be initialized with a location and location cannot be a variable");

	if(!compiled['#player']) compiled['#player'] = {};

	compiled['#player'].location = location.value;
}

function compileAnywhere(statement, compiled) {
	if(!statement.children) errorAndExit("Anywhere initialization statement must have children");

	if(!compiled['#anywhere']) compiled['#anywhere'] = {};

	statement.children.forEach(child => {
		compileStatement(child, compiled['#anywhere']);
	});
}

function compileSet(statement, compiled) {
	if(statement.children) errorAndExit("Set statements cannot have children");

	let variable = captureExpression(statement.text, 'set');
	if(!variable || variable.variable) errorAndExit("First operand of set statement must be a variable name and not a variable.", statement);

	let value = captureExpression(statement.text, 'to');
	if(!value) errorAndExit("Set statement must assign a value.", statement);

	compiled.set = [variable, value];
}

let compile = {
	"place": 			compilePlace,
	"do":					compileDo,
	"if":					compileIf,
	"thing":			compileThing,
	"variable": 	compileVariable,
	"travel":			compileTravel,
	"say":				compileSay,
	"move":				compileMove,
	"set":				compileSet,
	"#player":		compilePlayer,
	"#anywhere":	compileAnywhere
}

function compileStatement(statement, compiled) {
	let command = statement.text.split(' ').shift();

	if(!compile[command]) {
		if(captureExpression(statement.text)) {
			compile['say'](statement, compiled);
			return;
		}
		else {
			errorAndExit(`Invalid command '${command}'`, statement);
		}
	}

	compile[command](statement, compiled);
}

(() => {
	let sourceFile = process.argv[2];
	validateFilePath(sourceFile);

	let destinationPath = process.argv[3];

	let source = fs.readFileSync(sourceFile, 'utf8');
	let grouped = groupStatements(source.split('\n'));
	let compiled = {};

	for(let statement of grouped) {
		compileStatement(statement, compiled);
	}

	if(!compiled['#player']) errorAndExit(`Player must be initialized with a location. E.g. "#player is in \`room_name\`"`);
	//console.log(util.inspect(compiled, false, 20));
	console.log(JSON.stringify(compiled));

	if(!destinationPath) {
		let dateNow = new Date();
		destinationPath = `./fateWorld_${dateNow.getFullYear()}-${dateNow.getMonth()}-${dateNow.getDate()}.ftw`;
	}

	fs.writeFileSync(destinationPath, JSON.stringify(compiled));
	process.exit(0);
})();
