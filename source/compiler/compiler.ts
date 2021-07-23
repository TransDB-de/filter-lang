import type { AbstractFilters, ArrayCheck } from "../types/abstractFormat"
import { stringToRegex } from "../util.js";


/** simple aggregation pipeline friendly object */
interface iDictionary {
	[key: string]: string | number | null | iDictionary | RegExp | boolean | string[] | number[] | iDictionary[] | RegExp[] | boolean []
}

interface GeoJsonPoint {
	type: "Point", coordinates: [number, number]
}

/**
 * @internal
 * Compiler context
 * Passed to internal functions, to simplify parameters and returns.
 */
interface Context { 
	pipeline: object[]
	queries: object[]
	injectedStages?: InjectedStages
}

/**
 * Stages to inject in front of field access, for spcific fields, referenced by key.
 * 
 * Required when querying fields that might no yet exist (eg. manually referenced fields).
 * Each Stage is only injected once.
 * 
 * Prefer stage injection, over appending a lookup manually,
 * as the stages are only injected when needed, and are injected as late as possible,
 * making the pipeline more preformant on average.
 */
export interface InjectedStages {
	[fieldName: string]: iDictionary[]
}


/**
 * Replace the value of a field defined by the key, with the return value of a function.
 * 
 * Usefull for transforming strings into mongoDB id objects.
 * Only works for text type filters.
 */
export interface Replacer {
	[fieldName: string]: (value: string) => any
}


interface NamedParams {
	intermediateForm: AbstractFilters,
	injectedStages?: InjectedStages,
	alwaysInject?: string[],
	location?: GeoJsonPoint,
	replacer?: Replacer
}


/**
 * Compiles a filter to a mongoDB aggregation pipeline, which can be further modified, or used directly, to get the filtered documents.
 * Throws an error, if compiling failed (eg. bad input).
 * For security concerns, it is not recommended to do this client side
 * 
 * @param intermediateForm parsed filter
 * @param injectedStages a object containing custom stages to inject in front of specific fields. Useful for $lookup, $set or $project. Only used fields are injected
 * @param alwaysInject string array containing keys of injected stages to always inject. If no filter required the injected stage, it will be injected at the very end
 * @param location prefetched location coordinates. Required when using a location filter. Fetch cooridantes of "location.locationName"
 * @param fieldReplacer replace the filter value of a field with the return value of a function
 */
export function compileToMongoDB(params: {
	intermediateForm: AbstractFilters,
	injectedStages?: InjectedStages,
	alwaysInject?: string[],
	location?: GeoJsonPoint,
	replacer?: Replacer
}): object[]
export function compileToMongoDB(intermediateForm : AbstractFilters, injectedStages?: InjectedStages, alwaysInject?: string[], location?: GeoJsonPoint, replacer?: Replacer ): object[]
export function compileToMongoDB(formOrParams : AbstractFilters | NamedParams, injectedStages?: InjectedStages, alwaysInject?: string[], location?: GeoJsonPoint, replacer?: Replacer ): object[] {

	let intermediateForm: AbstractFilters;

	if ('intermediateForm' in formOrParams) {
		intermediateForm = formOrParams.intermediateForm;
		injectedStages = formOrParams.injectedStages;
		alwaysInject = formOrParams.alwaysInject;
		location = formOrParams.location;
		replacer = formOrParams.replacer;
	} else {
		intermediateForm = formOrParams;
	}

	let sortStage: object | null = null;

	let ctx: Context = {
		pipeline: [],
		queries: [],
		injectedStages: injectedStages
	}

	// Wildcards
	if (intermediateForm.wildcard && intermediateForm.wildcard.length > 0) {

		assertPrimitiveArray(intermediateForm.wildcard);

		let wildcardString = intermediateForm.wildcard.join(" ");

		let searchStage = {
			$text: {
				$search: wildcardString
			}
		}

		sortStage = {
			$sort: {
				score: { $meta: "textScore" },
				_id: -1
			}
		}

		ctx.pipeline.push({
			$match: searchStage
		});

	}

	// Includes
	if (intermediateForm.include && intermediateForm.include.length > 0) {

		let includes: object[] = [];

		intermediateForm.include.forEach(field => {
			assertPrimitive(field); 

			injectStages(field, ctx);

			let include: iDictionary = {};
			include[field] = { $ne: null };
			includes.push(include);
		});

		ctx.queries = [...ctx.queries, ...includes];
	}

	// Excludes
	if (intermediateForm.exclude && intermediateForm.exclude.length > 0) {

		let excludes: object[] = [];

		intermediateForm.exclude.forEach(field => {
			assertPrimitive(field);

			injectStages(field, ctx);

			let exclude: iDictionary = {};
			exclude[field] = null;
			excludes.push(exclude);
		});

		ctx.queries = [...ctx.queries, ...excludes];
	}

	// Boolean True
	if (intermediateForm.boolTrue && intermediateForm.boolTrue.length > 0) {

		let boolTrues: object[] = [];

		intermediateForm.boolTrue.forEach(field => {
			assertPrimitive(field);

			injectStages(field, ctx);

			let bTrue: iDictionary = {};
			bTrue[field] = true;
			boolTrues.push(bTrue);
		});

		ctx.queries = [...ctx.queries, ...boolTrues];
	}

	// Boolean False
	if (intermediateForm.boolFalse && intermediateForm.boolFalse.length > 0) {

		let boolFalses: object[] = [];

		intermediateForm.boolFalse.forEach(field => {
			assertPrimitive(field);

			injectStages(field, ctx);

			let bFalse: iDictionary = {};
			bFalse[field] = false;
			boolFalses.push(bFalse);
		});

		ctx.queries = [...ctx.queries, ...boolFalses];
	}

	// Array includes
	if (intermediateForm.arrayIncludes && intermediateForm.arrayIncludes.length > 0) {

		let matches: object[] = [];

		intermediateForm.arrayIncludes.forEach(arrInclude => {
			let selector = makeArraySelector(arrInclude, true, ctx);

			matches.push( selector );
		});

		ctx.queries = [...ctx.queries, ...matches];
	}

	// Array excludes
	if (intermediateForm.arrayExcludes && intermediateForm.arrayExcludes.length > 0) {

		let matches: object[] = [];

		intermediateForm.arrayExcludes.forEach(arrExclude => {
			let selector = makeArraySelector(arrExclude, false, ctx);

			matches.push( selector );
		});

		ctx.queries = [...ctx.queries, ...matches];
	}

	// Comparators
	if ( intermediateForm.compare && Object.keys(intermediateForm.compare).length > 0) {

		let matches: object[] = [];

		for (const [field, comparison] of Object.entries(intermediateForm.compare)) {
			let match: iDictionary = {};

			if (replacer && comparison.equalTo && typeof comparison.equalTo === 'string' && field in replacer) {
				match = replacer[field](comparison.equalTo);
			} else {
				match = checkAndAssign(comparison.equalTo, match, ["$eq", "$regex"], "$in");
				match = checkAndAssign(comparison.notEqualTo, match, "$ne", "$nin");
				match = checkAndAssign(comparison.largerThan, match, "$gt");
				match = checkAndAssign(comparison.smallerThan, match, "$lt");
			}

			if ( Object.keys(match).length === 0 ) continue;

			injectStages(field, ctx);

			let obj: iDictionary = {};
			obj[field] = match;

			matches.push(obj);

		}

		ctx.queries = [...ctx.queries, ...matches];

	}

	// Location
	if (intermediateForm.location
		&& location
	) {
		
		let distance = intermediateForm.location.distance ?? 10;

		assertPrimitive(distance);

		// geoNear query
		if (!sortStage && ctx.pipeline.length === 0) {

			ctx.pipeline.unshift({
				$geoNear: {
					near: location,
					distanceField: "distance",
					maxDistance: distance * 1000
				}
			});

			sortStage = {
				$sort: { distance: 1 }
			};

		}
		// geoWithin match
		else if (intermediateForm.location.field) {

			assertPrimitive(intermediateForm.location.field);

			let radians = distance / 6371;

			insertStagedQueriesIntoPipeline(ctx);

			let obj: any = {};
			obj[intermediateForm.location.field] = {
				$geoWithin: {
					$centerSphere: [ location.coordinates , radians]
				}
			}

			ctx.pipeline.push({
				$match: obj
			});

		}

	} else {
		insertStagedQueriesIntoPipeline(ctx);
	}

	// add default sort stage
	if (!sortStage) {
		sortStage = {
			$sort: { _id: -1 }
		};
	}

	ctx.pipeline.push(sortStage);

	if (alwaysInject) {
		alwaysInject.forEach(key => {
			injectStages(key, ctx);
		});
	}

	return ctx.pipeline;
}


/**
 * Inserts all queries not jet in the pipeline into the pipeline.
 * Then, empties staged array
 * @param ctx compiler context
 */
function insertStagedQueriesIntoPipeline(ctx: Context) {

	if (ctx.queries.length === 0) {
		// nothing to insert
		return;
	} else
	if (ctx.queries.length === 1) {
		// single query insertion
		ctx.pipeline.push({
			$match: ctx.queries[0]
		});
	} else {
		// insert multiple queries
		ctx.pipeline.push({
			$match: { $and: ctx.queries }
		});
	}

	// remove staged, to prevent double insertion
	ctx.queries = [];

}

/**
 * Injects a user defined stage into the pipeline, when it is required by a given field
 * @param field 
 * @param ctx compiler context
 */
function injectStages(field: string, ctx: Context) {
	// nothing to inject
	if (!ctx.injectedStages) return;

	let stages = ctx.injectedStages[field];

	// no injection for this field
	if (!stages) return;

	insertStagedQueriesIntoPipeline(ctx);

	ctx.pipeline = [ ...ctx.pipeline, ...stages ];
	
	// delete injected stage, to avoid double insertion
	let {[field]: omit, ...injStages} = ctx.injectedStages;

	ctx.injectedStages = injStages;

}

/**
 * Construct and stage an array query
 * @param arrCheck 
 * @param include include or exclude query
 * @param ctx 
 */
function makeArraySelector(arrCheck: ArrayCheck, include: boolean, ctx: Context): iDictionary {

	let matcher: iDictionary = {};

	// nothing to match
	if (arrCheck.values.length === 0) return {};
	if (arrCheck.fields.length === 0) return {};

	assertPrimitiveArray(arrCheck.values);
	assertPrimitiveArray(arrCheck.fields);

	let match: iDictionary;
	
	let regExpValues = makeStringArrayRegex(arrCheck.values);

	if (include) {
		match = {
			$all: regExpValues
		}
	} else {
		match = {
			$in: regExpValues
		}
	}

	let matchArray: iDictionary[] = [];

	arrCheck.fields.forEach(field => {
		injectStages(field, ctx);

		let subMatch: iDictionary = {};

		subMatch[field] = match;

		matchArray.push(subMatch);
	});

	if (include) {
		matcher = { $or: matchArray };
	} else {
		matcher = { $nor: matchArray };
	}

	return matcher;
}

/** asserts if a value is primtive */
function assertPrimitive(value: any): void {
	if ((typeof value === 'object' && typeof value !== null) || typeof value === 'function') {
		throw "bad input";
	}
}

/** aserts if a value is a array of primitives */
function assertPrimitiveArray(array: any[]): void {
	if (!Array.isArray(array)) throw "bad input";
	
	for (let i = 0; i < array.length; i++) {
		const element = array[i];
		assertPrimitive(element);
	}
}

/** converts an array of string, to an array of regular expressions */
function makeStringArrayRegex(arr: string[]): RegExp[] {
	return arr.map(val => {
		return stringToRegex(val, "i");
	});
}

/**
 * Assigns a value to a matcher.
 * Assisngs the value to different keys, depending on wether it is a single value, or an array.
 * Converts strings to regexp.
 */
function checkAndAssign(valOrArr: any[] | any, match: iDictionary, valKey: string | [string, string], arrKey?: string): iDictionary {

	if (valOrArr === undefined) return match;

	if (arrKey !== undefined && Array.isArray(valOrArr)) {
		let arr: string[] | number[] | RegExp[] = valOrArr;

		assertPrimitiveArray(arr);

		if (arr.length > 0 && typeof arr[0] === "string") {
			arr = makeStringArrayRegex(arr as string[]);
		}

		match[arrKey] = arr;
	} else {
		assertPrimitive(valOrArr);

		let val: string | number | RegExp = valOrArr;

		if (Array.isArray(valKey)) {
			if (typeof val === "string") {
				val = stringToRegex(val, "i");
				match[valKey[1]] = val;
			} else {
				match[valKey[0]] = val;
			}
		} else {
			match[valKey] = val;
		}
	}

	return match;
}
