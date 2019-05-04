#!/usr/bin/env node

var program = require("commander");
var pkg = require("./package.json");
const {
  action: changeMappingAction,
  help: changeMappingHelp
} = require("./actions/change-mapping");

program
  .version(pkg.version)
  .command("change-mapping")
  .description("Change the mapping of an index (by alias name)")
  .alias("cm")
  .option("-h, --host <host>")
  .option("-a, --alias-name <alias>")
  .option(
    "-t, --document-type [document-type]",
    "The document_type of the index you want to change the mapping of",
    "doc"
  )
  .option(
    "-i, --input-mapping [input-mapping]",
    "A path to a (JSON) file containing the new mapping"
  )
  .option(
    "-o, --output-mapping",
    "Output the current index mapping (and exit without any changes)"
  )
  .on("--help", changeMappingHelp)
  .action(changeMappingAction);

program.parse(process.argv);
