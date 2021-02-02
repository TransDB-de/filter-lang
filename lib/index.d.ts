import type { LanguageFilterDictionary } from "./types/internal";
import type * as IntermediateFormat from "./types/abstractFormat";
import * as Lexer from "./parser/lexer.js";
import * as Parser from "./parser/parser.js";
import * as LanguageBuilder from "./languageBuilder/languageBuilder.js";
import * as Compiler from "./compiler/compiler.js";
export type { IntermediateFormat };
export { LanguageBuilder, Lexer, Parser };
export { Compiler };
export { LanguageDefinition, makeLangFilterDictionary } from "./languageBuilder/languageBuilder.js";
export { parse } from "./parser/parser.js";
/**
 * Utility class bundling language definition and parser
 */
export declare class Language {
    filters: LanguageFilterDictionary;
    /**
     * Make a new Language class, which can then be used for parsing a string into an abstract filter format.
     * @param definition custom language definition
     */
    constructor(definition: LanguageBuilder.LanguageDefinition);
    /**
     * Parse a string into an abstract format, according to this languages definition
     * @param input filter string to parse
     */
    parse(input: string): IntermediateFormat.AbstractFilters;
    /**
     * Parse a string for hightlighting and autocompletion. does not output a abstract format
     * @param input filter string to parse
     */
    liveParse(input: string): Parser.Details;
}
