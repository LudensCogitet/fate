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
let playerMoved = false;

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
	playerMoved = true;
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

function processMove(subject) {
	let thing = resolveOperand(subject[0]);
	let destination = resolveOperand(subject[1]);

	if(thing === '#player')
		world[thing].location = destination;
	else
	 	world.things[thing].location = destination;
}

function processSet(subject) {
	world.variables[resolveOperand(subject[0])] = subject[1];
}

function process(subject) {
	let actions = {
		"travel": processTravel,
		"say": processSay,
		"move": processMove,
		"set": processSet
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

	for(let thing of thingNames) {
		if(world.things[thing].location === location)
			thingsAtLocation.push(thing);
	}

	return thingsAtLocation;
}

function checkPlayerMoved() {
	if(!playerMoved) return;
	playerMoved = false;
	command = 'look';
	process(world.places[world['#player'].location]);
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

	checkPlayerMoved();

	let compiledResponse = response.join(' ');

	response = [];

	return {response: compiledResponse, world: world};
}

function start() {
	if(!world) return;
	started = true;

	return move(`look`);
}

module.exports = { load, move, start }
