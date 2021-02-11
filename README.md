# FilterLang

FilterLang is a domain specific language that allows users to safely and effectivley filter a database through the front-end.

## Introduction

FilterLang lets you define your own set of filters a user can input. It is meant to be used for administrative purposes, and front-end database managment.

User inputs are parsed into an intermediate format client-side, and compiled to a databse query server side.
The query can only contain a specific set of instructions, making it a secure, indirect database access, no different than any other api query.

Where the power of FilterLang comes from, is being able to define a huge, versatile set of filters, without having to clutter your ui.
It also simplifies the back-end, by providing a compiled query, instad of having to construct a custom one for every scenario.

Additionally, FilteLang provides a simple form of language server, with the `liveParse` function.
It returns autocompletion suggestions, and context hightlighting, making it easy to build an intuitive input field.

## Getting Started

First, you will need to define your language. For the specification of a language definition, refer to the interface `LanguageDefinition`.

Then, you can construct a new language object, which will check your definition for errors, and convert it to an internal format, which can be used for parsing.

The langauge object can now parse strings, to the intermediate format, ready to be sent server side.

Using typescript, this can be achieved as follows:

```ts
const myDefinition: FilterLang.LanguageDefinition = [
  // your custom filter objects
];

const myLanguage = new FilterLang.Language(myDefinition);

const parsedObj = myLanguage.parse(userInput);

// ...
```

On the server, it can then be compiled, and sent to the Database:

```ts
const pipeline = FilterLang.Compiler.compileToMongoDB(parsedObj);

const results = await database.collection("myCollection").aggregate(pipeline).toArray();
```

## Ways to Filter

FilterLang supports these basic ways to filter data:

* wildcard: indexed text search
* text: simple text comparison
* number: number comparisons (equals, larger, smaller, not-equals)
* date: date comparisons (before, after, on day)
* array: matches array contents from serveral arrays
* location: location sepcific distance filter

These types are not exposed to the user. Instead, custom filters can implement them, by writing your own language definition.

## Example

If our language definition contains the following:

```ts
const langDef: = [
  {
    name: "Color",
    type: "text",
    field: "info.color"
  }
]
```

We can input:

`color: red`

This will compile to the following MongoDB aggregation:

```json
[
  { "$match":
    { "info.color": { "$eq": /^red$/i } } 
  },
  { "$sort": { "_id": -1 } }
]
```
