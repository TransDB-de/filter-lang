import type { StringDictionary } from "./types/languageDefinition";
/**
 * changes the keys of a dictrionary object to lower case
 * @param dict
 */
export declare function lowerCaseKeys(dict: StringDictionary): StringDictionary;
/**
 * Deep copies are made to avoid mutating the user input,
 * and to decouple the compiled / parsed data from any potentially mutable data
 * @param obj obj to deep copy
 */
export declare function deepCopy<T>(obj: T): T;
/**
 * Converts a string to a regular expression, with all special RegExp characters escaped
 * @param string string to convert
 * @param flags flags to set on RegExp
 */
export declare function stringToRegex(string: string, flags?: string): RegExp;
