import type { LanguageFilter, LanguageFilterDictionary } from "../types/internal"

import type { FilterDefinition, LanguageDefinition, StringDictionary } from "../types/languageDefinition"
export type { FilterDefinition, LanguageDefinition, StringDictionary }

import { deepCopy, lowerCaseKeys } from "../util.js"


type O = { [key: string]: any };

/**
 * Scans the provided language definition, and changes it into a format more suitable for parsing
 * @param definition 
 */
export function makeLangFilterDictionary(definition: LanguageDefinition): LanguageFilterDictionary {
	let filterDictionary: LanguageFilterDictionary = {}
	
	for (const filter of definition) {
		
		// get new definitions from filter
		let newDict = makeLangFilter(filter);

		// merge new definitions
		filterDictionary = mergeNewFilters(filterDictionary, newDict);

	}

	return filterDictionary;
}

/**
 * Constructs a new LangaugeFilterDictionary for a singe FilterDefinition
 * @param filterDef 
 */
function makeLangFilter(filterDef: FilterDefinition): LanguageFilterDictionary {

	let newFilters: LanguageFilterDictionary = {};

	// field filters
	if (!filterDef.name) {

		if (!filterDef.mappings) throw "a general field filter needs mappings";
		if (filterDef.type !== "text") throw "a general field filter must be of type text";

		let mappings = lowerCaseKeys(filterDef.mappings);

		for (const [langName, dataName] of Object.entries(mappings)) {

			let newFilter: LanguageFilter = {
				text: {
					fields: [dataName],
					mappings: {}
				}
			}

			newFilters[langName] = newFilter;

		}

	}
	// named filters
	else {

		let newFilter: LanguageFilter = {};

		let mappings: StringDictionary;

		if (filterDef.mappings) {
			mappings = lowerCaseKeys(filterDef.mappings);
		} else {
			mappings = {}
		}

		newFilter[filterDef.type] = {
			fields: filterDef.field ? [filterDef.field] : filterDef.fields ?? [],
			mappings
		}

		if (filterDef.type === "date-compare" && filterDef.suffixes) {

			if (filterDef.suffixes.length !== 3) throw "wrong number of date-compare suffixes";

			let jsonContent = JSON.stringify(newFilter[filterDef.type]);

			let newFilterBefore: LanguageFilter = {};
			newFilterBefore["date-compare-before"] = JSON.parse(jsonContent);

			let newFilterAfter: LanguageFilter = {};
			newFilterAfter["date-compare-after"] = JSON.parse(jsonContent);


			newFilters[(filterDef.name + "-" + filterDef.suffixes[0]).toLowerCase()] = newFilter;
			newFilters[(filterDef.name + "-" + filterDef.suffixes[1]).toLowerCase()] = newFilterBefore;
			newFilters[(filterDef.name + "-" + filterDef.suffixes[2]).toLowerCase()] = newFilterAfter;

		} else {
			
			newFilters[filterDef.name.toLowerCase()] = newFilter;

			if (filterDef.negationSuffix) {

				if (filterDef.type === "location") throw "location filters can't be negated";
				if (filterDef.type === "date-compare") throw "date compare filters can't be negated";

				let newNegatedFilter: LanguageFilter & O = {};
				newNegatedFilter[filterDef.type + "-not"] = deepCopy(newFilter[filterDef.type]);
				
				newFilters[(filterDef.name + "-" + filterDef.negationSuffix).toLowerCase()] = newNegatedFilter;

			}

			if (filterDef.type === "number" && filterDef.suffixes) {

				if (filterDef.suffixes[0]) {
					newFilters[(filterDef.name + "-" + filterDef.suffixes[0]).toLowerCase()] = newFilter;
				}

				if (filterDef.suffixes[1]) {
					let newNumFilter: LanguageFilter & O = {};
					newNumFilter[filterDef.type + "smaller"] = deepCopy(newFilter[filterDef.type]);
					newFilters[(filterDef.name + "-" + filterDef.suffixes[1]).toLowerCase()] = newNumFilter;
				}

				if (filterDef.suffixes[2]) {
					let newNumFilter: LanguageFilter & O = {};
					newNumFilter[filterDef.type + "larger"] = deepCopy(newFilter[filterDef.type]);
					newFilters[(filterDef.name + "-" + filterDef.suffixes[2]).toLowerCase()] = newNumFilter;
				}

			}

		}

	}

	return newFilters;

}

function mergeNewFilters(baseDict: LanguageFilterDictionary, newDict: LanguageFilterDictionary): LanguageFilterDictionary {

	for (const [name, newFilter] of Object.entries(newDict)) {

		let filter = baseDict[name] ?? {};
		baseDict[name] = mergeFilter(filter, newFilter);

	}

	return baseDict;

}

function mergeFilter(baseFilter: LanguageFilter, mergeFilter: LanguageFilter): LanguageFilter {

	for (const [type, val] of Object.entries(mergeFilter)) {

		if ( baseFilter[type as keyof LanguageFilter] ) throw "two filters with the same name cannot have the same type";
		if (
			Object.keys(baseFilter).length !== 0
			&& Object.keys(mergeFilter[type as keyof LanguageFilter]!.mappings).length === 0
		) throw "two filters with the same name must both have mappings";

		baseFilter[type as keyof LanguageFilter] = val;

	}

	return baseFilter;

}
