export function lowerCaseKeys(dict) {
    let key, keys = Object.keys(dict);
    let n = keys.length;
    let newDict = {};
    while (n--) {
        key = keys[n];
        newDict[key.toLowerCase()] = dict[key];
    }
    return newDict;
}
/**
 * Deep copies are made to avoid mutating the user input,
 * and to decouple the compiled / parsed data from any potentially mutable data
 * @param obj obj to deep copy
 */
export function deepCopy(obj) {
    if (obj === undefined || obj === null)
        return obj;
    return JSON.parse(JSON.stringify(obj));
}
