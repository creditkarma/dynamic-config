# Plugins

There are three kinds of plugins:

- *File Loaders* - For reading local config files
- *Remote Resolvers* - For reading remote data sources
- *Translators* - For transforming/validating raw data

## File Loaders

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

Loaders are given priority in the order in which they are added. Meaning the most recently added loader has the highest priority. With the config singleton this order is json, yaml, js then ts. Therefore, TypeScript files have the highest priority. If there is both a `default.json` file and a `default.ts` file the values from the `default.ts` file will have presidence.

## Remote Resolvers

Registering a remote resolver is fairly straight-forward. You use the `register` method on your config instance.

*Note: You can only register remote resolvers until your first call to `config.get()`. After this any attempt to register a resolver will raise an exception.*

```typescript
import { DynamicConfig, IRemoteOptions } from '@creditkarma/dynamic-config'

const config: DynamicConfig = new DynamicConfig()

config.register({
    type: 'remote'
    name: 'consul',
    init(instance: DynamicConfig, options: IRemoteOptions): Promise<any> {
        // Do set up and load any initial remote configuration
    },
    get<T>(key: string): Promise<T> {
        // Fetch your key
    }
})
```

The `register` method will accept a comma-separated of resolver objects.

For additional clarity, the resolver objects have the following TypeScript interface:

```typescript
interface IRemoteResolver {
    type: 'remote' | 'secret'
    name: string
    init(dynamicConfig: DynamicConfig, remoteOptions?: IRemoteOptions): Promise<any>
    get<T>(key: string): Promise<T>
}
```

You can also pass resolvers on the options object passed directly to the constructor:

```typescript
import { DynamicConfig, IRemoteOptions } from '@creditkarma/dynamic-config'

const config: DynamicConfig = new DynamicConfig({
    resolvers: [{
        type: 'remote'
        name: 'consul',
        init(instance: DynamicConfig, options: IRemoteOptions): Promise<any> {
            // Do set up and load any initial remote configuration
        },
        get<T>(key: string): Promise<T> {
            // Fetch your key
        }
    }]
})
```

#### `type`

The type parameter can be set to either `remote` or `secret`. The only difference is that `remote` allows for default values.

#### `name`

The name for this remote. This is used to lookup config placeholders. We'll get to that in a bit.

#### `init`

The init method is called and resolved before any request to `get` can be completed. The init method returns a Promise. The resolved value of this Promise is deeply merged with the local config files. This is where you load remote configuration that should be available on application startup.

The init method receives an instance of the `DynamicConfig` object it is being registered on and any optional parameters that we defined on the `DynamicConfig` instance.

To define `IRemoteOptions` for a given remote resolver we use the `remoteOptions` parameter on the constructor config object:

```typescript
const config: DynamicConfig = new DynamicConfig({
    remoteOptions: {
        consul: {
            consulAddress: 'http://localhost:8500',
            consulKvDc: 'dc1',
            consulKeys: 'production-config',
        }
    }
})
```

When a resolver with the name `'consul'` is registered this object will be passed to the init method. Therefore, the `remoteOptions` parameter is of the form:

```typescript
interface IRemoteOptions {
    [resolverName: string]: IResolverOptions
}
```

#### `get`

This is easy, given a string key return a value for it. This method is called when a value in the config needs to be resolved remotely. Usually this will be because of a config placeholder. Once this method resolves, the return value will be cached in the config object and this method will not be called for that same key again.

## Translators

When data is loaded from a local file or remote source it is parsed, usually `JSON.parse`, and then added to the resolved config object that you request values from. Sometimes, particularly when dealing with remote sources, the data coming in may not be exactly the shape you want, or it may be somewhat unreliable. Translators allow you to rewrite this data before it is added to the resolved config.

As a concrete example of this we will look at environment placeholders. A config placeholder is an object that looks something like this:

```json
{
    "host": {
        "_source": "env",
        "_key": "HOSTNAME"
    }
}
```

This form is specific to Dynamic Config. A very common way for envirnoment variables to appear is:

```json
{
    "host": "$HOSTNAME"
}
```

There is a Translator bundled with Dyanmic Config that will rewrite this second form into the first. That way you can write environment variables in a more standard fashion, but Dynamic Config can still get the objects it is designed to work with.
