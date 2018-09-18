## Plugin Support

There are three kinds of plugins:

- *File Loaders* - For reading local config files
- *Remote Resolvers* - For reading remote data sources
- *Translators* - For transforming raw data

### File Loaders

File loaders are plugins that allow Dynamic Config to read local configuration files.

They are defined by this interface:

```typescript
interface IFileLoader {
    type: string
    load(filePath: string): Promise<object>
}
```

Here, `type` is the file extension handled by this loader and `load` is the function to load the file. The `load` function is expected to return a promise of the JavaScript Object loaded from the file.

The JavaScript loader is simple. Let's take a look at it as an example.

```typescript
const jsLoader: IFileLoader = {
    type: 'js',
    async load(filePath: string): Promise<object> {
        const configObj = require(filePath)

        if (typeof configObj.default === 'object') {
            return configObj.default
        } else {
            return configObj
        }
    },
}
```

By the time a loader is called with a `filePath` the path is gauranteed to exist. The `filePath` is absolute.

Loaders are given priority in the order in which they are added. Meaning the most recently added loader has the highest priority. With the default settings this order is json, yaml, js then ts. Therefore, TypeScript files have the highest priority. If there is both a `default.json` file and a `default.ts` file the values from the `default.ts` file will have presidence.

### Remote Resolvers

Remote resolvers are plugins that know how to read data from data sources outside the filesystem.

They are defined by this interface:

```typescript
interface IRemoteResolver {
    type: 'remote' | 'secret'
    name: string
    init(configInstance: IConfigStore, remoteOptions?: IRemoteOptions): Promise<any>
    get<T>(key: string): Promise<T>
    watch<T>(key: string, cb: (val: T) => void): void
}
```

#### `type`

The type parameter can be set to either `remote` or `secret`. The only difference is that `remote` allows for default values.

#### `name`

The name for this remote. This is used to lookup config placeholders, the `_source` property of a placeholder.

#### `init`

The init method is called and resolved before any request to `conifg().get` can be completed. The init method returns a Promise. The resolved value of this Promise is deeply merged with the local config. This is where you load remote configuration that should be available on application startup.

The init method receives an instance of the `IConfigStore` object and any optional parameters that were defined with out config options (the `remoteOptions` piece of our config options). The `IConfigStore` instance is a simple object store that represents the config as it exists at the moment in time that this resolver is being resolved. Remote resolvers are initialized sequentially in the order in which they are registered, meaning a remote resolver has access to all of the config values from remotes that were previously initialized.

The `IConfigStore` interface is as follows:

```typescript
interface IConfigStore {
    get<T = any>(key: string): T | null
    getAll(...args: Array<string>): Array<any>
    getWithDefault<T = any>(key: string, defaultVal: T): T
}
```

This allows a resolver's initialization to rely on configuration loaded through local config files or through a previously loaded remote.

As a reminder, `remoteOptions` could be set in `config-settings.json` as such:

```json
{
    "remoteOptions": {
        "consul": {
            "consulAddress": "http://localhost:8500",
            "consulDc": "dc1",
            "consulKeys": "production-config",
            "consulNamespace": "my-service-name",
        }
    }
}
```

When a resolver with the name `'consul'` is registered this object will be passed to the init method. Therefore, the `remoteOptions` parameter is of the form:

```typescript
interface IRemoteOptions {
    [resolverName: string]: any
}
```

#### `get`

This is easy, given a string key return a value for it. This method is called when a value in the config needs to be resolved remotely. Usually this will be because of a config placeholder. Once this method resolves, the return value will be cached in the config object and this method will not be called for that same key again.

#### `watch`

This alerts the remote that the user is watching a value. If there is machinery to set up to support this do it here. You get the key the user is watching and a callback to use when the value changes.

If your remote doesn't support watching just supply an empty function.

### Translators

Translators are essentially mapping functions that can be used to transform raw values before they are added to the resolved config.

They are defined by this interface:

```typescript
interface IConfigTranslator {
    path?: string | Array<string>
    translate(configValue: any): any
}
```

#### `path`

The path in the config to apply this translator to. By default the translator will be applied to every key in the config. This limits the paths to apply the translator to. Paths can be nested, such as `database.password`.

#### `translate`

The function to translate the value. A simple mapping function, though it should know how to ignore objects it doesn't apply to.

### Registering Plugins

Once you have created a plugin you need to register it with the `DynamicConfig` instance. To do this you need to pass them in to the `config` function the first time you call it.

```typescript
import { DynamicConfig, config, jsonLoader, consulResolver, envTranslator } from '@creditkarma/dynamic-config'

const configInstance: DynamicConfig = config({
    loaders: [ jsonLoader ],
    resolvers: [ consulResolver() ],
    translators: [ envTranslator ]
})
```

*Note: Here `consulResolver` is a function that returns `IRemoteResolver` because there is state that needs to be initialized for this resolver.*
