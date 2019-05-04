const { Client } = require("@elastic/elasticsearch");
const path = require("path");
const fs = require("fs");
const readline = require("readline");

class ElasticService {
  constructor({
    logger,
    host,
    aliasName,
    documentType,
    outputMapping,
    inputMapping: inputFileMapping
  }) {
    this.host = host;
    this.logger = logger;
    this.aliasName = aliasName;
    this.documentType = documentType;
    this.isOutputMapping = outputMapping;

    if (inputFileMapping) {
      const inputFilePath = path.resolve(inputFileMapping);
      if (!fs.existsSync(inputFilePath)) {
        throw new Error(`File missing: ${inputFilePath}`);
      }

      try {
        this.inputMapping = JSON.parse(fs.readFileSync(inputFilePath));
      } catch (error) {
        throw new Error(`Invalid JSON in ${inputFilePath}`);
      }
    }
  }

  async getAliasIndex() {
    let indexName;
    try {
      const { body: res } = await this.client.indices.getAlias({
        name: this.aliasName
      });
      indexName = Object.keys(res)[0];
    } catch (error) {}
    if (!indexName) {
      throw new Error(
        `Alias '${this.aliasName}' is not associated with any index`
      );
    } else {
      this.log(`Found Index '${indexName}' for alias '${this.aliasName}'`);
    }
    return indexName;
  }
  async tryCreateClient() {
    const client = new Client({ node: this.host });
    try {
      const {
        body: [health]
      } = await client.cat.health({
        format: "json"
      });

      this.log(
        `Found elasticsearch on host '${this.host}' (status is '${
          health.status
        }')`
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
        `Could not find type '${this.documentType}' on index '${
          this.indexName
        }'`
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

  buildTempIndexName() {
    // Create a timestamp of sort yyyy-MM-dd-HH24-mm-ss
    const timeStamp = new Date()
      .toISOString()
      .split(".")[0]
      .replace(/[^0-9]/g, "-");
    const tempIndexName = `${this.indexName}-temp-${timeStamp}`;
    return tempIndexName;
  }

  async createIndex({ indexName, mapping }) {
    const mappings = {
      [this.documentType]: {
        properties: mapping
      }
    };
    if (this.noDynamic) {
      mappings[this.documentType].dynamic = "false";
    }
    try {
      // Create a temporary index with the new specified mapping
      await this.client.indices.create({
        index: indexName,
        body: {
          mappings
        }
      });
    } catch (error) {
      console.error(`Could not create index '${indexName}'`);
      throw error;
    }
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

    this.tempIndexName = this.buildTempIndexName();
    await this.changeMappingStage1();

    await this.waitForUserInput(
      `Please check the new index is functioning properly, and press ENTER to continue...`
    );

    await this.changeMappingStage2();
  }

  async waitForUserInput(message) {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });

    return new Promise(resolve =>
      rl.question(message, ans => {
        rl.close();
        resolve(ans);
      })
    );
  }

  // In this stage we prepare a copy of the current index with the new mapping,
  // we can still roll back until we delete the original index with the old mapping is delted
  async changeMappingStage1() {
    try {
      // Create a temporary index with the new specified mapping
      await this.createIndex({
        indexName: this.tempIndexName,
        mapping: this.inputMapping
      });

      // Reindex from the old index to the temp index
      await this.reindex({ from: this.indexName, to: this.tempIndexName });

      // Divert the alias from the old index to the temp temporary index
      await this.divertAlias({
        alias: this.aliasName,
        currentIndex: this.indexName,
        newIndex: this.tempIndexName
      });

      // Delete the temp index
    } catch (error) {
      try {
        console.error(`Rolling back: Divert alias back to old`);
        await this.divertAlias({
          alias,
          currentIndex: this.tempIndexName,
          newIndex: this.indexName
        });
      } catch (error) {
        console.error(`Could not roll back alias (temp to old)`);
      }

      try {
        console.error(`Rolling back: Temp Index`);
        await this.client.indices.delete({
          index: this.tempIndexName
        });
      } catch (error) {
        console.error(`Could not roll back index creation`);
      }

      throw error;
    }
  }

  // In this stage We have a working copy with the new mapping and all future
  // requests are already working with the new index.
  // We can't rollbback anymore once this stage starts

  // TODO: In the previous stage - Another reindex is required
  // to add items which were written to the old index
  // while were reindexing but the alias was not yet diverted (or write to both, currently not possible)
  // Same goes with the other direction (current stage)
  async changeMappingStage2() {
    // Delete the old index (containing the old mapping)
    await this.client.indices.delete({ index: this.indexName });

    // Recreate the old index as the new index with the same name, containing the new mapping
    await this.createIndex({
      indexName: this.indexName,
      mapping: this.inputMapping
    });

    // Reindex from the temp index to the new index
    await this.reindex({ from: this.tempIndexName, to: this.indexName });

    // Divert the alias back to the new index
    await this.divertAlias({
      alias: this.aliasName,
      currentIndex: this.indexName,
      newIndex: this.tempIndexName
    });

    // Delete the temp index
    await this.client.indices.delete({ index: this.tempIndexName });
  }

  async divertAlias({ alias, currentIndex, newIndex }) {
    await this.client.indices.removeAlias({
      name: alias,
      index: currentIndex
    });
    await this.client.indices.putAlias({
      name: alias,
      index: newIndex
    });
  }

  async reindex({ from, to }) {
    try {
      this.logger.log(`Reindex from '${from}' to '${to}'...`);
      const res = await this.client.reindex({
        conflicts: "proceed",
        body: {
          source: {
            index: from
          },
          dest: {
            index: to
          }
        }
      });
      logger.log(`Reindex done`);
    } catch (error) {
      console.error(`Reindex failed`, error.message);
      throw error;
    }
  }
}

module.exports = ElasticService;
