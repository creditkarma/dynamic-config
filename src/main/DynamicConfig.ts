import { Observer, ValueSink } from '@creditkarma/consul-client'

import { ConfigLoader } from './ConfigLoader'

import { CONFIG_ENV } from './constants'

import {
    ConfigBuilder,
    ConfigPromises,
    ConfigUtils,
    JSONUtils,
    ObjectUtils,
    Utils,
} from './utils'

import * as errors from './errors'

import { envResolver, packageResolver, processResolver } from './resolvers'

import {
    ConfigValue,
    IConfigOptions,
    IDynamicConfig,
    ILoadedFile,
    INamedResolvers,
    IObjectConfigValue,
    IRemoteOptions,
    IRemoteResolver,
    IResolvedPlaceholder,
    IResolvers,
    ISchemaMap,
    ISource,
    ITranslator,
    IVariable,
    KeyPath,
    ObjectType,
    PromisedUpdate,
    ResolverType,
} from './types'

import { jsonLoader } from './loaders'
import { defaultLogger as logger } from './logger'
import { SyncConfig } from './SyncConfig'
import { envTranslator } from './translators'

export class DynamicConfig implements IDynamicConfig {
    private configLoader: ConfigLoader
    private remoteOptions: IRemoteOptions

    private promisedConfig: Promise<IObjectConfigValue> | null
    private initializedResolvers: Array<string>

    private resolvers: IResolvers
    private resolversByName: INamedResolvers
    private translator: ITranslator
    private schemas: ISchemaMap
    private errorMap: errors.IConfigErrorMap

    /**
     * The observerMap is a cache of the Observer for a specified key. There is no need to create
     * more than one Observer for a given key.
     */
    private observerMap: Map<string, Observer<any>>

    constructor({
        configPath,
        configEnv = Utils.readFirstMatch(CONFIG_ENV, 'NODE_ENV'),
        remoteOptions = {},
        resolvers = {},
        loaders = [jsonLoader],
        translators = [envTranslator],
        schemas = {},
    }: IConfigOptions = {}) {
        this.errorMap = {}
        this.promisedConfig = null
        this.schemas = schemas
        this.translator = ConfigUtils.makeTranslator(translators)
        this.configLoader = new ConfigLoader({
            loaders,
            configPath,
            configEnv,
        })
        this.remoteOptions = remoteOptions
        this.observerMap = new Map()

        this.resolversByName = {
            env: envResolver(),
            process: processResolver(),
            package: packageResolver(),
        }

        this.initializedResolvers = Object.keys(this.resolversByName)

        this.resolvers = {
            env: this.resolversByName.env,
            process: this.resolversByName.process,
        }

        if (resolvers.remote !== undefined) {
            this.register(resolvers.remote)
        }

        if (resolvers.secret !== undefined) {
            this.register(resolvers.secret)
        }
    }

    /**
     * Gets a given key from the config. There are not guarantees that the config is already
     * loaded, so we must return a Promise.
     *
     * @param key The key to look up. Dot notation may be used to access nested properties.
     */
    public async get<T = any>(key?: string): Promise<T> {
        return this.getConfig().then((resolvedConfig: IObjectConfigValue) => {
            const error = ConfigUtils.getErrorForKey(key, this.errorMap)

            if (error) {
                throw error
            } else {
                // If the key is not set we return the entire structure
                if (key === undefined) {
                    return Promise.resolve(
                        ConfigUtils.readConfigValue(resolvedConfig),
                    )

                    // If the key is set we try to find it in the structure
                } else {
                    const normalizedKey: string = Utils.normalizePath(key)
                    const value: ConfigValue | null =
                        ConfigUtils.getConfigForKey(
                            normalizedKey,
                            resolvedConfig,
                        )

                    if (value !== null) {
                        const baseValue = ConfigUtils.readConfigValue(value)

                        if (baseValue !== null) {
                            const schema: object | undefined = this.schemas[key]
                            if (
                                schema !== undefined &&
                                !JSONUtils.objectMatchesSchema(
                                    schema,
                                    baseValue,
                                )
                            ) {
                                throw new errors.DynamicConfigInvalidObject(key)
                            } else {
                                return Promise.resolve(baseValue)
                            }
                        } else if (value.nullable) {
                            return Promise.resolve(null)
                        } else {
                            throw new errors.DynamicConfigMissingKey(key)
                        }
                    } else {
                        throw new errors.DynamicConfigMissingKey(key)
                    }
                }
            }
        })
    }

    public watch<T>(key: string): IVariable<T> {
        const normalizedKey: string = Utils.normalizePath(key)

        if (this.observerMap.has(key)) {
            return this.observerMap.get(key)!
        } else {
            const observer = new Observer<T>((sink: ValueSink<T>) => {
                this.getConfig().then(
                    (resolvedConfig: IObjectConfigValue) => {
                        try {
                            const initialRawValue: ConfigValue | null =
                                ConfigUtils.getConfigForKey(
                                    normalizedKey,
                                    resolvedConfig,
                                )

                            if (initialRawValue !== null) {
                                // Read initial value
                                const initialValue: T =
                                    ConfigUtils.readConfigValue(initialRawValue)

                                // Set initial value
                                sink(undefined, initialValue)

                                // Defined watcher for config value
                                initialRawValue.watcher = (
                                    err: Error | undefined,
                                    val: T | undefined,
                                ): void => {
                                    sink(err, val)
                                }

                                const resolver: IRemoteResolver | undefined =
                                    this.getResolverForValue(initialRawValue)

                                if (
                                    resolver !== undefined &&
                                    resolver.type === 'remote' &&
                                    initialRawValue.source.key !== undefined
                                ) {
                                    resolver.watch<T>(
                                        initialRawValue.source.key,
                                        (
                                            err: Error | undefined,
                                            val: T | undefined,
                                        ) => {
                                            if (err !== undefined) {
                                                sink(err)
                                            } else {
                                                const updatedRawValue: ConfigValue =
                                                    ConfigBuilder.buildBaseConfigValue(
                                                        initialRawValue.source,
                                                        val,
                                                    )
                                                this.replaceConfigPlaceholders(
                                                    updatedRawValue,
                                                ).then(
                                                    (
                                                        updatedResolvedValue: ConfigValue,
                                                    ) => {
                                                        if (
                                                            initialRawValue.type !==
                                                            updatedResolvedValue.type
                                                        ) {
                                                            logger.warn(
                                                                `The watcher for key[${key}] updated with a value of type[${updatedResolvedValue.type}] the initial value was of type[${initialRawValue.type}]`,
                                                            )
                                                        }

                                                        this.setConfig(
                                                            ConfigUtils.setValueForKey(
                                                                normalizedKey,
                                                                updatedResolvedValue,
                                                                resolvedConfig,
                                                                true,
                                                            ),
                                                        )
                                                    },
                                                    (
                                                        placeholderError: Error,
                                                    ) => {
                                                        sink(placeholderError)
                                                    },
                                                )
                                            }
                                        },
                                        undefined,
                                        initialRawValue.source.altKey,
                                    )
                                } else {
                                    logger.log(
                                        `DynamicConfig.watch called on key[${key}] whose value is static.`,
                                    )
                                }
                            } else {
                                sink(new errors.DynamicConfigMissingKey(key))
                            }
                        } catch (err) {
                            sink(
                                err instanceof Error
                                    ? err
                                    : new Error(`Non Error Thrown ${err}`),
                            )
                        }
                    },
                    (err: errors.DynamicConfigError) => {
                        sink(new Error(`Unable to load config. ${err.message}`))
                    },
                )
            })

            this.observerMap.set(key, observer)

            return observer
        }
    }

    /**
     * Get n number of keys from the config and return a Promise of an Array of those values.
     */
    public async getAll(...args: Array<string>): Promise<Array<any>> {
        return Promise.all(args.map((key: string) => this.get(key)))
    }

    /**
     * Looks up a key in the config. If the key cannot be found the default is returned.
     *
     * @param key The key to look up. Dot notation may be used to access nested properties.
     * @param defaultVal The value to return if the get fails.
     */
    public async getWithDefault<T = any>(
        key: string,
        defaultVal: T,
    ): Promise<T> {
        return this.get(key).catch(() => defaultVal)
    }

    public async getRemoteValue<T>(key: string, type?: ObjectType): Promise<T> {
        // get source for key
        const source: ISource = await this.source(key)

        // throw if key is undefined
        if (!source.key) {
            throw new errors.ResolverUnavailable(key)
        }

        // get the current config (the cached version, that is)
        const currentConfig: ConfigValue = await this.getConfig()

        // get new remote value for key
        const remoteValue: T = await this.getValueFromResolver<T>(
            source.key,
            'remote',
            type,
            source.altKey,
        )

        // Find any placeholders in the remote value. This is important for resolving `consul!` pointers.
        const translatedValue = this.translator(remoteValue)

        // normalize/format key path
        const normalizedKey: string = Utils.normalizePath(key)

        /*
         build the normalized key path for the refreshed value to live at.
         *note*: this is **required** to format the new value into a shape consumable by `setConfig()`.
         */
        const builtValue: ConfigValue = ConfigBuilder.buildBaseConfigValue(
            source,
            translatedValue,
        )

        // Resolve any new placeholders in updated config
        const resolvedValue = await this.replaceConfigPlaceholders(builtValue)

        // create shape of new config
        const newConfig = ConfigUtils.setValueForKey(
            normalizedKey,
            resolvedValue,
            currentConfig,
            true,
        )

        await this.setConfig(newConfig) // keyValue the formatted value to be set in the config

        return this.get(key) //re-fetch the value from the updated config to be sure it successfully updated the val.
    }

    public async getSecretValue<T>(key: string, type?: ObjectType): Promise<T> {
        return this.source(key).then((source: ISource) => {
            if (source.key !== undefined) {
                return this.getValueFromResolver<T>(
                    source.key,
                    'secret',
                    type,
                    source.altKey,
                )
            } else {
                throw new errors.ResolverUnavailable(key)
            }
        })
    }

    public async source(key: string): Promise<ISource> {
        const error = ConfigUtils.getErrorForKey(key, this.errorMap)

        if (error) {
            throw error
        } else {
            const normalizedKey = Utils.normalizePath(key)
            return this.getConfig().then(
                (resolvedConfig: IObjectConfigValue) => {
                    const value: ConfigValue | null =
                        ConfigUtils.getConfigForKey(
                            normalizedKey,
                            resolvedConfig,
                        )

                    if (value !== null) {
                        return value.source
                    } else {
                        throw new errors.DynamicConfigMissingKey(key)
                    }
                },
            )
        }
    }

    private buildDefaultForPlaceholder(
        placeholder: IResolvedPlaceholder,
        err?: errors.DynamicConfigError,
    ): ConfigValue {
        if (placeholder.default !== undefined) {
            if (err !== undefined) {
                logger.warn(
                    `Unable to read value. Returning default value. ${err.message}`,
                )
            }

            return ConfigBuilder.buildBaseConfigValue(
                {
                    type: placeholder.resolver.type,
                    name: placeholder.resolver.name,
                    key: placeholder.key,
                    altKey: placeholder.altKey,
                },
                this.translator(placeholder.default),
            )
        } else if (placeholder.nullable) {
            if (err !== undefined) {
                logger.warn(
                    `Unable to read value. Returning null value. ${err.message}`,
                )
            }

            return ConfigBuilder.nullValueForPlaceholder(placeholder)
        } else if (err !== undefined) {
            logger.error(err.message)
            this.errorMap = ConfigUtils.setErrorForKey(
                placeholder.path,
                err,
                this.errorMap,
            )
            return ConfigBuilder.invalidValueForPlaceholder(placeholder)
        } else {
            const missingError = new errors.MissingConfigPlaceholder(
                placeholder.path,
            )
            logger.error(missingError.message)
            this.errorMap = ConfigUtils.setErrorForKey(
                placeholder.path,
                missingError,
                this.errorMap,
            )
            return ConfigBuilder.invalidValueForPlaceholder(placeholder)
        }
    }

    private async getRemotePlaceholder(
        placeholder: IResolvedPlaceholder,
    ): Promise<ConfigValue> {
        const resolver: IRemoteResolver | undefined =
            this.resolversByName[placeholder.resolver.name]

        if (resolver === undefined) {
            return this.buildDefaultForPlaceholder(placeholder)
        } else {
            return resolver
                .get(placeholder.key, placeholder.type, placeholder.altKey)
                .then(
                    (remoteValue: any) => {
                        return ConfigBuilder.buildBaseConfigValue(
                            {
                                type: placeholder.resolver.type,
                                name: placeholder.resolver.name,
                                key: placeholder.key,
                                altKey: placeholder.altKey,
                            },
                            this.translator(remoteValue),
                        )
                    },
                    (err: any) => {
                        return this.buildDefaultForPlaceholder(placeholder, err)
                    },
                )
        }
    }

    /**
     * I personally think this is gross, a function that exists only to mutate one
     * of its arguments. Shh, it's a private function. We'll keep it a secret.
     */
    private appendUpdatesForObject(
        configValue: ConfigValue,
        path: KeyPath,
        updates: Array<PromisedUpdate>,
        whitelist?: Array<string>,
    ): void {
        if (
            configValue.type === 'placeholder' &&
            (whitelist === undefined ||
                whitelist.indexOf(configValue.value._source) > -1)
        ) {
            const resolvedPlaceholder: IResolvedPlaceholder =
                ConfigUtils.normalizeConfigPlaceholder(
                    path,
                    configValue.value,
                    this.resolversByName,
                )

            updates.push([
                path,
                this.getRemotePlaceholder(resolvedPlaceholder).then(
                    (val: any) => {
                        return this.replaceConfigPlaceholders(
                            val,
                            whitelist,
                        ) as Promise<ConfigValue>
                    },
                ),
            ])
        } else if (
            configValue.type === 'object' ||
            configValue.type === 'array'
        ) {
            this.collectConfigPlaceholders(
                configValue,
                path,
                updates,
                whitelist,
            )
        }
    }

    private collectConfigPlaceholders(
        configValue: ConfigValue,
        path: KeyPath,
        updates: Array<PromisedUpdate>,
        whitelist?: Array<string>,
    ): Array<PromisedUpdate> {
        if (configValue.type === 'array') {
            configValue.items.forEach(
                (oldValue: ConfigValue, index: number) => {
                    const newPath: KeyPath = [...path, `${index}`]
                    this.appendUpdatesForObject(
                        oldValue,
                        newPath,
                        updates,
                        whitelist,
                    )
                },
            )

            return updates
        } else if (configValue.type === 'object') {
            for (const key of Object.keys(configValue.properties)) {
                const objValue: ConfigValue = configValue.properties[key]
                const newPath: KeyPath = [...path, key]
                this.appendUpdatesForObject(
                    objValue,
                    newPath,
                    updates,
                    whitelist,
                )
            }

            return updates
        } else {
            return []
        }
    }

    /**
     * When a config value is requested there is a chance that the value currently in the
     * resolved config is a placeholder, or, in the more complex case, the requested value
     * is an object that contains placeholders within nested keys. We need to find and resolve
     * any placeholders that remain in the config
     */
    private async replaceConfigPlaceholders<T extends ConfigValue>(
        rootConfig: T,
        whitelist?: Array<string>,
    ): Promise<T> {
        const unresolved: Array<PromisedUpdate> =
            this.collectConfigPlaceholders(rootConfig, [], [], whitelist)
        const paths: Array<string> = unresolved.map((next: PromisedUpdate) =>
            next[0].join('.'),
        )
        const promises: Array<Promise<ConfigValue>> = unresolved.map(
            (next: PromisedUpdate) => next[1],
        )
        const resolvedPromises: Array<ConfigValue> = await Promise.all(promises)
        const newObj: ConfigValue = resolvedPromises.reduce(
            (acc: ConfigValue, next: ConfigValue, currentIndex: number) => {
                return ConfigUtils.setValueForKey(
                    paths[currentIndex],
                    next,
                    acc,
                )
            },
            rootConfig,
        )

        return ConfigPromises.resolveConfigPromises(newObj) as Promise<T>
    }

    private async loadConfigs(): Promise<IObjectConfigValue> {
        const defaultConfigFile: ILoadedFile =
            await this.configLoader.loadDefault()
        const defaultConfig: ConfigValue = ConfigBuilder.createConfigObject(
            {
                type: 'local',
                name: 'default',
            },
            this.translator(defaultConfigFile.config),
        )

        const envConfigFile: ILoadedFile =
            await this.configLoader.loadEnvironment()
        const envConfig: ConfigValue = ConfigBuilder.createConfigObject(
            {
                type: 'local',
                name: envConfigFile.name,
            },
            this.translator(envConfigFile.config),
        )

        const localConfig: IObjectConfigValue = ObjectUtils.overlayObjects(
            defaultConfig,
            envConfig,
        )

        return await this.initializeResolvers(localConfig)
    }

    private setConfig(resolvedConfig: IObjectConfigValue): void {
        this.promisedConfig = Promise.resolve(resolvedConfig)
    }

    private getConfig(): Promise<IObjectConfigValue> {
        if (this.promisedConfig === null) {
            this.promisedConfig = this.loadConfigs().then(
                async (loadedConfigs: IObjectConfigValue) => {
                    const resolvedConfig = await this.replaceConfigPlaceholders(
                        loadedConfigs,
                    )
                    this.setConfig(resolvedConfig)
                    return resolvedConfig
                },
            )
        }

        return this.promisedConfig
    }

    private async initializeResolvers(
        currentConfig: IObjectConfigValue,
    ): Promise<IObjectConfigValue> {
        const allResolvers: Array<IRemoteResolver> = [
            this.resolvers.remote,
            this.resolvers.secret,
        ].filter((next) => next !== undefined) as Array<IRemoteResolver>
        const numResolvers: number = allResolvers.length
        let index: number = 0

        return this.replaceConfigPlaceholders(
            currentConfig,
            this.initializedResolvers,
        ).then((initialConfig: IObjectConfigValue) => {
            const loadNextConfig = async (): Promise<IObjectConfigValue> => {
                if (index < numResolvers) {
                    const nextResolver: IRemoteResolver = allResolvers[index]
                    const configStore = new SyncConfig(initialConfig)
                    const remoteConfig: any = await nextResolver.init(
                        configStore,
                        this.remoteOptions[nextResolver.name],
                    )
                    const mergedConfig: ConfigValue =
                        ConfigBuilder.createConfigObject(
                            {
                                type: nextResolver.type,
                                name: nextResolver.name,
                            },
                            this.translator(remoteConfig),
                        )
                    this.initializedResolvers.push(nextResolver.name)

                    const resolvedConfig: ConfigValue =
                        await this.replaceConfigPlaceholders(
                            mergedConfig,
                            this.initializedResolvers,
                        )

                    initialConfig = ObjectUtils.overlayObjects(
                        initialConfig,
                        resolvedConfig,
                    )

                    // Increment index for next resolver
                    index += 1

                    return loadNextConfig()
                } else {
                    return initialConfig
                }
            }

            return loadNextConfig()
        })
    }

    private getValueFromResolver<T>(
        key: string,
        resolverType: ResolverType,
        valueType?: ObjectType,
        altKey?: string,
    ): Promise<T> {
        const resolver: IRemoteResolver | undefined =
            this.resolvers[resolverType]

        if (resolver !== undefined) {
            return resolver.get<T>(key, valueType, altKey).then(
                (remoteValue: T) => {
                    if (remoteValue !== null) {
                        return Promise.resolve(remoteValue)
                    } else {
                        return Promise.reject(
                            new errors.DynamicConfigMissingKey(key),
                        )
                    }
                },
                () => {
                    return Promise.reject(
                        new errors.DynamicConfigMissingKey(key),
                    )
                },
            )
        } else {
            return Promise.reject(new errors.ResolverUnavailable(key))
        }
    }

    private getResolverForValue(
        value: ConfigValue,
    ): IRemoteResolver | undefined {
        return this.resolversByName[value.source.name]
    }

    private register(resolver: IRemoteResolver): void {
        this.resolversByName[resolver.name] = resolver

        switch (resolver.type) {
            case 'remote':
                this.resolvers.remote = resolver
                break

            case 'secret':
                this.resolvers.secret = resolver
                break

            default:
                throw new Error(`Unknown resolver type: ${resolver.type}`)
        }
    }
}
