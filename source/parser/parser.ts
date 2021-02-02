import type { LanguageFilter, LanguageFilterDictionary } from "../types/internal"
import type { AbstractFilters, ArrayCheck } from "../types/abstractFormat"
import type { StringDictionary } from "../types/languageDefinition"
import { Token, tokenize, TokenType } from "./lexer.js";
import { deepCopy } from "../util.js";


export interface Details {
	contexts: {
		range: [number, number],
		name: string,
		open: boolean
	}[]
	autocomplete: string[]
}

function mapValueIfMappable(value: string, map: StringDictionary): string | null {
	if (Object.keys(map).length === 0) return value;
	if (!map[value]) return null;
	return map[value];
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
export function parseTokenized(tokens: Token[], filters: LanguageFilterDictionary, live = false): [AbstractFilters, Details] {
	let aFilter: AbstractFilters = {
		wildcard: [],
		include: [],
		exclude: [],
		arrayIncludes: [],
		arrayExcludes: [],
		compare: {}
	}

	let context: false | LanguageFilter = false;
	let tempLocation: AbstractFilters['location'] = undefined;
	let token: Token = {
		val: "",
		commaSeperated: false,
		length: 0,
		position: 0,
		type: 0
	};

	// live parse details
	let lastContext: false | LanguageFilter = false;
	let details: Details = { contexts: [], autocomplete: [] };
	let contextStart = 0;
	let contextName = "";

	parsingLoop:
	for (let i = 0; i < tokens.length; i++) {

		// live parse details
		if (live) {

			// context switched
			if (context !== lastContext) {
				// context open
				if (lastContext === false) {
					contextName = token.val.slice(0, -1);
					contextStart = token.position;
				}
				// context closed
				else {
					details.contexts.push({
						range: [contextStart, token.position],
						name: contextName,
						open: false
					});
				}
			}

			lastContext = context;
		}

		token = tokens[i];

		// context free parsing
		if (!context) {

			// token which is not a filter, and not in context must be a wildcard
			if (token.type !== TokenType.Filter) {

				aFilter.wildcard.push(token.val);
				continue parsingLoop;

			} else {

				let filterName = token.val.slice(0, -1);

				// valid filter?
				if (filters[filterName]) {

					// context set to specific filter
					context = filters[filterName];
					continue parsingLoop;

				} else {

					// if no filter was found, set to wildcard, just in case
					aFilter.wildcard.push(token.val);
					continue parsingLoop;

				}

			}

		}
		// in context parsing
		else {

			// potential context switch
			if (token.type === TokenType.Filter) {
				
				let filterName = token.val.slice(0, -1);

				// valid filter?
				if (filters[filterName]) {

					// context set to specific filter
					context = filters[filterName];
					continue parsingLoop;

				}

			}

			// context not switched: parse tokens as values
			// loop context types
			typeLoop:
			for (const [type, content] of Object.entries(context)) {

				if (!content) continue typeLoop;

				let val = mapValueIfMappable(token.val, content.mappings);

				// map was provided, but value did not match
				// continuing will try for alias, if there is any
				if (val === null) continue typeLoop;

				if (type.startsWith("include")) {

					if (type.endsWith("not")) {
						aFilter.exclude.push(val);
					} else {
						aFilter.include.push(val);
					}

					// if there is no comma seperation, exit context
					if (!token.commaSeperated) context = false;
					continue parsingLoop;

				} else

				// text eq comparison
				if (type.startsWith("text")) {

					let comparisionKey: "equalTo" | "notEqualTo" = "equalTo";

					if (type.endsWith("not")) {
						comparisionKey = "notEqualTo";
					}

					content.fields.forEach((field: string) => {

						if (!aFilter.compare[field]) aFilter.compare[field] = {};

						aFilter.compare[field][comparisionKey] = val as string;

					});

					// if there is no comma seperation, exit context
					if (!token.commaSeperated) context = false;
					continue parsingLoop;

				} else

				// number comparisons
				if (type.startsWith("number")) {

					let numberVal = parseFloat(val);

					content.fields.forEach((field: string) => {

						// create field if none exists
						if (!aFilter.compare[field]) {
							aFilter.compare[field] = {};
						}

						if (type.endsWith("not")) {
							aFilter.compare[field]["notEqualTo"] = numberVal;
						} else
						if (type.endsWith("smaller")) {
							aFilter.compare[field]["smallerThan"] = numberVal;
						} else
						if (type.endsWith("larger")) {
							aFilter.compare[field]["largerThan"] = numberVal;
						} else {
							aFilter.compare[field]["equalTo"] = numberVal;
						}

					});

					// if there is no comma seperation, exit context
					if (!token.commaSeperated) context = false;
					continue parsingLoop;

				}

				// array all filter
				if (type.startsWith("array")) {

					let key: keyof AbstractFilters = "arrayIncludes";

					if (type.endsWith("not")) {
						key = "arrayExcludes";
					}

					// check for uniqueness
					let entry = aFilter[key].find((check: ArrayCheck) => 
						JSON.stringify(check.fields) === JSON.stringify(content.fields)
					)

					// push or append values
					if (!entry) {
						aFilter[key].push({
							fields: content.fields,
							values: [val]
						});
					} else {
						entry.values.push(val);
					}

					// if there is no comma seperation, exit context
					if (!token.commaSeperated) context = false;
					continue parsingLoop;

				} else

				// date filter
				if (type.startsWith("date")) {

					// replace symbols with spaces
					let timestamp = parseDateStringToTimestamp(val);

					// if timestamp was found
					if (timestamp !== null) {

						// for each affected field, create filter
						content.fields.forEach((field: string) => {

							// if field does not yet exist in abstract filter, create it
							if (!aFilter.compare[field]) aFilter.compare[field] = {};

							if (type.endsWith("-before")) {
								aFilter.compare[field].smallerThan = timestamp as number;
							} else
							if (type.endsWith("-after")) {
								aFilter.compare[field].largerThan = timestamp as number;
							}
							else {
								// when searching for a specific day, check if timestamp is between the start and the end of the day
								aFilter.compare[field].largerThan = timestamp as number;
								aFilter.compare[field].smallerThan = timestamp as number + 86400000; // date + 24h
							}

						});
					}

					// since this type only requires one value, exit the context
					context = false;
					continue parsingLoop;

				} else

				// geo filter
				if (type.startsWith("location")) {

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
						if (tokens[i + 1]?.val === "km") {

							tempLocation.distance = parseFloat(val);
							i++;
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
						context = false;

					}

					continue parsingLoop;

				} else

				// explicit wildcard
				if (type.startsWith("wildcard")) {

					if (type === "wildcard") {
						aFilter.wildcard.push(val);
					} else
					if (type === "wildcard-not") {
						aFilter.wildcard.push("-" + val);
					}

					// if there is no comma seperation, exit context
					if (!token.commaSeperated) context = false;
					continue parsingLoop;

				}

			}

		}

	}

	// live parse details
	// final check: checks for closed contexts, and appends auto completion, based on those contexts
	if (live && token) {

		// add trailing context
		if (lastContext !== false) {
			details.contexts.push({
				range: [contextStart, token.position + token.length],
				name: contextName,
				open: (token.open ? true : false) || token.commaSeperated
			});
		}
		// context just opened, add and mark as open
		else if (context !== false) {
			details.contexts.push({
				range: [token.position, token.length],
				name: token.val.slice(0, -1),
				open: true
			});
		}

		// autocomplete

		let l = details.contexts.length;

		// suggest context value, if final context is open, and the last parsed context is not free
		if (details.contexts[l - 1]?.open && context !== false) {

			// search context mappings for match
			let mappings: string[] = [];
			let key: keyof LanguageFilter;

			// collapse mapping keys into single array
			for (key in context) {
				const filterContent = context[key];

				if (!filterContent) continue;

				mappings = [...mappings, ...Object.keys(filterContent.mappings)];
			}

			// last token has a full match. user allready input a value
			if ( mappings.includes(token.val) ) {

				// suggest something only if the user typed a comma
				if (token.commaSeperated) {
					details.autocomplete = deepCopy(mappings);
				}

			}
			else if (token.open) {
				// return all mappings that start with current last value
				details.autocomplete = mappings.filter(s => s.startsWith(token!.val));
			}
			else {
				// return all possible mappings
				details.autocomplete = deepCopy(mappings);
			}

		}
		// free context, suggest a context
		else if (context === false && token.open) {

			// see if the avalible contexts match anything the user typed
			// if so, add them to autocompletion
			details.autocomplete = Object.keys(filters).filter(s => 
				s.startsWith(token!.val)
			);

		}

		// build autocompletion string
		if (details.autocomplete) {

			// some strings need adjustment. we don't want to suggest, what the user has allready typed
			details.autocomplete = details.autocomplete.map(suggestion => {
				if (suggestion.startsWith(token!.val)) {
					// if partial match, remove overlap
					return suggestion.slice(token!.length - 1);
				} else {
					return suggestion;
				}
			});

			// some suggestions might now be empty, filter them out
			details.autocomplete = details.autocomplete.filter(s => s !== "");

		}

	}

	return [ deepCopy(aFilter), details ];
}

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
