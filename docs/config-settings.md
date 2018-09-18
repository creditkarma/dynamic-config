# Customizing Your Config Instance

There are three different ways to pass options to your config instance.

1. Through a local file called `config-settings.json`
2. Through environment variables
3. Through command line arguments

The most robust of these is `config-settings.json`.

### Available Options

All available options are optional.

```typescript
interface IConfigSettings {
    configPath?: string
    configEnv?: string
    remoteOptions?: { [name: string]: any }
    resolvers?: Array<string>
    loaders?: Array<string>
    translators?: Array<string>
    schema?: ISchemaMap
}
```

### `configPath`

`type: string`

Path to local configuration files. By default `DynamicConfig` will look for a directory called `config` in your project. It will search in predictable places. It will first look at the project root. It will then search for the `config` directory in `src`, `lib`, `main`, `dist` and `app`.

### `configEnv`

`type: string`

By default `DynamicConfig` will check `NODE_ENV` to determine the current environment. This option will override that.

### `remoteOptions`

`type: object`

These are options that will be passed to [remote resolvers](#remote-configuration). The options are of the following form:

```typescript
interface IRemoteOptions {
    [name: string]: any
}
```

Here the key is the name of the resolver, then when the resolver is instantiated the value here is passed to the initialization of the resolver.

### `resolvers`

`type: Array<string>`

This is a list of the Resolvers to use (more on this later).

The included Resolvers are:

* `env` - Allows reading of environment variables
* `process` - Allows reading of command line args
* `consul` - Allows fetching of remote data from Consul
* `vault` - Allows fetching of remote data from Vault

### `loaders`

`type: Array<string>`

This is a list of FileLoaders to use (more on this later).

The included FileLoaders are:

* `json` - Read JSON files ending with `.json`
* `yaml` - Read YAML files ending with `.yml` or `.yaml`
* `js` - Read JavaScript files ending with `.js`
* `ts` - Read TypeScript files ending with `.ts`

### `translators`

`type: Array<string>`

List of Translators to user. Translators can finese data into a form expected by Dyanmic Config (more on this later).

The included Translators are:

* `env` - Allows usage of environment variables of the form `http://${HOSTNAME}:8080'`
* `consul` - Allos usage of `consul!` urls.

### `schemas`

`type: ISchemaMap`

A map of key names to JSON schema to validate that key.

```typescript
interface ISchemaMap {
    [key: string]: object
}
```

### CONFIG-SETTINGS.JSON

If for instance I wanted to change the path to my local config files I would add a new file `config-settings.json` and add something like this:

```json
{
    "configPath": "./source/config"
}
```

Additionally, if I wanted to only include the resolvers for `env` and `process` and support for only `json` files:

```json
{
    "configPath": "./source/config",
    "resolvers": [ "env", "process" ],
    "loaders": [ "json" ]
}
```

## Environment Variables

Only `configPath`, under the name `CONFIG_PATH`, and `configEnv`, under the name `CONFIG_ENV`, can be set with environment variables.

```sh
$ export CONFIG_PATH=source/config
$ export CONFIG_ENV=development
```

*Note: Some plugins, as is the case with the Consul Resolver, may support additional environment variables*

## Command Line Arguments

The command line supports the same subset of options as environemnt variables

```sh
$ node ./dist/index.js CONFIG_PATH=source/config CONFIG_ENV=development
```

*Note: Some plugins, as is the case with the Consul Resolver, may support additional command line arguments*
