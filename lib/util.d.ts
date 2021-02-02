import type { StringDictionary } from "./types/languageDefinition";
export declare function lowerCaseKeys(dict: StringDictionary): StringDictionary;
/**
 * Deep copies are made to avoid mutating the user input,
 * and to decouple the compiled / parsed data from any potentially mutable data
 * @param obj obj to deep copy
 */
export declare function deepCopy<T>(obj: T): T;
