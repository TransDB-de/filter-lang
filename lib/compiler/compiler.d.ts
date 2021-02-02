import type { AbstractFilters } from "../types/abstractFormat";
/** simple json friendly object */
interface iDictionary {
    [key: string]: string | number | null | iDictionary | string[] | number[] | iDictionary[];
}
interface GeoJsonPoint {
    type: "Point";
    coordinates: [number, number];
}
/**
 * Stages to inject before given fields (referenced by key) are accessed in pipeline.
 * Required when querying fields that might no yet exist (eg. manually referenced fields)
 */
export interface InjectedStages {
    [fieldName: string]: iDictionary;
}
/**
 * Compiles a filter to a mongoDB aggregation pipeline, which can be further modified, or used directly, to apply the filter.
 * For security concerns, it is not recommended to do this client side
 * @param intermediateForm parsed filter
 * @param injectedStages a object containing custom stages to inject in front of specific fields. Useful for $lookup, $set or $project. Only used fields are injected
 * @param location prefetched location coordinates. Required when using a location filter. Fetch cooridantes with "location.locationName"
 */
export declare function compileToMongoDB(intermediateForm: AbstractFilters, injectedStages?: InjectedStages, location?: GeoJsonPoint): object[];
export {};
