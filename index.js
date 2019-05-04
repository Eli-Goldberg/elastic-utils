#!/usr/bin/env node

var program = require("commander");
var pkg = require("./package.json");

const applyChangeMappingAction = require("./actions/change-mapping");

// Apply actions here
applyChangeMappingAction(program);

program.version(pkg.version).parse(process.argv);

if (!program.args.length) program.help();
