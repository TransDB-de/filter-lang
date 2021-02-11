import type { LanguageFilter } from "../types/internal";
import type { ParsingContext } from "./parser";

import { deepCopy } from "../util.js";

/** Holds information about the parsed input */
export interface Details {
	/** all contexts (defined filters) found during parsing */
	contexts: {
		/** position of context in input */
		range: [number, number],

		/** name of context (same as name of filter, which was in context) */
		name: string,

		/** if this context is potentially still being edited by the user */
		open: boolean
	}[]

	/** suggestions for what to input next, based on langauge definition */
	autocomplete: string[]

	/** wheter the suer left a quote open */
	openQuote: boolean
}

/**
 * @internal
 * Context used by live parsing to collect various details about the parsing process
 */
export interface LiveContext {
	/** context of the last parsing cycle */
	lastContext: false | LanguageFilter
	/** details object being filled by live parse */
	details: Details
	/** where the currently open context started in the input string */
	contextStart: number
	/** name of the filter currently in context */
	contextName: string
	/** if the input has an unclosed quote, collects all token values, for better autocompletion */
	openVal: string
}

/** @internal */
export function beforeParse(ctx: ParsingContext, liveCtx: LiveContext): LiveContext {

	let { details, openVal } = liveCtx;
	const { token } = ctx;

	if (token.val.includes('"')) {
		details.openQuote = true;
		openVal += token.val.slice(1);
	} else if (details.openQuote) {
		openVal += " " + token.val;
	}

	return { ...liveCtx, details, openVal };
}

/** @internal */
export function afterParse(ctx: ParsingContext, liveCtx: LiveContext): LiveContext {

	let { lastContext, contextName, contextStart, details } = liveCtx;
	const { currentContext, token } = ctx;

	if (details.openQuote) return liveCtx;

	// context switched
	if (currentContext !== lastContext) {

		// context closed
		if (lastContext !== false) {
			details.contexts.push({
				range: [contextStart, token.position],
				name: contextName,
				open: (token.open ? true : false)
			});
		}

		// context open
		if (currentContext !== false) {
			contextName = token.val.slice(0, -1);
			contextStart = token.position;
		}

	}

	lastContext = currentContext;

	return { ...liveCtx, lastContext, contextName, contextStart, details };
}

/**
 * @internal
 * Close open contexts, and make auto-completion suggestions
 */
export function finalLivePass(ctx: ParsingContext, liveCtx: LiveContext): Details {
	let { details, lastContext, contextStart, contextName, openVal } = liveCtx;
	const { currentContext, token, filters } = ctx

	// add trailing context
	if (lastContext !== false) {
		details.contexts.push({
			range: [contextStart, token.position + token.length],
			name: contextName,
			open: (token.open ? true : false)
				|| token.commaSeperated
				|| token.val.endsWith(":")
				|| details.openQuote
		});
	}

	// autocomplete

	let l = details.contexts.length;

	let val = token.val;
	if (details.openQuote) {
		val = openVal;
	}

	// suggest context value, if final context is open, and the last parsed context is not free
	if (details.contexts[l - 1]?.open) {

		// search context mappings for match
		let mappings: string[] = [];
		let key: keyof LanguageFilter;

		let finalContext = currentContext || filters[details.contexts[l - 1].name];

		// collapse mapping keys into single array
		for (key in finalContext) {
			const filterContent = finalContext[key];

			if (!filterContent) continue;

			mappings = [...mappings, ...Object.keys(filterContent.mappings)];
		}

		// last token has a full match. user allready input a value
		if ( mappings.includes(val) ) {

			// suggest something only if the user typed a comma
			if (token.commaSeperated) {
				details.autocomplete = deepCopy(mappings);
			}

		}
		else if (token.open) {
			// return all mappings that start with current last value
			details.autocomplete = mappings.filter(s => s.startsWith(val));
		}
		else {
			// return all possible mappings
			details.autocomplete = deepCopy(mappings);
		}

	}
	// free context, suggest a context
	else if (currentContext === false && token.open && !details.openQuote) {

		// see if the avalible contexts match anything the user typed
		// if so, add them to autocompletion
		details.autocomplete = Object.keys(filters).filter(s => 
			s.startsWith(val)
		).map(s => 
			s + ":"
		);

	}

	// finalize the autocompletion strings
	if (details.autocomplete) {

		// filter out suggestions with spaces, if no quotes are used
		if (!details.openQuote) {
			details.autocomplete = details.autocomplete.filter(s => !s.includes(" "));
		}

		// some strings need adjustment. we don't want to suggest, what the user has allready typed
		// we also want to suggest closing open quotes
		details.autocomplete = details.autocomplete.map(suggestion => {
			if (details.openQuote) {
				suggestion += '"';
			}

			if (suggestion.startsWith(val)) {
				// if partial match, remove overlap
				return suggestion.slice(val.length);
			} else {
				return suggestion;
			}
		});

		// some suggestions might now be empty, filter them out
		details.autocomplete = details.autocomplete.filter(s => s !== "");

	}

	return details;

}
