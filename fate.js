let pristineWorld;
let world;
let started = false;

let command;
let response = [];
let playerMoved = false;
let actionTaken = false;

function resolveOperand(operand) {
	if(!operand.hasOwnProperty('value') && !operand.hasOwnProperty('variable')) return false;

	if(operand.value === '#here') return world.things['#player'].location;
	if(operand.value === '#command') return command;
	if(operand.value) return operand.value;

	if(operand.variable) return resolveOperand(world.variables[operand.variable]);
}

function processIf(subject) {
	let comparisons = [subject.if];
	let results = [];
	if(subject.or) comparisons = comparisons.concat(subject.or);

	for(let comparison of comparisons) {
		if(comparison.eq) {
			results.push(resolveOperand(comparison.eq[0]) === resolveOperand(comparison.eq[1]));
		} else if(comparison.neq) {
			results.push(resolveOperand(comparison.neq[0]) !== resolveOperand(comparison.neq[1]));
		} else if(comparison.in) {
			results.push(world.things[resolveOperand(comparison.in[0])].location === resolveOperand(comparison.in[1]));
		} else if(comparison.nin) {
			results.push(world.things[resolveOperand(comparison.nin[0])].location !== resolveOperand(comparison.nin[1]));
		}
	}

	return results.some(x => x);
}

function processDo(subject) {
	subject.forEach(x => {
		process(x);
	});
}

function processTravel(subject) {
	let newLocation = resolveOperand(subject);
	world.things['#player'].location = newLocation;
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

	world.things[thing].location = destination;
}

function processSet(subject) {
	world.variables[resolveOperand(subject[0])] = subject[1];
}

function processAction(subject) {
	let actions = {
		"travel": processTravel,
		"say": processSay,
		"move": processMove,
		"set": processSet
	};

	for(let action of Object.keys(actions)) {
		if(subject[action]) {
			actionTaken = true;
			actions[action](subject[action]);
			break;
		}
	}
}

function process(subject) {
	if(subject.do)
		processDo(subject.do);
	else if(subject.if && processIf(subject))
		process(subject.then);
	else {
		processAction(subject);
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
	command = '#enter';
	process(world.places[world.things['#player'].location]);
}

function filterCommand(newCommand) {
	return newCommand;
}

function load(worldString) {
	pristineWorld = worldString;
	world = JSON.parse(worldString);
}

function move(newCommand) {
	if(!world || !started) return;

	if(world.settings.keywords) {
		command = filterCommand(newCommand);
	} else {
		command = newCommand;
	}

	let anywhere				= world['#anywhere'];
	let currentPlace 		= world.places[world.things['#player'].location];
	let localThings			= getThingsAtLocation(world.things['#player'].location);
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

	if((!world.settings.registerTurn || world.settings.registerTurn === 'input') || actionTaken) {
				actionTaken = false;
				world.variables['#turn'].value = ((+world.variables['#turn'].value) + 1) + ''
	}

	return {response: compiledResponse, world: world};
}

function start() {
	if(!world) return;
	started = true;

	return move(`#enter`);
}

module.exports = { load, move, start }
