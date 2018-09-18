# Dynamic Config

A dynamic configuration library for Node.js written in TypeScript.

Application configuration can be an unnecessarily complicated problem when working in large distributed systems across multiple runtimes. Gaining consensus about what configuration needs to do, what it needs to look like and how it interfaces with a specific runtime can be nearly impossible. Dynamic Config is designed to be highly adaptable to a variety of requirements. It is built on a plugin architecture that allows it to be adapted further. Beyond this, it handles local configuration files in a way consistent with other popular Node config libraries.

### Plugable

Plugins for Dynamic Config provide extensible support for loading local file types, talking to remote data stores and transforming/validating config structures.

#### File Types

Support for config file types is added through plugins. Dynamic Config comes with plugins for `js`, `ts`, `json` and `yaml` files. It is easy to add support for additional file types.

#### Remote Data Sources

Dynamic Config also supports remote data sources through plugins. The included plugins include clients for pulling values from Hashicorp Consul and Vault. The plugin interface is also used for adding support for environment variables and command line arguments.

#### Transformation

The third kind of plugin is something we call a translator. When raw config values are loaded, either form local files or remote sources, you can use translators to transform the structure of the raw data before it is added to the resolved config object.

#### Validation

The fourth thing we can do is validate the structure of our config. This is done by mapping keys in the config to JSON schema.

### Promise-based

When requesting a value from Dynamic Config a Promise of the expected result is returned. If the value is found the Promise is resolved. If the value is not found, either because it is missing or some other error, the Promise is rejected with an error describing why the value may be missing.

## Table of Contents

- [Getting Started](docs/getting-started.md)
- [API Overview](docs/api-overview.md)
- [Customizing Your Config Instance](docs/config-settings.md)
- [Config Resolution](docs/config-resolution.md)
- [Translators](docs/translators.md)
- [Plugin Support](docs/plugins.md)

## Contributing

For more information about contributing new features and bug fixes, see our [Contribution Guidelines](https://github.com/creditkarma/CONTRIBUTING.md).
External contributors must sign Contributor License Agreement (CLA)

## License

This project is licensed under [Apache License Version 2.0](./LICENSE)
