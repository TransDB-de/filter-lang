import type { AbstractFilters, ArrayCheck } from "../types/abstractFormat"
import { deepCopy } from "../util.js";


/** simple json friendly object */
interface iDictionary {
	[key: string]: string | number | null | iDictionary | string[] | number[] | iDictionary[]
}

interface GeoJsonPoint {
	type: "Point", coordinates: [number, number]
}

/** Compiler coctext */
interface Context { 
	pipeline: object[]
	queries: object[]
	injectedStages?: InjectedStages
}

/**
 * Stages to inject before given fields (referenced by key) are accessed in pipeline.
 * Required when querying fields that might no yet exist (eg. manually referenced fields)
 */
export interface InjectedStages {
	[fieldName: string]: iDictionary
}


/**
 * Compiles a filter to a mongoDB aggregation pipeline, which can be further modified, or used directly, to apply the filter.
 * For security concerns, it is not recommended to do this client side
 * @param intermediateForm parsed filter
 * @param injectedStages a object containing custom stages to inject in front of specific fields. Useful for $lookup, $set or $project. Only used fields are injected
 * @param location prefetched location coordinates. Required when using a location filter. Fetch cooridantes with "location.locationName"
 */
export function compileToMongoDB(intermediateForm: AbstractFilters, injectedStages?: InjectedStages, location?: GeoJsonPoint ): object[] {

	let sortStage: object | null = null;

	let ctx: Context = {
		pipeline: [],
		queries: [],
		injectedStages: deepCopy(injectedStages)
	}

	// Wildcards
	if (intermediateForm.wildcard.length !== 0) {

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
	if (intermediateForm.include.length !== 0) {

		let includes: object[] = [];

		intermediateForm.include.forEach(field => {
			injectStage(field, ctx);

			let include: iDictionary = {};
			include[field] = { $ne: null };
			includes.push(include);
		});

		ctx.queries = [...ctx.queries, ...includes];
	}

	// Excludes
	if (intermediateForm.exclude.length !== 0) {

		let excludes: object[] = [];

		intermediateForm.exclude.forEach(field => {
			injectStage(field, ctx);

			let exclude: iDictionary = {};
			exclude[field] = null;
			excludes.push(exclude);
		});

		ctx.queries = [...ctx.queries, ...excludes];
	}

	// Array includes
	if (intermediateForm.arrayIncludes.length !== 0) {

		let matches: object[] = [];

		intermediateForm.arrayIncludes.forEach(arrInclude => {
			matches.push( makeArraySelector(arrInclude, true, ctx) );
		});

		ctx.queries = [...ctx.queries, ...matches];
	}

	// Array excludes
	if (intermediateForm.arrayExcludes.length !== 0) {

		let matches: object[] = [];

		intermediateForm.arrayExcludes.forEach(arrExclude => {
			matches.push( makeArraySelector(arrExclude, false, ctx) );
		});

		ctx.queries = [...ctx.queries, ...matches];
	}

	// Comparators
	if ( Object.keys(intermediateForm.compare).length !== 0) {

		let matches: object[] = [];

		for (const [field, comparison] of Object.entries(intermediateForm.compare)) {
			let match: iDictionary = {};

			if (comparison.equalTo) match["$eq"] = comparison.equalTo;
			if (comparison.largerThan) match["$gt"] = comparison.largerThan;
			if (comparison.smallerThan) match["$lt"] = comparison.smallerThan;
			if (comparison.notEqualTo) match["$ne"] = comparison.notEqualTo;

			if ( Object.keys(match).length === 0 ) continue;

			injectStage(field, ctx);

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

		// geoNear query
		if (!sortStage && ctx.pipeline.length === 0) {

			ctx.pipeline.unshift({
				$geoNear: {
					near: deepCopy(location),
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

			let radians = distance / 6371;

			insertStagedQueriesIntoPipeline(ctx);

			let obj: any = {};
			obj[intermediateForm.location.field] = {
				$geoWithin: {
					$centerSphere: [ deepCopy(location.coordinates) , radians]
				}
			}

			ctx.pipeline.push({
				$match: obj
			});

		}

	} else {
		insertStagedQueriesIntoPipeline(ctx);
	}

	if (!sortStage) {
		sortStage = {
			$sort: { _id: -1 }
		};
	}

	ctx.pipeline.push(sortStage);

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
			$match: deepCopy( ctx.queries[0] )
		});
	} else {
		// insert multiple queries
		ctx.pipeline.push({
			$match: { $and: deepCopy( ctx.queries ) }
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
function injectStage(field: string, ctx: Context) {
	// nothing to inject
	if (!ctx.injectedStages) return;

	let stage = ctx.injectedStages[field];

	// no injection for this field
	if (!stage) return;

	insertStagedQueriesIntoPipeline(ctx);

	ctx.pipeline.push( deepCopy(stage) );
	
	// delete injected stage, to avoid double insertion
	delete ctx.injectedStages[field];

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

	let match: iDictionary;
	
	if (include) {
		match = {
			$all: arrCheck.values
		}
	} else {
		match = {
			$in: arrCheck.values
		}
	}

	let matchArray: iDictionary[] = [];

	arrCheck.fields.forEach(field => {
		injectStage(field, ctx);

		let subMatch: iDictionary = {};

		subMatch[field] = match;

		matchArray.push(subMatch);
	});

	if (include) {
		matcher = { $or: matchArray };
	} else {
		matcher = { $nor: matchArray };
	}

	return deepCopy(matcher);
}
