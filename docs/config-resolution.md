## Local Configuration

Local configuration files are stored localally with your application source, typically at the project root in a directory named `config/`. The config path can be set as an option if you do not wish to use the default resolution.

### Default Configuration

The default config for your app is loaded from the `config/default.(json|yml|js|ts...)` file. The default configuration is required.

### File Types

File types are loaded in a predictable order. They are loaded in the order in which their FileLoaders are registered with the config instance. By default this order is `json`, `yaml`, `js` and finally `ts`. This means that if you have multiple files with the same base name but different extensions (`default.json` vs `default.ts`) the two files have different presidence based on their extension. JSON files are merged first, then YAML file, then JS and finally TS. This means that `ts` files have the highest presidence as their values are merged last.

#### TypeScript

Using TS files is convinient for co-locating your configs with the TypeScript interfaces for those configs.

#### Exporting Values from TypeScript and JavaScript

When exporting config values from a `ts` or `js` file you can either use named or default exports.

Named exports:

```typescript
export const server = {
    hostName: 'localhost',
    port: 8080,
}

export const database = {
    username: 'root',
    password: 'root',
}
```

Default exports:

```typescript
export default {
    server: {
        hostName: 'localhost',
        port: 8080,
    },
    database: {
        username: 'root',
        password: 'root',
    }
}
```

Either of these will add two keys to the compiled application config object.

You can get at these values as:

```typescript
import { config } from '@creditkarma/dynamic-config'

export async function createHttpClient(): Promise<Client> {
    const host: string = await config().get('server.hostName')
    const port: number = await config().get('server.port')
    return new Client(host, port)
}
```

#### Returning Promises

FileLoaders can return objects that contain Promises as values. Dynamic Config will resolve all Promises while building the ultimate representation of your application config.

As an example, this could be your local `js` config file:

```typescript
export const server = Promise.resolve({
    hostName: 'localhost',
    port: 8080
})
```

Then when you fetch from Dynamic Config the Promise in your config is transparent:

```typescript
import { config } from '@creditkarma/dynamic-config'

export async function createHttpClient(): Promise<Client> {
    const host: string = await config().get('server.hostName')
    const port: number = await config().get('server.port')
    return new Client(host, port)
}
```

Promises can also be nested, meaning keys within your returned config object can also have Promise values. Dynamic Config will recursively resolve all Promises before placing values in the resolved config object.

This API can be used for loading config values from sources that don't neatly fit with the rest of the API. It does however make configs more messy and should ideally be used sparingly. We'll cover how to get values from remote sources in a more organized fashion shortly.

*Note: If a nested Promise rejects the wrapping Promise also rejects and all values within the wrapping Promise are ignored.*

### Local Environment Overrides

You can override the values from the default config in a variety of ways, but they must follow the schema set by your default configuration file. Overwriting the default values is done by adding additional files corresponding to the value of `NODE_ENV`. For example if `NODE_ENV=development` then the default configuration will be merged with a file named `config/development.(json|yml|js|ts...)`. Using this you could have different configuration files for `NODE_ENV=test` or `NODE_ENV=production`.

### Config Path

To override the path to your local config files check out [Customizing Your Config Instance](#customizing-your-config-instance).

[back to top](#table-of-contents)

## Remote Configuration

When we say remote configuration we mean any configuration that is not part of the static files checked-in with your source code. This can be data stored in another service, such as Consul or Vault, or it can be something simple like environment variables or command line arguments.

Remote configuration allows you to deploy configuration independently of your application source, allowing for configuration per datacenter, per host or per cluster. Potentially it also allows for runtime changes for some config values (something on the roadmap for this library).

In this section we are going to look at the resolvers that ship with `DefaultConfig`. These are: env, process, consul and vault.

*Note: If you are interested in adding your own plugin checkout the [Plugins](#plugins) section.*

There are two things a remote resolver can do:

#### 1. Load full configuration to overlay local configs

When the `DynamicConfig` instance is initialized all registered resolvers are given the opportunity to load config data to overlay the local config, giving remote config a higher priority than local config. With the included resolvers only the Consul resolver takes advantage of this.

#### 2. Load values on a per-key basis

When we overviewed the `DynamicConfig` API we saw methods called `getRemoteValue` and `getSecretValue`. These methods delegate to resolvers to find values. In addition to this, you can use placeholders, both in local config and remote config, to call out that the value for a key needs to be loaded from another data source.

### Config Placeholders

Before moving on it's important to discuss config placeholders. The dominate use-case for `DynamicConfig` is to think of the resolved config object as a piece of JSON that you use the library to query. However, there are instances where you need to call out that a value in your config needs to be resolved from some other source. This is a config placeholder.

For instance, if you wanted to say that a value was a secret and needed to be loaded from a secure source like Vault you would do something like this:

```json
{
    "database": {
        "username": "root",
        "password": {
            "_source": "vault",
            "_key": "my-service/password"
        }
    }
}
```

Using the default configuration for Vault, the database password will be requested from http://localhost:8200/secret/my-service/password.

Okay, so a config place holder is an object with two required parameters `_source` and `_key` and two optional parameters `_type` and `_default`. When a resolver is registered with the library it is registered by name. This name is what the `_source` property points to.

The interface:

```typescript
interface IConfigPlaceholder {
    _source: string
    _key: string
    _default?: any
    _type?: 'string' | 'number' | 'object' | 'array' | 'boolean'
    _nullable?: boolean
}
```

* `_source` - The name of the resolver to process the key.
* `_key` - A string to ask the resolver for.
* `_default` - A default value for the case that placeholder resolution fails. Default values are ignored for resolvers that are registered as 'secret' stores.
* `_type` - Indicates how to try to parse this value. If no type is provided then the raw value returned from the source is used (usually a string). This value is given to the underlying resolver to make decisions. Some resolvers (as is the case with included Consul and Vault resolvers) may choose to ignore the `_type` property.
* `_nullable` - Indicates that the value may be missing. In this case if someone calls `get` for a nullable key `null` will be returned as the expected value of the key. Usually if they value is not found an error is raised.

#### Evnironment Placeholders

Environment placeholders are used to override config values with envirnoment variables. Environment placeholders are resolved with a special internal resolver similar to what we have already seen.

An envirnoment place holder is called out by having your placeholder `_source` property set to `'env'`.

```json
"server": {
    "host": {
        "_source": "env",
        "_key": "HOSTNAME",
        "_default": "localhost"
    },
    "port": 8080
}
```

Here `_key` is the name of the environment variable to look for. You can use `_default` for environment placeholders.

#### Process Placeholders

Similar to environment placeholders, process placeholders allow you to override config values with values passed in on the command line.

A process place holder is called out by having your placeholder `_source` property set to `'process'`.

```json
"server": {
    "host": {
        "_source": "process",
        "_key": "HOSTNAME",
        "_default": "localhost"
    },
    "port": 8080
}
```

Then when you start your application you can pass ine `HOSTNAME` as a command line option.

```sh
$ node my-app.js HOSTNAME=localhost
```

Process placeholders must be of this form `<name>=<value>`. The equal sign (`=`) is required.

Here `_key` is the name of the argument variable to look for. You can use `_default` for process placeholders.

### Config Resolution

Remote configuration is given a higher priority than local configuration. Local configuration is resolved, an initial configuration object it generated. Then all registered resolvers, in the order they were registered, are given the opportunity to provide additional configuration to overlay what was available locally.

#### Config Overlay

As a further example of how configs are resolved. Here is an example of config overlay.

My local config files resolved to something like this:

```json
{
    "server": {
        "host": "localhost",
        "port": 8080
    },
    "database": {
        "username": "root",
        "password": "root"
    }
}
```

And Consul returned an object like this:

```json
{
    "server": {
        "port": 9000
    },
    "database": {
        "password": "test"
    }
}
```

The resulting config my app would use is:

```json
{
    "server": {
        "host": "localhost",
        "port": 9000
    },
    "database": {
        "username": "root",
        "password": "test"
    }
}
```

Config objects from all sources are deeply merged.

### Consul Resolver

Dynamic Config ships with support for Consul. Now we're going to explore some of the specifics of using the included Consul resolver. The underlying Consul client comes from: [@creditkarma/consul-client](https://github.com/creditkarma/consul-client).

Values from Consul can be read in two ways:

1. Consul can provide full config to overlay local config.
2. Consul can provide values on a per-key basis.

#### Configuring Consul

Even though the resolver for Consul is included by default, it will not be used unless it is configured.

The available options are:

* `CONSUL_ADDRESS` - (required) Address to Consul agent.
* `CONSUL_DC` - (required) Data center to receive requests.
* `CONSUL_KEYS` - (optional) Comma-separated list of keys pointing to configs stored in Consul. They are merged in left -> right order, meaning the rightmost key has highest priority.
* `CONSUL_NAMESPACE` - (optional) A string to prepend to all Consul look ups.

`CONSUL_ADDRESS` and `CONSUL_DC` are required and are just about getting the connection to Consul up. `CONSUL_KEYS` is optional but more interesting. `CONSUL_KEYS` is a  comma-separated list of keys to pull from Consul. These keys should point to JSON structures that can overlay the local configs. These values will be pulled when the resolver is initialized.

These options can be set as environment variables:

```sh
$ export CONSUL_ADDRESS=http://localhost:8500
$ export CONSUL_DC=dc1
$ export CONSUL_KEYS=production-config,production-east-config
$ export CONSUL_NAMESPACE=my-service-name
```

You can also set these on the command line:

```sh
$ node my-app.js CONSUL_ADDRESS=http://localhost:8500 CONSUL_DC=dc1 CONSUL_KEYS=production-config,production-east-config CONSUL_NAMESPACE=my-service-name
```

Or, you can set them in `config-settings.json`:

```json
{
    "remoteOptions": {
        "consul": {
            "consulAddress": "http://localhost:8500",
            "consulDc": "dc1",
            "consulKeys": "production-config,production-east-config",
            "consulNamesapce": "my-service-name",
        }
    }
}
```

### Vault Resolver

The configuration for Vault needs to be available somewhere in the config path, either in a local config or in Consul (or some other registered remote). This configuration mush be available under the key name `'hashicorp-vault'`.

If Vault is not configured all calls to get secret config values with error out.

The configuration must conform to what is expected from [@creditkarma/vault-client](https://github.com/creditkarma/vault-client).

```json
"hashicorp-vault": {
    "apiVersion": "v1",
    "protocol": "http",
    "destination": "localhost:8200",
    "mount": "secret",
    "namespace": "",
    "tokenPath": "./tmp/token",
    "requestOptions": {}
}
```
