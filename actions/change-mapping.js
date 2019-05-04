const ElasticService = require("../elasticService");

const mandatoryFields = { host: "host", aliasName: "--alias-name" };

const action = program => {
  validate(program);

  const {
    host,
    documentType,
    aliasName,
    outputMapping,
    inputMapping
  } = program;

  const options = {
    host,
    documentType,
    aliasName,
    outputMapping,
    inputMapping
  };

  const logger = { log: (...rest) => !outputMapping && console.log(...rest) };
  logger.log(`\nOptions chosen:`);
  logger.log(options);
  logger.log();

  // If we're going to print out the mapping, only non-error messages should be logged;
  options.logger = logger;
  runChangeMapping(options)
};

async function runChangeMapping(options) {
  try {
    const elasticService = new ElasticService(options);
    await elasticService.changeMapping()
  } catch (error) {
    console.error(error.message)
    process.exit(1);
  }
}

const validate = program => {
  Object.keys(mandatoryFields).forEach(field => {
    if (program[field] === undefined) {
      console.error(`Missing argument: '${mandatoryFields[field]}'`);
      process.exit(1);
    }
  });

  if (program.outputMapping && program.inputMapping) {
    console.error(`Can't specify both --output-mapping and --input-mapping`);
    process.exit(1);
  }
  if (!program.outputMapping && !program.inputMapping) {
    console.error(`Need to specify either --output-mapping or --input-mapping`);
    process.exit(1);
  }
};

const help = () => {
  console.log(`
    This utility help you change the mapping of an index in Elasticsearch.
    It does so by executing the following steps:    

    - Create an index called 'my-index-prod-temp' (temporary) with the new specified mapping
    - Reindex from 'my-index-prod' (old) index to 'my-index-prod-temp' (temp) index
    - Divert the alias from 'my-index-prod' (old) index to 'my-index-prod-temp' (temporary) index
    - Delete the 'my-index-prod' (old) index (containing the old mapping)
    - Recreate 'my-index-prod' (new) index with the same name, containing the new mapping
    - Reindex from 'my-index-prod-temp' (temp) index to 'my-index-prod' (new) index
    - Divert the alias back to the 'my-index-prod (new) index
    - Delete the temp index
  `);
  console.log("Examples:");
  console.log();
  console.log(
    "  # Will output the current mapping of the index tied to alias 'my-index-alias"
  );
  console.log(
    "  $ elastic change-mapping -h http://localhost:9200 -a my-index-alias -o"
  );
  console.log();
  console.log(
    "  # Will output the current mapping of the index tied to alias 'my-index-alias"
  );
  console.log("  # and document_type 'doc', and then start migrating");
  console.log(
    "  $ elastic change-mapping -h http://localhost:9200 -a my-index-alias -i ./new-mapping.json"
  );
};
const applyAction = program => {
  program
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
    .on("--help", help)
    .action(action);
  return program;
};
module.exports = applyAction;
