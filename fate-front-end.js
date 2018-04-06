let fs = require('fs');
let readline = require('readline');

let fate = require('./fate');

let worldObject;
let lastResponse;

let aliases = {};

function processAliases(response) {
	let matches = response.match(/\{.*\|.*\}/g);
	if(!matches) return response;

	matches.forEach(match => {
		let parts = match.substr(1).slice(0, -1).split('|');
		response = response.replace(match, parts[0]);
		aliases[parts[0]] = parts[1];
	});

	return response;
}

let io = readline.createInterface({
	input: process.stdin,
	output: process.stdout
});

function prompt() {
	io.question('?> ', (command) => {
		for(let word of command.split(' ')) {
			let alias = aliases[word];
			if(alias) command = command.replace(word, alias);
		}
		if(command === '#print_world#') {
			console.log(JSON.stringify(worldObject));
		} else if(command === '#exit#') {
			io.close();
			return;
		}

		let {response, world} = fate.move(command);

		lastResponse = response;
		worldObject = world;
		if(response) io.write(processAliases(response) + "\n");

		prompt();
	});
}

fs.readFile(process.argv[2], 'utf8', (err, data) => {
	fate.load(data);

	let {response, world} = fate.start();
	worldObject = world;
	if(response) io.write(response + "\n");
	prompt();
});
