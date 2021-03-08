import type { LanguageFilter, LanguageFilterDictionary } from "../types/internal"
import type { AbstractFilters, ArrayCheck, Comparison } from "../types/abstractFormat"
import type { StringDictionary } from "../types/languageDefinition"

import { Token, tokenize, TokenType } from "./lexer.js"
import { deepCopy } from "../util.js"
import * as Live from "./liveParse.js"

export type { Details } from "./liveParse"


/**
 * @internal
 * Hold various information about the current parsing state
 */
export interface ParsingContext {
	/** the filter which is currently being parsed, or nothing */
	currentContext: false | LanguageFilter
	/** holds a temporary location object, so it is not attached to the abstract filter prematurley */
	tempLocation: AbstractFilters['location']
	/** token currently being parsed */
	token: Token
	/** all parsable tokens */
	tokens: readonly Token[]
	/** abstract parsed form, being filled by the parser */
	aFilter: AbstractFilters
	filters: LanguageFilterDictionary
	/** current position in tokens */
	iteration: number
}

/**
 * Parse an input string into an abstract form
 * @param input string to parse
 * @param filters internal filter definition. It is not recommended to define your language in this format. use "/langBuilder" instead
 */
export function parse(input: string, filters: LanguageFilterDictionary): AbstractFilters {
	let tokens = tokenize(input);
	let [ parsed ] = parseTokenized(tokens, filters);
	return parsed;
}

/**
 * Parse a previously tokenized input
 * @param tokens 
 * @param filters 
 * @param live live parsing additionally returns details
 */
export function parseTokenized(tokens: Token[], filters: LanguageFilterDictionary, live = false): [AbstractFilters, Live.Details] {
	let ctx: ParsingContext = {
		currentContext: false,
		tempLocation: undefined,
		token: {
			val: "",
			commaSeperated: false,
			length: 0,
			position: 0,
			type: 0
		},
		aFilter: {
			wildcard: [],
			include: [],
			exclude: [],
			boolTrue: [],
			boolFalse: [],
			arrayIncludes: [],
			arrayExcludes: [],
			compare: {}
		},
		filters,
		tokens,
		iteration: 0
	}

	// live parse details
	let liveCtx: Live.LiveContext = {
		lastContext: false,
		details: { contexts: [], autocomplete: [], openQuote: false },
		contextStart: 0,
		contextName: "",
		openVal: ""
	}

	for (let i = 0; i < tokens.length; i++) {

		ctx.iteration = i;

		ctx.token = tokens[i];

		if (live) {
			liveCtx = Live.beforeParse(ctx, liveCtx);
		}

		if (ctx.currentContext) {
			ctx = parseInContext(ctx);
		} else {
			ctx = parseContextFree(ctx);		
		}

		if (live) {
			liveCtx = Live.afterParse(ctx, liveCtx);
		}

	}

	let details = liveCtx.details;

	if (live && ctx.token) {
		details = Live.finalLivePass(ctx, liveCtx);
	}

	return [ deepCopy(ctx.aFilter), details ];
}

/** Parses a date string to a timestamp, assuming some form of d m y format */
function parseDateStringToTimestamp(date: string): number | null {
	date = date.replace(/-|\/|\\|\.|_|,/g, " ");
	let match = date.match(/[0-9]{1,4}/g);

	if (match === null) {
		return null;
	}

	let [ d, m, y ] = match;
	y = y ?? new Date().getFullYear();

	if (!m) {
		return null;
	}

	if (y.length < 4) {
		let full = new Date().getFullYear().toString();
		y = `${full.slice(0, -2)}${y.slice(-2)}`;
	}

	if (d.length < 2) {
		d = "0" + d;
	}

	if (m.length < 2) {
		m = "0" + m;
	}
	
	// Date.parse works best if the date is in the format yyyy-mm-dd
	return Date.parse(`${y}-${m.slice(-2)}-${d.slice(-2)}`);
}

/** with no currentContext provided, search for one, or parse values as wildcards */
function parseContextFree(ctx: ParsingContext): ParsingContext {

	let { aFilter, currentContext } = ctx;
	const { token, filters } = ctx;

	// token which is not a filter, and not in context must be a wildcard
	if (token.type !== TokenType.Filter) {

		if (token.val !== "") {
			aFilter.wildcard!.push(token.val);
		}

		return { ...ctx, aFilter };

	} else {

		let filterName = token.val.slice(0, -1);

		// valid filter?
		if (filters[filterName]) {

			// context set to specific filter
			currentContext = filters[filterName];
			return { ...ctx, aFilter, currentContext };

		} else if (token.val !== "") {

			// if no filter was found, set to wildcard, just in case
			aFilter.wildcard!.push(token.val);
			return { ...ctx, aFilter };

		} else {
			return { ...ctx };
		}

	}

}

/** Check the provided map, if the given value should be converted */
function mapValueIfMappable(value: string, map: StringDictionary): string | null {
	if (Object.keys(map).length === 0) return value;
	if (!map[value]) return null;
	return map[value];
}

/** Treat the values to parse as values belonging to the current context, and check if the context needs to be kept, or cleared */
function parseInContext(ctx: ParsingContext): ParsingContext {

	let { currentContext } = ctx;
	const { token, filters } = ctx;

	// lexer marked this token as a filter:
	// potential context switch
	if (token.type === TokenType.Filter) {
					
		let filterName = token.val.slice(0, -1);

		// valid filter?
		if (filters[filterName]) {

			// currentContext set to specific filter
			currentContext = filters[filterName];
			return { ...ctx, currentContext };

		}

	}

	let { aFilter } = ctx;

	// context was not switched: parse tokens as values
	// loop types stored in current context, to find the correct type to apply
	for (const [type, content] of Object.entries(currentContext)) {

		// if this type has no content, we can safely skip it
		if (!content) continue;

		let val = mapValueIfMappable(token.val, content.mappings);

		// map was provided, but value did not match
		// next loop will try to match alias, if there is one
		if (val === null) continue;

		// ===== Context Parsing =====

		// ----- Includes -----

		if (type.startsWith("include")) {

			if (type.endsWith("not")) {
				aFilter.exclude!.push(val);
			} else {
				aFilter.include!.push(val);
			}

			// if there is no comma seperation, exit context
			if (!token.commaSeperated) currentContext = false;
			return {...ctx, aFilter, currentContext };

		} else

		// ----- Text Match -----

		if (type.startsWith("text")) {

			let comparisonKey: "equalTo" | "notEqualTo" = "equalTo";

			if (type.endsWith("not")) {
				comparisonKey = "notEqualTo";
			}

			content.fields.forEach((field: string) => {

				if (!aFilter.compare![field]) aFilter.compare![field] = {};

				let cField = aFilter.compare![field][comparisonKey] as string | string[] | undefined;

				if (cField === undefined) {
					cField = val as string;
				} else {

					if (!Array.isArray(cField)) {
						cField = [ cField ];
					}

					cField.push(val as string);

				}

				aFilter.compare![field][comparisonKey] = cField;

			});

			// if there is no comma seperation, exit context
			if (!token.commaSeperated) currentContext = false;
			return { ...ctx, aFilter, currentContext };

		} else

		// ----- Numerical Comparison -----

		if (type.startsWith("number")) {

			let numberVal = parseFloat(val);

			let comparisonKey: keyof Comparison = "equalTo";

			if (type.endsWith("not")) {
				comparisonKey = "notEqualTo";
			} else
			if (type.endsWith("smaller")) {
				comparisonKey = "smallerThan";
			} else
			if (type.endsWith("larger")) {
				comparisonKey = "largerThan";
			}

			content.fields.forEach((field: string) => {

				// create field if none exists
				if (!aFilter.compare![field]) {
					aFilter.compare![field] = {};
				}

				let cField = aFilter.compare![field][comparisonKey] as number | number[] | undefined;

				if ((comparisonKey === "equalTo" || comparisonKey === "notEqualTo") && cField !== undefined) {

					if (!Array.isArray(cField)) {
						cField = [ cField ]
					}

					cField.push(numberVal);
					
					aFilter.compare![field][comparisonKey] = cField;
				} else {
					aFilter.compare![field][comparisonKey] = numberVal;
				}

			});

			// if there is no comma seperation, exit context
			if (!token.commaSeperated) currentContext = false;
			return { ...ctx, aFilter, currentContext };

		} else

		// ----- Array Inclusion -----

		if (type.startsWith("array")) {

			let key: keyof AbstractFilters = "arrayIncludes";

			if (type.endsWith("not")) {
				key = "arrayExcludes";
			}

			// check for uniqueness
			let entry = aFilter[key]!.find((check: ArrayCheck) => 
				JSON.stringify(check.fields) === JSON.stringify(content.fields)
			)

			// append values or push values
			if (!entry) {
				aFilter[key]!.push({
					fields: content.fields,
					values: [val]
				});
			} else {
				entry.values.push(val);
			}

			// if there is no comma seperation, exit context
			if (!token.commaSeperated) currentContext = false;
			return { ...ctx, aFilter, currentContext };

		} else

		// ----- Date Comparison -----

		if (type.startsWith("date")) {

			// replace symbols with spaces
			let timestamp = parseDateStringToTimestamp(val);

			// if timestamp was found
			if (timestamp !== null) {

				// for each affected field, create filter
				content.fields.forEach((field: string) => {

					// if field does not yet exist in abstract filter, create it
					if (!aFilter.compare![field]) aFilter.compare![field] = {};

					if (type.endsWith("-before")) {
						aFilter.compare![field].smallerThan = timestamp as number;
					} else
					if (type.endsWith("-after")) {
						aFilter.compare![field].largerThan = timestamp as number;
					}
					else {
						// when searching for a specific day, check if timestamp is between the start and the end of the day
						aFilter.compare![field].largerThan = timestamp as number;
						aFilter.compare![field].smallerThan = timestamp as number + 86400000; // date + 24h
					}

				});
			}

			// since this type only requires one value, exit the context
			currentContext = false;
			return { ...ctx, aFilter, currentContext };

		} else

		// ----- Location Perimiter Search -----

		if (type.startsWith("location")) {

			let { tempLocation, iteration } = ctx;
			const { tokens } = ctx;

			// we use the temp location to avoid the case of a user only inputting a distance, without a location
			if (!tempLocation) {
				tempLocation = {}
			}

			let distanceFound = false;

			// if the lexer thinks this token might be a number, check for distance suffix
			if (token.type === TokenType.Number) {

				if (val.endsWith("km")) {

					tempLocation.distance = parseFloat(val);
					distanceFound = true;

				} else
				// suffix found as next token. add val as distance, and skip next token, by incrementing index
				if (tokens[iteration + 1]?.val === "km") {

					tempLocation.distance = parseFloat(val);
					iteration += 1;
					distanceFound = true;

				}

			}

			// if value was not a distance, set it as a location name
			if (!tempLocation.locationName && !distanceFound) {
				tempLocation.locationName = val;
			}

			// location name set and no further inputs indicated by comma seperation:
			if (tempLocation.locationName && !token.commaSeperated) {

				// add location to abstract and free context
				aFilter.location = tempLocation;
				aFilter.location.field = content.fields[0];
				currentContext = false;

			}

			return { ...ctx, aFilter, currentContext, tempLocation, iteration };

		} else

		// ----- Boolean Comparison -----

		if (type.startsWith("boolean")) {

			if (type.endsWith("not")) {
				aFilter.boolFalse!.push(val);
			} else {
				aFilter.boolTrue!.push(val);
			}

			// if there is no comma seperation, exit context
			if (!token.commaSeperated) currentContext = false;
			return {...ctx, aFilter, currentContext };

		} else

		// ----- Explicit Wildcard -----

		if (type.startsWith("wildcard")) {

			if (type === "wildcard" && val !== "") {
				aFilter.wildcard!.push(val);
			} else
			if (type === "wildcard-not" && val !== "") {
				aFilter.wildcard!.push("-" + val);
			}

			// if there is no comma seperation, exit context
			if (!token.commaSeperated) currentContext = false;
			return { ...ctx, aFilter, currentContext };

		}

	}

	// all types looped, no match found, as function did not return
	// likely a typo.
	// add token as wild-card just in case
	aFilter.wildcard!.push(token.val);

	// if there is no comma seperation, exit context
	if (!token.commaSeperated) currentContext = false;

	return { ...ctx, aFilter, currentContext };

}
