let modifiers = {
	'plus': 'add',
	'minus': 'subtract',
	'divided by': 'divide',
	'multiplied by': 'multiply',
	'remainder of division by': 'modulo'
};

function captureModifier(text, operand) {
	for(let modifier of Object.keys(modifiers)) {
		let match = text.match(new RegExp(`${operand}\\s\(${modifier}.*\)`));
		if(match && match.length) {
			return captureExpression(match[1], modifier);
		}
	}
}

function captureExpression(text, symbol = '') {
	let regex = [
			new RegExp(`${symbol}\\W\\\`(.*?)\\\``),
			new RegExp(`${symbol}\\W\\\$(.*?)\\\$`),
			new RegExp("^`(.*?)`"),
			new RegExp("^\\\$(.*?)\\\$"),
			new RegExp(`${symbol}\\s(.*?)(\\s|$)`)
	];

	for(let i = 0; i < regex.length; i++) {
		let match = text.match(regex[i]);
		if(match && match.length > 1) {
			let modifier = captureModifier(text, match[0]);
			let expression = {};
			if(modifier) express.modifier = modifier;

			switch(i) {
				case 0:
				case 2:
				case 4:
					expression.value = match[1];
					return expression;
				case 1:
				case 3:
					expression.variable = match[1]
					return expression;
			}
		}
	}

	return null;
}

let phrase = "if #turn (remainder of division by 10) is timeCycleLength (divided by 2)";

let match = captureExpression(phrase, 'if');

console.log(match);
