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
exports.Language = exports.parse = exports.makeLangFilterDictionary = exports.Compiler = exports.Parser = exports.Lexer = exports.LanguageBuilder = void 0;
const Lexer = __importStar(require("./parser/lexer.js"));
exports.Lexer = Lexer;
const Parser = __importStar(require("./parser/parser.js"));
exports.Parser = Parser;
const LanguageBuilder = __importStar(require("./languageBuilder/languageBuilder.js"));
exports.LanguageBuilder = LanguageBuilder;
const Compiler = __importStar(require("./compiler/compiler.js"));
exports.Compiler = Compiler;
var languageBuilder_js_1 = require("./languageBuilder/languageBuilder.js");
Object.defineProperty(exports, "makeLangFilterDictionary", { enumerable: true, get: function () { return languageBuilder_js_1.makeLangFilterDictionary; } });
var parser_js_1 = require("./parser/parser.js");
Object.defineProperty(exports, "parse", { enumerable: true, get: function () { return parser_js_1.parse; } });
/**
 * Utility class bundling language definition and parser
 */
class Language {
    /**
     * Make a new Language class, which can then be used for parsing a string into an abstract filter format.
     * @param definition custom language definition
     */
    constructor(definition) {
        this.filters = LanguageBuilder.makeLangFilterDictionary(definition);
    }
    /**
     * Parse a string into an abstract format, according to this languages definition
     * @param input filter string to parse
     */
    parse(input) {
        return Parser.parse(input, this.filters);
    }
    /**
     * Parse a string for hightlighting and autocompletion. does not output a abstract format
     * @param input filter string to parse
     */
    liveParse(input) {
        let tokens = Lexer.tokenize(input);
        let [, details] = Parser.parseTokenized(tokens, this.filters, true);
        return details;
    }
}
exports.Language = Language;
