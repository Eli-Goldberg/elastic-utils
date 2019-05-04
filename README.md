# elastic-utils

A command line utility for common Elasticsearch maintenance precodures

This utility help you change the mapping of an index in Elasticsearch.

## change-mapping

```$ elastic-utils change-mapping [options]```

Suppose you have an index called 'my-index-prod' and it has an alias called 'my-index'.

The steps to change the current mapping of 'my-index-prod' would consist of:

- Create an index called 'my-index-prod-temp' (temporary) with the new specified mapping
- Reindex from 'my-index-prod' (old) index to 'my-index-prod-temp' (temp) index
- Divert the alias from 'my-index-prod' (old) index to 'my-index-prod-temp' (temporary) index
- Delete the 'my-index-prod' (old) index (containing the old mapping)
- Recreate 'my-index-prod' (new) index with the same name, containing the new mapping
- Reindex from 'my-index-prod-temp' (temp) index to 'my-index-prod' (new) index
- Divert the alias back to the 'my-index-prod (new) index
- Delete the temp index

## Usage

```
$ npx elastic-utils change-mapping --help

options

    -h, --help                           output usage information
    -h, --host <host>                    
    -a, --alias-name <alias>             
    -t, --document-type [document-type]  The document_type of the index you want to change the mapping of
    -i, --input-mapping [input-mapping]  A path to a (JSON) file containing the new mapping
    -o, --ouptput-mapping                Output the current index mapping (and exit without any changes)
```

## Examples:
```
  # Will output the current mapping of the index tied to alias 'my-index-alias
  $ elastic change-mapping -h http://localhost:9200 -a my-index-alias -o
  
  
# Will output the current mapping of the index tied to alias 'my-index-alias
  # and document_type 'doc', and then start migrating
  $ elastic change-mapping -h http://localhost:9200 -a my-index-alias -i ./new-mapping.json
```

