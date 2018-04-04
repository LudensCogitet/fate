let fs = require('fs');

const worldStructure = {
	'#player': {},
	'#anywhere': {},
	'places': {},
	'things': {},
	'variables': {}
}

let pristineWorld;
let world;
let started = false;

let command;
let response = [];

function resolveOperand(operand) {
	if(!operand.hasOwnProperty('value') && !operand.hasOwnProperty('variable')) return false;

	if(operand.value === '#here') return world['#player'].location;
	if(operand.value === '#command') return command;
	if(operand.value) return operand.value;

	if(operand.variable) return resolveOperand(world.variables[operand.variable]);
}

function processIf(subject) {
	if(subject.eq) {
		return resolveOperand(subject.eq[0]) === resolveOperand(subject.eq[1]);
	} else if(subject.neq) {
		return resolveOperand(subject.neq[0]) !== resolveOperand(subject.neq[1]);
	} else if(subject.in) {
		return world.things[resolveOperand(subject.in[0])].location === resolveOperand(subject.in[1]);
	} else if(subject.nin) {
		return world.things[resolveOperand(subject.nin[0])].location !== resolveOperand(subject.nin[1]);
	}
}

function processDo(subject) {
	subject.forEach(x => {
		process(x);
	});
}

function processTravel(subject) {
	let newLocation = resolveOperand(subject);
	world['#player'].location = newLocation;
	command = `look ${newLocation}`;
	process(world.places[newLocation]);
}

function processSay(subject) {
	subject.forEach(x => {
		let value = resolveOperand(x);
		if(value) {
			response.push(value);
			return;
		}
		process(x);
	});
}

function process(subject) {
	let actions = {
		"travel": processTravel,
		"say": processSay,
		//"move": processMove
	};

	if(subject.do)
		processDo(subject.do);
	else if(subject.if && processIf(subject.if))
		process(subject.then);
	else {
		for(let action of Object.keys(actions)) {
			if(subject[action]) {
				actions[action](subject[action]);
				break;
			}
		}
	}
}

function getThingsAtLocation(location) {
	let thingsAtLocation = [];

	let thingNames = Object.keys(world.things);

	thingNames.forEach(thing => {
		if(world.things[thing].location === location)
			thingsAtlocation.push(thing);
	});

	return thingsAtLocation;
}

function load(worldString) {
	pristineWorld = worldString;
	world = Object.assign({}, worldStructure, JSON.parse(worldString));
}

function move(newCommand) {
	if(!world || !started) return;
	command = newCommand;

	let anywhere				= world['#anywhere'];
	let currentPlace 		= world.places[world['#player'].location];
	let localThings			= getThingsAtLocation(world['#player'].location);
	let playerThings		= getThingsAtLocation('#player');

	process(currentPlace);
	localThings.forEach(x => {
		process(world.things[x]);
	});

	playerThings.forEach(x => {
		process(world.things[x]);
	});
	process(anywhere);

	if(!response.length) return false;

	let compiledResponse = response.join(' ');
	response = [];

	return compiledResponse;
}

function start() {
	if(!load) return;
	started = true;

	return move(`look ${world['#player'].location}`);
}

module.exports = { load, move, start }

fs.readFile('./fateWorld_2018-3-3.ftw', 'utf8', (err, result) => {
	load(result);
	start();
	console.log(move('north'));
});
