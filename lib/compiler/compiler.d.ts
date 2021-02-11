import type { AbstractFilters } from "../types/abstractFormat";
/** simple aggregation pipeline friendly object */
interface iDictionary {
    [key: string]: string | number | null | iDictionary | RegExp | string[] | number[] | iDictionary[] | RegExp[];
}
interface GeoJsonPoint {
    type: "Point";
    coordinates: [number, number];
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
    [fieldName: string]: iDictionary[];
}
/**
 * Compiles a filter to a mongoDB aggregation pipeline, which can be further modified, or used directly, to get the filtered documents.
 * Throws an error, if compiling failed (eg. bad input).
 * For security concerns, it is not recommended to do this client side
 * @param intermediateForm parsed filter
 * @param injectedStages a object containing custom stages to inject in front of specific fields. Useful for $lookup, $set or $project. Only used fields are injected
 * @param location prefetched location coordinates. Required when using a location filter. Fetch cooridantes of "location.locationName"
 */
export declare function compileToMongoDB(intermediateForm: AbstractFilters, injectedStages?: InjectedStages, location?: GeoJsonPoint): object[];
export {};
