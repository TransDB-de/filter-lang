"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.makeLangFilterDictionary = void 0;
const util_js_1 = require("../util.js");
/**
 * Scans the provided language definition, and changes it into a format more suitable for parsing.
 * This is done to simplify and speed up parsing.
 * You only need to do this once
 * @param definition Language defintion to convert
 */
function makeLangFilterDictionary(definition) {
    let filterDictionary = {};
    for (const filter of definition) {
        // get new definitions from filter
        let newDict = makeLangFilter(filter);
        // merge new definitions, into single dictionary
        filterDictionary = mergeNewFilters(filterDictionary, newDict);
    }
    return filterDictionary;
}
exports.makeLangFilterDictionary = makeLangFilterDictionary;
/**
 * Constructs a new LangaugeFilterDictionary for a single FilterDefinition.
 * @param filterDefFilter defintion to convert
 */
function makeLangFilter(filterDef) {
    var _a;
    let newFilters = {};
    // field filters
    if (!filterDef.name) {
        if (!filterDef.mappings)
            throw "a general field filter needs mappings";
        if (filterDef.type !== "text")
            throw "a general field filter must be of type text";
        let mappings = util_js_1.lowerCaseKeys(filterDef.mappings);
        for (const [langName, dataName] of Object.entries(mappings)) {
            let newFilter = {
                text: {
                    fields: [dataName],
                    mappings: {}
                }
            };
            newFilters[langName] = newFilter;
        }
    }
    // named filters
    else {
        let newFilter = {};
        let mappings;
        if (filterDef.mappings) {
            mappings = util_js_1.lowerCaseKeys(filterDef.mappings);
        }
        else {
            mappings = {};
        }
        newFilter[filterDef.type] = {
            fields: filterDef.field ? [filterDef.field] : (_a = filterDef.fields) !== null && _a !== void 0 ? _a : [],
            mappings
        };
        if (filterDef.type === "date-compare" && filterDef.suffixes) {
            if (filterDef.suffixes.length !== 3)
                throw "wrong number of date-compare suffixes";
            let jsonContent = JSON.stringify(newFilter[filterDef.type]);
            let newFilterBefore = {};
            newFilterBefore["date-compare-before"] = JSON.parse(jsonContent);
            let newFilterAfter = {};
            newFilterAfter["date-compare-after"] = JSON.parse(jsonContent);
            newFilters[(filterDef.name + "-" + filterDef.suffixes[0]).toLowerCase()] = newFilter;
            newFilters[(filterDef.name + "-" + filterDef.suffixes[1]).toLowerCase()] = newFilterBefore;
            newFilters[(filterDef.name + "-" + filterDef.suffixes[2]).toLowerCase()] = newFilterAfter;
        }
        else {
            newFilters[filterDef.name.toLowerCase()] = newFilter;
            if (filterDef.negationSuffix) {
                if (filterDef.type === "location")
                    throw "location filters can't be negated";
                if (filterDef.type === "date-compare")
                    throw "date compare filters can't be negated";
                let newNegatedFilter = {};
                newNegatedFilter[filterDef.type + "-not"] = util_js_1.deepCopy(newFilter[filterDef.type]);
                newFilters[(filterDef.name + "-" + filterDef.negationSuffix).toLowerCase()] = newNegatedFilter;
            }
            if (filterDef.type === "number" && filterDef.suffixes) {
                if (filterDef.suffixes[0]) {
                    newFilters[(filterDef.name + "-" + filterDef.suffixes[0]).toLowerCase()] = newFilter;
                }
                if (filterDef.suffixes[1]) {
                    let newNumFilter = {};
                    newNumFilter[filterDef.type + "smaller"] = util_js_1.deepCopy(newFilter[filterDef.type]);
                    newFilters[(filterDef.name + "-" + filterDef.suffixes[1]).toLowerCase()] = newNumFilter;
                }
                if (filterDef.suffixes[2]) {
                    let newNumFilter = {};
                    newNumFilter[filterDef.type + "larger"] = util_js_1.deepCopy(newFilter[filterDef.type]);
                    newFilters[(filterDef.name + "-" + filterDef.suffixes[2]).toLowerCase()] = newNumFilter;
                }
            }
        }
    }
    return newFilters;
}
function mergeNewFilters(baseDict, newDict) {
    var _a;
    for (const [name, newFilter] of Object.entries(newDict)) {
        let filter = (_a = baseDict[name]) !== null && _a !== void 0 ? _a : {};
        baseDict[name] = mergeFilter(filter, newFilter);
    }
    return baseDict;
}
function mergeFilter(baseFilter, mergeFilter) {
    for (const [type, val] of Object.entries(mergeFilter)) {
        if (baseFilter[type])
            throw "two filters with the same name cannot have the same type";
        if (Object.keys(baseFilter).length !== 0
            && Object.keys(mergeFilter[type].mappings).length === 0)
            throw "two filters with the same name must both have mappings";
        baseFilter[type] = val;
    }
    return baseFilter;
}
