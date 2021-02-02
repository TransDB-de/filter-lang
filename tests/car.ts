import * as FilterLang from "../source/index.js";

const langDef: FilterLang.LanguageDefinition = [
	{
		name: "Color",
		type: "text",
		field: "info.color"
	}
]

const language = new FilterLang.Language(langDef);

const input = "color: red";

let intermediate = language.parse(input);

console.log(
	JSON.stringify(
		FilterLang.Compiler.compileToMongoDB(intermediate)
	)
)
