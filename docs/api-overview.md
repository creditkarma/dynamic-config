## API Overview

As we saw in [Getting Started](getting-started.md) our `DynamicConfig` object is accessed through a function called `config`. This function is used to lazily create a singleton instance of the underlying `DynamicConfig` class. Subsequent calls to this function return the same instance.

```typescript
import { config } from '@creditkarma/dynamic-config'

export async function createHttpClient(): Promise<Client> {
    const host: string = await config().get<string>('hostName')
    const port: number = await config().get<number>('port')
    return new Client(host, port)
}
```

### Instance Methods

The availabe methods on a config instance are as follows:

#### `get`

Gets the value for a specified key. If the key cannot be found the Promise is rejected with an `Error` describing what went wrong.

```typescript
import { config } from '@creditkarma/dynamic-config'

export async function createHttpClient(): Promise<Client> {
    const host: string = await config().get<string>('host')
    const port: number = await config().get<number>('port')
    return new Client(host, port)
}
```

The key you pass to `get` can reference a nested object. If, for instance, your config looked like this:

```json
{
    "server": {
        "host": "localhost",
        "port": 8080
    }
}
```

You could access values like so:

```typescript
import { config } from '@creditkarma/dynamic-config'

export async function createHttpClient(): Promise<Client> {
    const host: string = await config().get<string>('server.host')
    const port: number = await config().get<number>('server.port')
    return new Client(host, port)
}
```

#### `getWithDefault`

You can also assign a default value in the event that the key cannot be found.

```typescript
import { config } from '@creditkarma/dynamic-config'

export async function createHttpClient(): Promise<Client> {
    const host: string = await config().getWithDefault<string>('host', 'localhost')
    const port: number = await config().getWithDefault<number>('port', 8080)
    return new Client(host, port)
}
```

#### `getAll`

Additionally, you can batch get config values. The promise here will only resolve if all of the keys can be retrieved.

```typescript
import { config } from '@creditkarma/dynamic-config'

export async function createHttpClient(): Promise<Client> {
    const [ host, port ] = await config().getAll('host', 'port')
    return new Client(host, port)
}
```

#### `watch`

This is like `get` except it returns an Observable-like object of the config value. The Observable satisfies the `IVariable` interface:

```typescript
interface IVariable<T> {
    onValue(callback: (val: T) => void): void
}
```

If there are values in your config that may change at runtime, this gives you the option to watch those values and make appropriate adjustments. A realistic usage of this would be to back feature flags for ramping new code.

```typescript
import { config } from '@creditkarma/dynamic-config'

const watchedValue: string = config().watch<string>('test-key')

watchedValue.onValue((val: string)  => {
    // Any time the value changes the will run
})
```

#### `getRemoteValue`

You can also request a value from one of the registered remotes.

```typescript
import { config } from '@creditkarma/dynamic-config'

export async function createHttpClient(): Promise<Client> {
    const host = await config().get('host')
    const port = await config().getRemoteValue('port', 'consul')
    return new Client(host, port)
}
```

The `getRemoteValue` function takes two arguments, the first is the name of the key to fetch, the other is the name of the remote to fetch from. The second argument is optional, but if you have more than one remote registered it will search all remotes for the key and return the first successful result.

#### `getSecretValue`

Works just like `getRemoteValue` except it will only try to fetch from remotes that have been registered as secret config stores.

```typescript
import { config } from '@creditkarma/dynamic-config'

export async function createHttpClient(): Promise<Client> {
    const host = await config().get('host')
    const port = await config().get('port')
    const password = await config().getSecretValue('password', 'vault')
    return new Client(host, port, { password })
}
```
