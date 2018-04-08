function escapeSymbol(symbol) {
	return symbol.replace(/\$/g, "\\$").replace(/\|/g, "\\|").trim();
}

function captureModifier(text, symbol) {
	symbol = escapeSymbol(symbol);
	let modifiers = {
		'plus': 'add',
		'minus': 'subtract',
		'divided by': 'divide',
		'multiplied by': 'multiply',
		'remainder of division by': 'modulo'
	};

	for(let modifier of Object.keys(modifiers)) {
		let match = text.match(new RegExp(`.*${symbol}\\s${modifier}.*`));
		if(match) {
			return {operation: modifiers[modifier], operand: captureExpression(text, modifier)};
		}
	}
}

function captureExpression(text, symbol = '') {
	symbol = escapeSymbol(symbol);
	let regex = [
			new RegExp(`${symbol}\\s\\\`(.*?)\\\``),
			new RegExp(`${symbol}\\s\\\$(.*?)\\\$`),
			new RegExp("^`(.*?)`"),
			new RegExp("^\\\$(.*?)\\\$"),
			new RegExp(`${symbol}\\s(.*?)(\\s|$)`)
	];

	for(let i = 0; i < regex.length; i++) {
		let match = text.match(regex[i]);
		if(match && match.length > 1) {
			console.log(match)
			let modifier = captureModifier(text, match[0]);
			let expression = {};
			if(modifier) expression.modifier = modifier;

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

let phrase = "if $#turn$ remainder of division by 5 is 5 divided by 2";

let match = captureExpression(phrase, 'if');

console.log(match);
