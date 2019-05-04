const ElasticService = require("../elasticService");

const mandatoryFields = { host: "host", aliasName: "--alias-name" };

const action = (program) => {
  if (program.outputMapping && program.inputMapping) {
    console.error(`Can't specify both --output-mapping and --input-mapping`);
    process.exit(1);
  }
  if (!program.outputMapping && !program.inputMapping) {
    console.error(`Need to specify either --output-mapping or --input-mapping`);
    process.exit(1);
  }

  Object.keys(mandatoryFields).forEach(field => {
    if (program[field] === undefined) {
      console.error(`'${mandatoryFields[field]}' must be specified`);
      process.exit(1);
    }
  });

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
  logger.log(options);

  // If we're going to print out the mapping, only non-error messages should be logged;
  options.logger = logger;
  const elasticService = new ElasticService(options);

  elasticService.changeMapping().catch(console.error);
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
}

module.exports = {
  action,
  help
};
