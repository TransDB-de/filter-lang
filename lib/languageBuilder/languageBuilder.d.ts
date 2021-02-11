import type { LanguageFilterDictionary } from "../types/internal";
import type { FilterDefinition, LanguageDefinition, StringDictionary } from "../types/languageDefinition";
export type { FilterDefinition, LanguageDefinition, StringDictionary };
/**
 * Scans the provided language definition, and changes it into a format more suitable for parsing.
 * This is done to simplify and speed up parsing.
 * You only need to do this once
 * @param definition Language defintion to convert
 */
export declare function makeLangFilterDictionary(definition: LanguageDefinition): LanguageFilterDictionary;
