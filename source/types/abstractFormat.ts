/**
 * Describes a value comparison being made.
 * Compares field value to provided value
 * @see AbstractFilters
 */
export interface Comparison {
	equalTo?: string | number | string[] | number[]
	notEqualTo?: string | number | string[] | number[]
	largerThan?: number
	smallerThan?: number
}

/**
 * Describes a value check preformed on arrays
 * @see AbstractFilters
 */
export interface ArrayCheck {
	/** arrays to test */
	fields: string[]
	/** values to match */
	values: string[]
}

/**
 * The intermediate format for the filter.
 * Suitbale for network transfer
 */
export interface AbstractFilters {
	/** wildcard text search. requires a text index */
	wildcard?: string[]
	/** null-checks. document fields must be present and non-null */
	include?: string[]
	/** inverse null-check. document fields must be absent or null */
	exclude?: string[]
	/** boolean truth check */
	boolTrue?: string[]
	/** boolean false check */
	boolFalse?: string[]
	/** test for values in array (and check) */
	arrayIncludes?: ArrayCheck[]
	/** test for values in array. (not - or check) */
	arrayExcludes?: ArrayCheck[]
	/** compare strings or number */
	compare?: {
		[key: string]: Comparison
	}
	/**
	 * Location filter. One per filter.
	 * Requires you pre-fetch the cooridnates associated to locationName in the backend.
	 * Also requires a geospatial index, with mongoDB.
	 * Costly, use spraingly */
	location?: {
		locationName?: string
		distance?: number
		field?: string
	}
}
