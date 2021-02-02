import fs from "fs"
import * as FilterLang from "../source/index.js";

const generalFields = {
	"Stadt": "address.city",
	"Postleitzahl": "address.plz",
	"PLZ": "address.plz",
	"Straße": "address.street",
	"Hausnummer": "address.house",

	"Name": "name",
	"Vorname": "firstName",
	"Nachname": "lastName",
	"email": "email",
	"website": "website",
	"telefon": "telephone",

	"Besonderheiten": "meta.specials",
	"Thema": "meta.subject"
}

const langDef: FilterLang.LanguageDefinition = [
	{
		name: "ist",
		negationSuffix: "nicht",
		type: "text",
		field: "type",
		mappings: {
			"gruppe": "group",
			"therapeut": "therapist"
		}
	},

	{
		name: "ist",
		negationSuffix: "nicht",
		type: "include",
		mappings: {
			"Freigeschaltet": "approved"
		}
	},

	{
		name: "bietet",
		negationSuffix: "nicht",
		type: "array-contains",
		fields: [ "meta.attributes", "meta.offers" ],
		mappings: {
			"guteLaune": "good_mood"
		}
	},

	{
		name: "macht",
		negationSuffix: "nicht",
		type: "array-contains",
		fields: [ "meta.attributes", "meta.offers" ],
		mappings: {
			"glücklich": "happy"
		}
	},

	{
		name: "hat",
		negationSuffix: "nicht",
		type: "include",
		mappings: {
			...generalFields,
			"Mindestalter": "meta.minAge"
		}
	},

	{
		type: "text",
		mappings: generalFields
	},

	{
		name: "eingereicht",
		type: "date-compare",
		suffixes: ["am", "vor", "nach"],
		field: "submittedTimestamp"
	},

	{
		name: "freigeschaltet",
		type: "date-compare",
		suffixes: ["am", "vor", "nach"],
		field: "approvedTimestamp"
	},

	{
		name: "freigeschaltet-von",
		type: "text",
		field: "approvedBy"
	},

	{
		name: "umgebung",
		type: "location",
		field: "location"
	},

	{
		name: "mindestalter",
		type: "number",
		negationSuffix: "ist-nicht",
		field: "meta.minAge",
		suffixes: [ "ist", "unter", "über" ]
	},

	{
		name: "nicht",
		type: "wildcard-not"
	}
]

let command;

command = "uwu ist:freigeschaltet hat:freizeitangebote freigeschaltet-am: 03.1.22";



command = "uwu ist:freigeschaltet ist:gruppe hat:mindestalter hat-nicht:thema";


command = "uwu nicht: owo gruppe";

command = "umgebung: essen, 10km";

command = "dr doctorson  eingereicht-am: 1.10"

command = "hat: straße, stadt   ist"

command = 'hat:mindestalter mindestalter-über: 10 mindestalter-unter:26'

command = '"viele viele viele worte"'

command = "uwu ist:freigeschaltet hat-nicht:freizeitangebote, transfocus";

command = 'bietet: gibtsnix, ist: "f'

console.log(FilterLang.Lexer.tokenize(command));

console.time("startLang")
let myLang = new FilterLang.Language(langDef);
console.timeEnd("startLang")

console.time("parsing");
let parsed = myLang.parse(command);
console.timeEnd("parsing");

console.log(parsed);

console.time("compiling");
let aggregation = FilterLang.Compiler.compileToMongoDB(parsed)
console.timeEnd("compiling");

let log = JSON.stringify(myLang.liveParse(command), undefined, 2);
//let log = JSON.stringify(aggregation, undefined, 2);

fs.writeFileSync("log.json", log);
