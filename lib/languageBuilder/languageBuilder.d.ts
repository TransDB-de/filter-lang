import type { LanguageFilterDictionary } from "../types/internal";
import type { FilterDefinition, LanguageDefinition, StringDictionary } from "../types/languageDefinition";
export type { FilterDefinition, LanguageDefinition, StringDictionary };
/**
 * Scans the provided language definition, and changes it into a format more suitable for parsing
 * @param definition
 */
export declare function makeLangFilterDictionary(definition: LanguageDefinition): LanguageFilterDictionary;
