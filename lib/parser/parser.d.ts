import type { LanguageFilterDictionary } from "../types/internal";
import type { AbstractFilters } from "../types/abstractFormat";
import { Token } from "./lexer.js";
import * as Live from "./liveParse.js";
export type { Details } from "./liveParse";
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
export declare function parseTokenized(tokens: Token[], filters: LanguageFilterDictionary, live?: boolean): [AbstractFilters, Live.Details];
