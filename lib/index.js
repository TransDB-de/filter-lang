import * as Lexer from "./parser/lexer.js";
import * as Parser from "./parser/parser.js";
import * as LanguageBuilder from "./languageBuilder/languageBuilder.js";
import * as Compiler from "./compiler/compiler.js";
export { LanguageBuilder, Lexer, Parser };
export { Compiler };
export { makeLangFilterDictionary } from "./languageBuilder/languageBuilder.js";
export { parse } from "./parser/parser.js";
/**
 * Utility class bundling language definition and parser
 */
export class Language {
    /**
     * Make a new Language class, which can then be used for parsing a string into an abstract filter format.
     * @param definition custom language definition
     */
    constructor(definition) {
        this.filters = LanguageBuilder.makeLangFilterDictionary(definition);
    }
    /**
     * Parse a string into an abstract format, according to this languages definition
     * @param input filter string to parse
     */
    parse(input) {
        return Parser.parse(input, this.filters);
    }
    /**
     * Parse a string for hightlighting and autocompletion. does not output a abstract format
     * @param input filter string to parse
     */
    liveParse(input) {
        let tokens = Lexer.tokenize(input);
        let [, details] = Parser.parseTokenized(tokens, this.filters, true);
        return details;
    }
}
