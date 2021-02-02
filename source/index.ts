import type {
	LanguageFilterDictionary
} from "./types/internal"

import type * as IntermediateFormat from "./types/abstractFormat"

import * as Lexer from "./parser/lexer.js"
import * as Parser from "./parser/parser.js"
import * as LanguageBuilder from "./languageBuilder/languageBuilder.js"
import * as Compiler from "./compiler/compiler.js"

export type { IntermediateFormat }
export { LanguageBuilder, Lexer, Parser }
export { Compiler }

export { LanguageDefinition, makeLangFilterDictionary } from "./languageBuilder/languageBuilder.js"
export { parse } from "./parser/parser.js"


/**
 * Utility class bundling language definition and parser
 */
export class Language {
	public filters: LanguageFilterDictionary;

	/**
	 * Make a new Language class, which can then be used for parsing a string into an abstract filter format.
	 * @param definition custom language definition
	 */
	constructor(definition: LanguageBuilder.LanguageDefinition) {
		this.filters = LanguageBuilder.makeLangFilterDictionary(definition);
	}

	/**
	 * Parse a string into an abstract format, according to this languages definition
	 * @param input filter string to parse
	 */
	public parse(input: string): IntermediateFormat.AbstractFilters {
		return Parser.parse(input, this.filters);
	}

	/**
	 * Parse a string for hightlighting and autocompletion. does not output a abstract format
	 * @param input filter string to parse
	 */
	public liveParse(input: string): Parser.Details {
		let tokens = Lexer.tokenize(input);
		let [ , details ] = Parser.parseTokenized(tokens, this.filters, true);
		return details;
	}
}
