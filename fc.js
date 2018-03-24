let fs = require('fs');
let util = require('util');

function capture(text, regex) {
	let match = text.match(regex);
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

function removeEmptyLines(lines) {
	for(let i = 0; i < lines.length; i++) {
		if(!lines[i]) lines.splice(i, 1);
	}

	return lines;
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

function compileStatements(lines) {
	let statements = [];
	let currentObject;
	lines.forEach((line, i) => {
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

function compileRoom(statement, compiled) {
	if(!statement.children) errorAndExit("Empty 'room' statement", statement);

	let roomName = capture(statement.text, /'(.*)'/);
	if(!roomName) errorAndExit("Room has no name", statement);

	let newRoom = {};

	statement.children.forEach(child => {
		compileStatement(child, newRoom);
	});

	if(!compiled.rooms) compiled.rooms = {};
	compiled.rooms[roomName] = newRoom;
}

function compileDo(statement, compiled) {
	if(!statement.children) errorAndExit("Empty 'do' statement", statement);

	if(!compiled.do) compiled.do = []
	compiled.do.push(statement.children);
}

let compile = {
	"room": compileRoom,
	"do":		compileDo
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
	let grouped = compileStatements(assignLayers(removeEmptyLines(source.split('\n'))));
	let compiled = {};

	for(let statement of grouped) {
		compileStatement(statement, compiled);
	}

	console.log(compiled)

	process.exit(0);
})();
