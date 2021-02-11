"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    Object.defineProperty(o, k2, { enumerable: true, get: function() { return m[k]; } });
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.parseTokenized = exports.parse = void 0;
const lexer_js_1 = require("./lexer.js");
const util_js_1 = require("../util.js");
const Live = __importStar(require("./liveParse.js"));
/**
 * Parse an input string into an abstract form
 * @param input string to parse
 * @param filters internal filter definition. It is not recommended to define your language in this format. use "/langBuilder" instead
 */
function parse(input, filters) {
    let tokens = lexer_js_1.tokenize(input);
    let [parsed] = parseTokenized(tokens, filters);
    return parsed;
}
exports.parse = parse;
/**
 * Parse a previously tokenized input
 * @param tokens
 * @param filters
 * @param live live parsing additionally returns details
 */
function parseTokenized(tokens, filters, live = false) {
    let ctx = {
        currentContext: false,
        tempLocation: undefined,
        token: {
            val: "",
            commaSeperated: false,
            length: 0,
            position: 0,
            type: 0
        },
        aFilter: {
            wildcard: [],
            include: [],
            exclude: [],
            arrayIncludes: [],
            arrayExcludes: [],
            compare: {}
        },
        filters,
        tokens,
        iteration: 0
    };
    // live parse details
    let liveCtx = {
        lastContext: false,
        details: { contexts: [], autocomplete: [], openQuote: false },
        contextStart: 0,
        contextName: "",
        openVal: ""
    };
    for (let i = 0; i < tokens.length; i++) {
        ctx.iteration = i;
        ctx.token = tokens[i];
        if (live) {
            liveCtx = Live.beforeParse(ctx, liveCtx);
        }
        if (ctx.currentContext) {
            ctx = parseInContext(ctx);
        }
        else {
            ctx = parseContextFree(ctx);
        }
        if (live) {
            liveCtx = Live.afterParse(ctx, liveCtx);
        }
    }
    let details = liveCtx.details;
    if (live && ctx.token) {
        details = Live.finalLivePass(ctx, liveCtx);
    }
    return [util_js_1.deepCopy(ctx.aFilter), details];
}
exports.parseTokenized = parseTokenized;
function parseDateStringToTimestamp(date) {
    date = date.replace(/-|\/|\\|\.|_|,/g, " ");
    let match = date.match(/[0-9]{1,4}/g);
    if (match === null) {
        return null;
    }
    let [d, m, y] = match;
    y = y !== null && y !== void 0 ? y : new Date().getFullYear();
    if (!m) {
        return null;
    }
    if (y.length < 4) {
        let full = new Date().getFullYear().toString();
        y = `${full.slice(0, -2)}${y.slice(-2)}`;
    }
    if (d.length < 2) {
        d = "0" + d;
    }
    if (m.length < 2) {
        m = "0" + m;
    }
    // Date.parse works best if the date is in the format yyyy-mm-dd
    return Date.parse(`${y}-${m.slice(-2)}-${d.slice(-2)}`);
}
function parseContextFree(ctx) {
    let { aFilter, currentContext } = ctx;
    const { token, filters } = ctx;
    // token which is not a filter, and not in context must be a wildcard
    if (token.type !== lexer_js_1.TokenType.Filter) {
        aFilter.wildcard.push(token.val);
        return { ...ctx, aFilter };
    }
    else {
        let filterName = token.val.slice(0, -1);
        // valid filter?
        if (filters[filterName]) {
            // context set to specific filter
            currentContext = filters[filterName];
            return { ...ctx, aFilter, currentContext };
        }
        else {
            // if no filter was found, set to wildcard, just in case
            aFilter.wildcard.push(token.val);
            return { ...ctx, aFilter };
        }
    }
}
function mapValueIfMappable(value, map) {
    if (Object.keys(map).length === 0)
        return value;
    if (!map[value])
        return null;
    return map[value];
}
function parseInContext(ctx) {
    var _a;
    let { currentContext } = ctx;
    const { token, filters } = ctx;
    // potential context switch
    if (token.type === lexer_js_1.TokenType.Filter) {
        let filterName = token.val.slice(0, -1);
        // valid filter?
        if (filters[filterName]) {
            // context set to specific filter
            currentContext = filters[filterName];
            return { ...ctx, currentContext };
        }
    }
    let { aFilter } = ctx;
    // context not switched: parse tokens as values
    // loop types stored in current context
    for (const [type, content] of Object.entries(currentContext)) {
        if (!content)
            continue;
        let val = mapValueIfMappable(token.val, content.mappings);
        // map was provided, but value did not match
        // continue will try to match alias, if there are any
        if (val === null)
            continue;
        if (type.startsWith("include")) {
            if (type.endsWith("not")) {
                aFilter.exclude.push(val);
            }
            else {
                aFilter.include.push(val);
            }
            // if there is no comma seperation, exit context
            if (!token.commaSeperated)
                currentContext = false;
            return { ...ctx, aFilter, currentContext };
        }
        else if (type.startsWith("text")) {
            let comparisonKey = "equalTo";
            if (type.endsWith("not")) {
                comparisonKey = "notEqualTo";
            }
            content.fields.forEach((field) => {
                if (!aFilter.compare[field])
                    aFilter.compare[field] = {};
                let cField = aFilter.compare[field][comparisonKey];
                if (cField === undefined) {
                    cField = val;
                }
                else {
                    if (!Array.isArray(cField)) {
                        cField = [cField];
                    }
                    cField.push(val);
                }
                aFilter.compare[field][comparisonKey] = cField;
            });
            // if there is no comma seperation, exit context
            if (!token.commaSeperated)
                currentContext = false;
            return { ...ctx, aFilter, currentContext };
        }
        else if (type.startsWith("number")) {
            let numberVal = parseFloat(val);
            let comparisonKey = "equalTo";
            if (type.endsWith("not")) {
                comparisonKey = "notEqualTo";
            }
            else if (type.endsWith("smaller")) {
                comparisonKey = "smallerThan";
            }
            else if (type.endsWith("larger")) {
                comparisonKey = "largerThan";
            }
            content.fields.forEach((field) => {
                // create field if none exists
                if (!aFilter.compare[field]) {
                    aFilter.compare[field] = {};
                }
                let cField = aFilter.compare[field][comparisonKey];
                if ((comparisonKey === "equalTo" || comparisonKey === "notEqualTo") && cField !== undefined) {
                    if (!Array.isArray(cField)) {
                        cField = [cField];
                    }
                    cField.push(numberVal);
                    aFilter.compare[field][comparisonKey] = cField;
                }
                else {
                    aFilter.compare[field][comparisonKey] = numberVal;
                }
            });
            // if there is no comma seperation, exit context
            if (!token.commaSeperated)
                currentContext = false;
            return { ...ctx, aFilter, currentContext };
        }
        if (type.startsWith("array")) {
            let key = "arrayIncludes";
            if (type.endsWith("not")) {
                key = "arrayExcludes";
            }
            // check for uniqueness
            let entry = aFilter[key].find((check) => JSON.stringify(check.fields) === JSON.stringify(content.fields));
            // append values or push values
            if (!entry) {
                aFilter[key].push({
                    fields: content.fields,
                    values: [val]
                });
            }
            else {
                entry.values.push(val);
            }
            // if there is no comma seperation, exit context
            if (!token.commaSeperated)
                currentContext = false;
            return { ...ctx, aFilter, currentContext };
        }
        else if (type.startsWith("date")) {
            // replace symbols with spaces
            let timestamp = parseDateStringToTimestamp(val);
            // if timestamp was found
            if (timestamp !== null) {
                // for each affected field, create filter
                content.fields.forEach((field) => {
                    // if field does not yet exist in abstract filter, create it
                    if (!aFilter.compare[field])
                        aFilter.compare[field] = {};
                    if (type.endsWith("-before")) {
                        aFilter.compare[field].smallerThan = timestamp;
                    }
                    else if (type.endsWith("-after")) {
                        aFilter.compare[field].largerThan = timestamp;
                    }
                    else {
                        // when searching for a specific day, check if timestamp is between the start and the end of the day
                        aFilter.compare[field].largerThan = timestamp;
                        aFilter.compare[field].smallerThan = timestamp + 86400000; // date + 24h
                    }
                });
            }
            // since this type only requires one value, exit the context
            currentContext = false;
            return { ...ctx, aFilter, currentContext };
        }
        else if (type.startsWith("location")) {
            let { tempLocation, iteration } = ctx;
            const { tokens } = ctx;
            // we use the temp location to avoid the case of a user only inputting a distance, without a location
            if (!tempLocation) {
                tempLocation = {};
            }
            let distanceFound = false;
            // if the lexer thinks this token might be a number, check for distance suffix
            if (token.type === lexer_js_1.TokenType.Number) {
                if (val.endsWith("km")) {
                    tempLocation.distance = parseFloat(val);
                    distanceFound = true;
                }
                else 
                // suffix found as next token. add val as distance, and skip next token, by incrementing index
                if (((_a = tokens[iteration + 1]) === null || _a === void 0 ? void 0 : _a.val) === "km") {
                    tempLocation.distance = parseFloat(val);
                    iteration += 1;
                    distanceFound = true;
                }
            }
            // if value was not a distance, set it as a location name
            if (!tempLocation.locationName && !distanceFound) {
                tempLocation.locationName = val;
            }
            // location name set and no further inputs indicated by comma seperation:
            if (tempLocation.locationName && !token.commaSeperated) {
                // add location to abstract and free context
                aFilter.location = tempLocation;
                aFilter.location.field = content.fields[0];
                currentContext = false;
            }
            return { ...ctx, aFilter, currentContext, tempLocation, iteration };
        }
        else if (type.startsWith("wildcard")) {
            if (type === "wildcard") {
                aFilter.wildcard.push(val);
            }
            else if (type === "wildcard-not") {
                aFilter.wildcard.push("-" + val);
            }
            // if there is no comma seperation, exit context
            if (!token.commaSeperated)
                currentContext = false;
            return { ...ctx, aFilter, currentContext };
        }
    }
    // all types looped, no match found
    // likely a typo.
    // add token as wild-card just in case
    aFilter.wildcard.push(token.val);
    // if there is no comma seperation, exit context
    if (!token.commaSeperated)
        currentContext = false;
    return { ...ctx, aFilter, currentContext };
}
