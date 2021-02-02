/**
 * Flat object mapping string to other strings
 */
export interface StringDictionary {
	[name: string]: string
}

/**
 * Defines a single filter, which users can input.
 * See properties, for detailed usage.
 */
export interface FilterDefinition {
	/**
	 * In language name of the filter.
	 * Ommiting name, turns all mappings into names.
	 * */
	name?: string

	/**
	 * In langauge negationSuffix.
	 * 
	 * @example
	 * // FilterDefinition
	 * {
	 *   name: "has",
	 *   negationSuffix: "no",
	 *   field: "color"
	 * }
	 * 
	 * // filter usage
	 * 'has-no: red'
	 */
	negationSuffix?: string

	/**
	 * type of filter
	 * 
	 * @value "text" : case-insensitive text comparison
	 * @value "include" : field null check
	 * @value "exclude" : opposite of include
	 * @value "array-contains" : array search. all values must be found in array, for match to occur
	 * @value "date-compare" : attempts to date-convert provided value.
	 * use the "suffixes" field to provide 3 suffixes in the order: ["=", "<" ">"]
	 * @value "number" : compares number values. optionally, use the "suffixes" field to provide up to 3 custom suffixes
	 * @value "location" : location filter by postal code and distance in km
	 * @value "wildcard" : free text search. only useful if default wildcard behaviour is turned of
	 * @value "wildcard-not" : boolean NOT for wildcards
	 */
	type: "text"
		| "text-not"
		| "include"
		| "include-not"
		| "array-contains"
		| "array-contains-not"
		| "date-compare"
		| "date-compare-before"
		| "date-compare-after"
		| "number"
		| "number-not"
		| "number-larger"
		| "number-smaller"
		| "location"
		| "wildcard"
		| "wildcard-not"

	/** single affected data field. alias to { fields: [string] } */
	field?: string

	/** multiple affected data fields */
	fields?: string[]

	/**
	 * Used for type "date-compare", and "number"
	 * Enter the suffixes in the format ["=", "<", ">"].
	 * When omitted, filter will be treated as equals comparision.
	 * 
	 * @example
	 * {
	 *   name: "created",
	 *   type: "date-compare",
	 *   suffixes: ["on", "before", "after"],
	 *   field: "createdTimestamp"
	 * }
	 */
	suffixes?: [string, string, string]

	/**
	 * Flat object with language to data mappings.
	 * 
	 * @example
	 * // Mapping
	 * {
	 *   "farbe": "color",
	 *   "alter": "age",
	 *   "stadt": "address.city"
	 * }
	 */
	mappings?: StringDictionary
}

/**
 * An array of Filter Definitions, which defines the entire language.
 */
export interface LanguageDefinition extends Array<FilterDefinition> {}
