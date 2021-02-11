import type { StringDictionary } from "./types/languageDefinition"

/**
 * changes the keys of a dictrionary object to lower case
 * @param dict 
 */
export function lowerCaseKeys(dict: StringDictionary): StringDictionary {

	let key, keys = Object.keys(dict);
	let n = keys.length;
	let newDict: StringDictionary = {};

	while (n--) {
		key = keys[n];
		newDict[key.toLowerCase()] = dict[key];
	}

	return newDict;

}

/**
 * Deep copies are made to avoid mutating the user input,
 * and to decouple the compiled / parsed data from any potentially mutable data
 * @param obj obj to deep copy
 */
export function deepCopy<T>(obj: T): T {
	if (obj === undefined || obj === null) return obj;
	return JSON.parse(JSON.stringify( obj ));
}

/**
 * Converts a string to a regular expression, with all special RegExp characters escaped
 * @param string string to convert
 * @param flags flags to set on RegExp
 */
export function stringToRegex(string: string, flags?: string): RegExp {
	let escapedStr = string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
	return new RegExp(`^${escapedStr}$`, flags);
}
