/** Holds information about the parsed input */
export interface Details {
    /** all contexts (defined filters) found during parsing */
    contexts: {
        /** position of context in input */
        range: [number, number];
        /** name of context (same as name of filter, which was in context) */
        name: string;
        /** if this context is potentially still being edited by the user */
        open: boolean;
    }[];
    /** suggestions for what to input next, based on langauge definition */
    autocomplete: string[];
    /** wheter the suer left a quote open */
    openQuote: boolean;
}
