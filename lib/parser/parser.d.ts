import type { LanguageFilterDictionary } from "../types/internal";
import type { AbstractFilters } from "../types/abstractFormat";
import { Token } from "./lexer.js";
export interface Details {
    contexts: {
        range: [number, number];
        name: string;
        open: boolean;
    }[];
    autocomplete: string[];
}
/**
 * Parse an input string into an abstract form
 * @param input string to parse
 * @param filters internal filter definition. It is not recommended to define your language in this format. use "/langBuilder" instead
 */
export declare function parse(input: string, filters: LanguageFilterDictionary): AbstractFilters;
/**
 * Parse a previously tokenized input
 * @param tokens
 * @param filters
 * @param live live parsing additionally returns details
 */
export declare function parseTokenized(tokens: Token[], filters: LanguageFilterDictionary, live?: boolean): [AbstractFilters, Details];
