export enum TokenType {
	/** default case. a wildcard or a value */
	String,
	/** something starting with a number */
	Number,
	/** something in quotes */
	QuotedString,
	/** something that ends with ':' */
	Filter
}

export interface Token {
	type: TokenType
	val: string
	/** the tokens position in the input string */
	position: number
	/** length the token takes up in input string */
	length: number
	/** a token at the end of the input string without trailing whitespace. useful for autocompletion */
	open?: true
	/** indicates the user intended to input multiple values */
	commaSeperated: boolean
}

/**
 * Main lexing function
 * @param unparsed 
 * @param langMap 
 */
function getNextToken(unlexed: string, position: number): [Token, string, number] {

	let rest: string;
	let token: Token;

	let type: TokenType = TokenType.String;

	let val = "";
	let segmentLength = 0;
	let trimmed = unlexed.trimStart();
	let open: boolean = false;
	let commaSeperated = false;

	// may be a quoted segment
	if ( /^"/.test(trimmed) ) {

		// determine length of segment by finding unescaped closing quote, or end of string
		segmentLength = trimmed.search(/(?:[^\\]")/) + 2;

		// if closing quote found
		if (segmentLength > 1) {
			type = TokenType.QuotedString;

			val = trimmed.slice(1, segmentLength - 1)
		}

	}

	// not a quoted segemnt
	if (type === TokenType.String) {

		// determine length of segment by finding either whitespace, or unescaped ':'
		segmentLength = trimmed.search(/\S\s|(?:[^\\]:)|.,(?=\s)/) + 2;

		val = trimmed.slice(0, segmentLength) // include trailing char, so we can check for filters


		if (/^[0-9]/.test(val)) {
			type = TokenType.Number;
		}

		if ( val.endsWith(":") ) {
			type = TokenType.Filter;
		} else if ( val.endsWith(",") ) {
			// detect and remove trailing comma
			commaSeperated = true;
			val = val.slice(0, -1);
		} else {
			// might be an open ended string
			open = (trimmed.length === segmentLength);
		}

	}

	rest = trimmed.slice(segmentLength).trimStart();

	// detect spaced comma seperation
	if (rest.startsWith(",")) {
		commaSeperated = true;
		rest = rest.slice(0, 1).trimStart();
	}

	token = {
		type,
		val: val.trim().replace(/\\(?="|:)/g, ''), // remove whitespace and escape chars
		length: val.endsWith(":") || type === TokenType.QuotedString ? segmentLength : segmentLength - 1,
		position,
		commaSeperated
	}

	if (open) {
		token.open = true;
	}

	position += unlexed.length - rest.length;

	return [token, rest, position];

}

/**
 * Pre-processing step.
 * Slices a string into it's seperate parts, tagging them with different properties.
 * Not dependet on language definition.
 * @param input filter string to tokenize
 */
export function tokenize(input: string): Token[] {
	// triling whitespace simplifies lexing
	let unlexed = input.toLowerCase() + " ";
	let lexedTokens: Token[] = [];
	let pos = 0;

	while (unlexed.length !== 0) {
		let nextToken: Token;

		[ nextToken, unlexed, pos ] = getNextToken(unlexed, pos);

		lexedTokens.push( nextToken );
	}

	return lexedTokens;
}
