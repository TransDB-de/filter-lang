export declare enum TokenType {
    /** default case. a wildcard or a value */
    String = 0,
    /** something starting with a number */
    Number = 1,
    /** something in quotes */
    QuotedString = 2,
    /** something that ends with ':' */
    Filter = 3
}
export interface Token {
    type: TokenType;
    val: string;
    /** the tokens position in the input string */
    position: number;
    /** length the token takes up in input string */
    length: number;
    /** a token at the end of the input string without trailing whitespace. useful for autocompletion */
    open?: true;
    /** indicates the user intended to input multiple values */
    commaSeperated: boolean;
}
/**
 * Pre-processing step.
 * Slices a string into it's seperate parts, tagging them with different properties.
 * Not dependet on language definition.
 * @param input filter string to tokenize
 */
export declare function tokenize(input: string): Token[];
