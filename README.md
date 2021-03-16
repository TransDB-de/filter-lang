# FilterLang

FilterLang is a domain specific language that allows users to safely and effectivley filter a database through the front-end.

## Installing

Install the package with:

`npm install transdb-de/filter-lang`

You can now use it in your code with:

`import * as filterLang from "@transdb-de/filter-lang"`

## About

FilterLang lets you define your own set of filters a user can input. It is meant to be used for administrative purposes, and front-end database managment.

User inputs are parsed into an intermediate format client-side, and compiled to a databse query server side.
The query can only contain a specific set of instructions, making it a secure, indirect database access, no different than any other api query.

Where the power of FilterLang comes from, is being able to define a huge, versatile set of filters, without having to clutter your ui.
It also simplifies the back-end, by providing a compiled query, instad of having to construct a custom one for every scenario.

Additionally, FilteLang provides a simple form of language server, with the `liveParse` function.
It returns autocompletion suggestions, and context hightlighting, making it easy to build an intuitive input field.

## Guide

See the [Wiki](https://github.com/TransDB-de/filter-lang/wiki) for guides and documentation.
