const { Client } = require("@elastic/elasticsearch");
const path = require('path');
const fs = require('fs');

class ElasticService {
  constructor({ logger, host, aliasName, documentType, outputMapping, inputMapping: inputFileMapping }) {
    this.host = host;
    this.logger = logger;
    this.aliasName = aliasName;
    this.documentType = documentType;
    this.isOutputMapping = outputMapping;

    if (inputFileMapping) {
      const inputFilePath = path.resolve(inputFileMapping);
      if (!fs.existsSync(inputFilePath)) {
        throw new Error(`Input file mapping ${inputFileMapping}`);
      }
      this.inputFilePath = inputFilePath;
    }
  }

  async getAliasIndex() {
    const { body: res } = await this.client.indices.getAlias({
      name: this.aliasName
    });
    const indexName = Object.keys(res)[0];
    if (!indexName) {
      throw new Error(
        `Alias '${this.aliasName}' is not associated with any index`
      );
    } else {
      this.log(
        `Found Index '${indexName}' for alias '${this.aliasName}'`
      );
    }
    return indexName;
  }
  async tryCreateClient() {
    const client = new Client({ node: this.host });
    const {
      body: [health]
    } = await client.cat.health({
      format: "json"
    });
    try {
      this.log(
        `Found elasticsearch on host '${this.host}' (status is '${health.status}')`
      );
      return client;
    } catch (error) {
      throw new Error(`Could not establish connection to '${this.host}'`);
    }
  }

  async getCurrentMapping() {
    try {
      const { body: currentMapping } = await this.client.indices.getMapping({
        index: this.indexName,
        type: this.documentType
      });
      return currentMapping[this.indexName].mappings[this.documentType];
    } catch (error) {
      throw new Error(
        `Could not find type '${this.documentType}' on index '${this.indexName}'`
      );
    }
  }

  printOutputMapping() {
    const mappingText = JSON.stringify(this.currentMapping, null, 2);
    console.log(mappingText);
  }

  printMapping() {
    this.log(
      `\nFound mapping:\n\n${Object.entries(this.currentMapping)
        .map(([key, val]) => `${key}->${val.type}`)
        .join("\n")}`
    );
  }

  get log() {
    return this.logger.log;
  }

  createTmepIndexName() {
    // Create a timestamp of sort yyyy-MM-dd-HH24-mm-ss
    const timeStamp = new Date()
      .toISOString()
      .split(".")[0]
      .replace(/[^0-9]/g, "-");
    const tempIndexName = `${indexName}-${timeStamp}`;
  }

  async changeMapping() {
    // Get the index of the alias
    // Get the current (old) mapping of the index

    this.client = await this.tryCreateClient();

    this.indexName = await this.getAliasIndex();

    const currentMappingRes = await this.getCurrentMapping();

    this.noDynamic = currentMappingRes.dynamic == "false" ? true : false;
    this.currentMapping = currentMappingRes.properties;

    if (this.isOutputMapping) {
      this.printOutputMapping();
      return;
    }

    this.printMapping();

    this.tempIndexName = this.createTmepIndexName();

    // Clone the mapping, make the changes

    // Reindex into the temp index
    const res = await client.reindex({
      conflicts: "proceed",
      body: {
        source: {
          index: indexName
        },
        dest: {
          index: tempIndexName
        }
      }
    });

    // Divert the alias to the temp index

    // Delete the index with the old mapping

    // Recreate the index with the new mapping

    // Reindex from the temp index to the new mapping index

    // Divert the alias back to the old index

    // Delete the temp index
  }
}

module.exports = ElasticService;
