"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.tokenize = exports.TokenType = void 0;
var TokenType;
(function (TokenType) {
    /** default case. a wildcard or a value */
    TokenType[TokenType["String"] = 0] = "String";
    /** something starting with a number */
    TokenType[TokenType["Number"] = 1] = "Number";
    /** something in quotes */
    TokenType[TokenType["QuotedString"] = 2] = "QuotedString";
    /** something that ends with ':' */
    TokenType[TokenType["Filter"] = 3] = "Filter";
})(TokenType = exports.TokenType || (exports.TokenType = {}));
/**
 * Main lexing function
 * @param unparsed
 * @param langMap
 */
function getNextToken(unlexed, position) {
    let rest;
    let token;
    let type = TokenType.String;
    let val = "";
    let segmentLength = 0;
    let trimmed = unlexed.trimStart();
    let open = false;
    let commaSeperated = false;
    // may be a quoted segment
    if (/^"/.test(trimmed)) {
        // determine length of segment by finding closing quote, or end of string
        segmentLength = trimmed.search(/.(?:")/) + 2;
        // if closing quote found
        if (segmentLength > 1) {
            type = TokenType.QuotedString;
            val = trimmed.slice(1, segmentLength - 1);
        }
    }
    // not a quoted segemnt
    if (type === TokenType.String) {
        // determine length of segment by finding either whitespace, or ':'
        segmentLength = trimmed.search(/\s|(?:\:)|,(?=\s)/) + 1;
        val = trimmed.slice(0, segmentLength); // include trailing char, so we can check for filters
        if (/^[0-9]/.test(val)) {
            type = TokenType.Number;
        }
        if (val.endsWith(":")) {
            type = TokenType.Filter;
        }
        else if (val.endsWith(",")) {
            // detect and remove trailing comma
            commaSeperated = true;
            val = val.slice(0, -1);
        }
        else {
            // might be an open ended string
            open = (trimmed.length === segmentLength);
        }
    }
    rest = trimmed.slice(segmentLength).trimStart();
    // detect spaced comma seperation
    if (rest.startsWith(",")) {
        commaSeperated = true;
        rest = rest.slice(1).trimStart();
    }
    token = {
        type,
        val: val.trim(),
        length: val.endsWith(":") || type === TokenType.QuotedString ? segmentLength : segmentLength - 1,
        position,
        commaSeperated
    };
    if (open) {
        token.open = true;
    }
    position += unlexed.length - rest.length;
    return [token, rest, position];
}
/**
 * Pre-processing step.
 * Slices a string into it's seperate parts, tagging them with different properties.
 * Not dependet on language definition.
 * @param input filter string to tokenize
 */
function tokenize(input) {
    // triling whitespace simplifies lexing
    let unlexed = input.toLowerCase() + " ";
    let lexedTokens = [];
    let pos = 0;
    while (unlexed.length !== 0) {
        let nextToken;
        [nextToken, unlexed, pos] = getNextToken(unlexed, pos);
        lexedTokens.push(nextToken);
    }
    return lexedTokens;
}
exports.tokenize = tokenize;
