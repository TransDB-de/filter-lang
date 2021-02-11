import type { FilterDefinition, StringDictionary } from "./languageDefinition";
/**
 * @see LanguageFilter
 */
export interface InnerFilter {
    fields: string[];
    mappings: StringDictionary;
}
/**
 * A more abstract filter definition, making parsing easier.
 * Used internally
 * @see LanguageFilterDictionary
 */
export declare type LanguageFilter = {
    [typeName in FilterDefinition['type']]?: InnerFilter;
};
/**
 * A more abstract language definition, used internally to make parsing easier.
 * Do not define your language in this format. Use "languageBuilder" instead
 */
export interface LanguageFilterDictionary {
    [filterName: string]: LanguageFilter;
}
