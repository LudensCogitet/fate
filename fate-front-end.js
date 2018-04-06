let fs = require('fs');
let readline = require('readline');

let fate = require('./fate');

let worldObject;

let io = readline.createInterface({
	input: process.stdin,
	output: process.stdout
});

function prompt() {
	io.question('?> ', (command) => {
		let {response, world} = fate.move(command);
		worldObject = world;
		if(command === '#print_world#') {
			console.log(JSON.stringify(worldObject));
		} else if(command === '#exit#') {
			io.close();
			return;
		} else {
			if(response) io.write(response + "\n");
			prompt();
		}
	});
}

fs.readFile(process.argv[2], 'utf8', (err, data) => {
	fate.load(data);

	let {response} = fate.start();
	if(response) io.write(response + "\n");
	prompt();
});
