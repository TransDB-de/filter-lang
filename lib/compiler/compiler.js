"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.compileToMongoDB = void 0;
const util_js_1 = require("../util.js");
/**
 * Compiles a filter to a mongoDB aggregation pipeline, which can be further modified, or used directly, to get the filtered documents.
 * Throws an error, if compiling failed (eg. bad input).
 * For security concerns, it is not recommended to do this client side
 * @param intermediateForm parsed filter
 * @param injectedStages a object containing custom stages to inject in front of specific fields. Useful for $lookup, $set or $project. Only used fields are injected
 * @param location prefetched location coordinates. Required when using a location filter. Fetch cooridantes of "location.locationName"
 */
function compileToMongoDB(intermediateForm, injectedStages, location) {
    var _a;
    let sortStage = null;
    let ctx = {
        pipeline: [],
        queries: [],
        injectedStages: injectedStages
    };
    // Wildcards
    if (intermediateForm.wildcard.length > 0) {
        assertPrimitiveArray(intermediateForm.wildcard);
        let wildcardString = intermediateForm.wildcard.join(" ");
        let searchStage = {
            $text: {
                $search: wildcardString
            }
        };
        sortStage = {
            $sort: {
                score: { $meta: "textScore" },
                _id: -1
            }
        };
        ctx.pipeline.push({
            $match: searchStage
        });
    }
    // Includes
    if (intermediateForm.include.length > 0) {
        let includes = [];
        intermediateForm.include.forEach(field => {
            assertPrimitive(field);
            injectStages(field, ctx);
            let include = {};
            include[field] = { $ne: null };
            includes.push(include);
        });
        ctx.queries = [...ctx.queries, ...includes];
    }
    // Excludes
    if (intermediateForm.exclude.length > 0) {
        let excludes = [];
        intermediateForm.exclude.forEach(field => {
            assertPrimitive(field);
            injectStages(field, ctx);
            let exclude = {};
            exclude[field] = null;
            excludes.push(exclude);
        });
        ctx.queries = [...ctx.queries, ...excludes];
    }
    // Array includes
    if (intermediateForm.arrayIncludes.length > 0) {
        let matches = [];
        intermediateForm.arrayIncludes.forEach(arrInclude => {
            let selector = makeArraySelector(arrInclude, true, ctx);
            matches.push(selector);
        });
        ctx.queries = [...ctx.queries, ...matches];
    }
    // Array excludes
    if (intermediateForm.arrayExcludes.length > 0) {
        let matches = [];
        intermediateForm.arrayExcludes.forEach(arrExclude => {
            let selector = makeArraySelector(arrExclude, false, ctx);
            matches.push(selector);
        });
        ctx.queries = [...ctx.queries, ...matches];
    }
    // Comparators
    if (Object.keys(intermediateForm.compare).length > 0) {
        let matches = [];
        for (const [field, comparison] of Object.entries(intermediateForm.compare)) {
            let match = {};
            match = checkAndAssign(comparison.equalTo, match, ["eq", "$regex"], "$in");
            match = checkAndAssign(comparison.notEqualTo, match, "$ne", "$nin");
            match = checkAndAssign(comparison.largerThan, match, "$gt");
            match = checkAndAssign(comparison.smallerThan, match, "$lt");
            if (Object.keys(match).length === 0)
                continue;
            injectStages(field, ctx);
            let obj = {};
            obj[field] = match;
            matches.push(obj);
        }
        ctx.queries = [...ctx.queries, ...matches];
    }
    // Location
    if (intermediateForm.location
        && location) {
        let distance = (_a = intermediateForm.location.distance) !== null && _a !== void 0 ? _a : 10;
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
            let obj = {};
            obj[intermediateForm.location.field] = {
                $geoWithin: {
                    $centerSphere: [location.coordinates, radians]
                }
            };
            ctx.pipeline.push({
                $match: obj
            });
        }
    }
    else {
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
exports.compileToMongoDB = compileToMongoDB;
/**
 * Inserts all queries not jet in the pipeline into the pipeline.
 * Then, empties staged array
 * @param ctx compiler context
 */
function insertStagedQueriesIntoPipeline(ctx) {
    if (ctx.queries.length === 0) {
        // nothing to insert
        return;
    }
    else if (ctx.queries.length === 1) {
        // single query insertion
        ctx.pipeline.push({
            $match: ctx.queries[0]
        });
    }
    else {
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
function injectStages(field, ctx) {
    // nothing to inject
    if (!ctx.injectedStages)
        return;
    let stages = ctx.injectedStages[field];
    // no injection for this field
    if (!stages)
        return;
    insertStagedQueriesIntoPipeline(ctx);
    ctx.pipeline = [...ctx.pipeline, ...stages];
    // delete injected stage, to avoid double insertion
    let { [field]: omit, ...injStages } = ctx.injectedStages;
    ctx.injectedStages = injStages;
}
/**
 * Construct and stage an array query
 * @param arrCheck
 * @param include include or exclude query
 * @param ctx
 */
function makeArraySelector(arrCheck, include, ctx) {
    let matcher = {};
    // nothing to match
    if (arrCheck.values.length === 0)
        return {};
    if (arrCheck.fields.length === 0)
        return {};
    assertPrimitiveArray(arrCheck.values);
    assertPrimitiveArray(arrCheck.fields);
    let match;
    let regExpValues = makeStringArrayRegex(arrCheck.values);
    if (include) {
        match = {
            $all: regExpValues
        };
    }
    else {
        match = {
            $in: regExpValues
        };
    }
    let matchArray = [];
    arrCheck.fields.forEach(field => {
        injectStages(field, ctx);
        let subMatch = {};
        subMatch[field] = match;
        matchArray.push(subMatch);
    });
    if (include) {
        matcher = { $or: matchArray };
    }
    else {
        matcher = { $nor: matchArray };
    }
    return matcher;
}
/** asserts if a value is primtive */
function assertPrimitive(value) {
    if ((typeof value === 'object' && typeof value !== null) || typeof value === 'function') {
        throw "bad input";
    }
}
/** aserts if a value is a array of primitives */
function assertPrimitiveArray(array) {
    if (!Array.isArray(array))
        throw "bad input";
    for (let i = 0; i < array.length; i++) {
        const element = array[i];
        assertPrimitive(element);
    }
}
/** converts an array of string, to an array of regular expressions */
function makeStringArrayRegex(arr) {
    return arr.map(val => {
        return util_js_1.stringToRegex(val, "i");
    });
}
/**
 * Assigns a value to a matcher.
 * Assisngs the value to different keys, depending on wether it is a single value, or an array.
 * Converts strings to regexp.
 */
function checkAndAssign(valOrArr, match, valKey, arrKey) {
    if (valOrArr === undefined)
        return match;
    if (arrKey !== undefined && Array.isArray(valOrArr)) {
        let arr = valOrArr;
        assertPrimitiveArray(arr);
        if (arr.length > 0 && typeof arr[0] === "string") {
            arr = makeStringArrayRegex(arr);
        }
        match[arrKey] = arr;
    }
    else {
        assertPrimitive(valOrArr);
        let val = valOrArr;
        if (Array.isArray(valKey)) {
            if (typeof val === "string") {
                val = util_js_1.stringToRegex(val, "i");
                match[valKey[1]] = val;
            }
            else {
                match[valKey[0]] = val;
            }
        }
        else {
            match[valKey] = val;
        }
    }
    return match;
}
