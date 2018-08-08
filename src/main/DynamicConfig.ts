import { Observer, ValueSink } from '@creditkarma/consul-client'

import { ConfigLoader } from './ConfigLoader'

import {
    CONFIG_ENV,
} from './constants'

import {
    ConfigBuilder,
    ConfigPromises,
    ConfigUtils,
    JSONUtils,
    ObjectUtils,
    Utils,
} from './utils'

import {
    DynamicConfigError,
    DynamicConfigErrorType,
    DynamicConfigInvalidObject,
    DynamicConfigInvalidResolver,
    DynamicConfigMissingKey,
    MissingConfigPlaceholder,
    ResolverUnavailable,
} from './errors'

import {
    envResolver,
    processResolver,
} from './resolvers'

import {
    BaseConfigValue,
    ConfigResolver,
    ConfigValue,
    IConfigOptions,
    IDynamicConfig,
    ILoadedFile,
    INamedResolvers,
    IRemoteOptions,
    IResolvedPlaceholder,
    IResolvers,
    IRootConfigValue,
    ISchemaMap,
    ITranslator,
    IVariable,
    PromisedUpdate,
    ResolverType,
} from './types'

import * as logger from './logger'
import { SyncConfig } from './SyncConfig'

const enum ConfigState {
    INIT,
    RUNNING,
    HAS_ERROR,
}

export class DynamicConfig implements IDynamicConfig {
    private configState: ConfigState
    private configLoader: ConfigLoader
    private remoteOptions: IRemoteOptions

    private promisedConfig: Promise<IRootConfigValue> | null
    private resolvedConfig: IRootConfigValue
    private initializedResolvers: Array<string>

    private resolvers: IResolvers
    private resolversByName: INamedResolvers
    private translator: ITranslator
    private schemas: ISchemaMap
    private error: DynamicConfigError | null
    /**
     * The observerMap is a cache of the Observer for a specified key. There is no need to create
     * more than one Observer for a given key.
     */
    private observerMap: Map<string, Observer<any>>

    constructor({
        configPath,
        configEnv = Utils.readFirstMatch(CONFIG_ENV, 'NODE_ENV'),
        remoteOptions = {},
        resolvers = [],
        loaders = [],
        translators = [],
        schemas = {},
    }: IConfigOptions = {}) {
        this.error = null
        this.configState = ConfigState.INIT
        this.promisedConfig = null
        this.resolvedConfig = {
            type: 'root',
            properties: {},
            watcher: null,
        }
        this.schemas = schemas
        this.translator = ConfigUtils.makeTranslator(translators)
        this.configLoader = new ConfigLoader({
            loaders,
            configPath,
            configEnv,
        })
        this.remoteOptions = remoteOptions
        this.observerMap = new Map()
        this.initializedResolvers = [ 'env', 'process' ]
        this.resolversByName = {
            env: envResolver(),
            process: processResolver(),
        }
        this.resolvers = {
            env: this.resolversByName.env,
            process: this.resolversByName.process,
        }
        this.register(...resolvers)
    }

    public register(...resolvers: Array<ConfigResolver>): void {
        if (this.configState === ConfigState.INIT) {
            resolvers.forEach((resolver: ConfigResolver) => {
                this.resolversByName[resolver.name] = resolver

                switch (resolver.type) {
                    case 'remote':
                        this.resolvers.remote = resolver
                        break

                    case 'secret':
                        this.resolvers.secret = resolver
                        break

                    default:
                        const _exhaustiveCheck: never = resolver
                        throw new Error(`Unknown resolver type: ${_exhaustiveCheck}`)
                }
            })

        } else {
            throw new Error(`Resolvers cannot be registered once requests have been made`)
        }
    }

    /**
     * Gets a given key from the config. There are not guarantees that the config is already
     * loaded, so we must return a Promise.
     */
    public async get<T = any>(key?: string): Promise<T> {
        if (this.error === null) {
            this.configState = ConfigState.RUNNING

            return this.getConfig().then((resolvedConfig: IRootConfigValue) => {
                // If the key is not set we return the entire structure
                if (key === undefined) {
                    return Promise.resolve(ConfigUtils.readConfigValue(resolvedConfig))

                // If the key is set we try to find it in the structure
                } else {
                    const value: ConfigValue | null = ConfigUtils.getConfigForKey(
                        key,
                        resolvedConfig,
                    )

                    // If the value is a thing we need to resolve any placeholders
                    if (value !== null) {
                        const baseValue = ConfigUtils.readConfigValue(value)
                        const schema: object | undefined = this.schemas[key]

                        if (schema !== undefined && !JSONUtils.objectMatchesSchema(schema, baseValue)) {
                            throw new DynamicConfigInvalidObject(key)

                        } else {
                            return Promise.resolve(baseValue)
                        }
                    } else {
                        logger.warn(`Value for key[${key}] not found in config`)
                        throw new DynamicConfigMissingKey(key)
                    }
                }
            }, (err: DynamicConfigError) => {
                logger.error(`Unable to load config. ${err.message}`)
                this.setError(err)
                throw err
            })
        } else {
            throw this.error
        }
    }

    public watch<T>(key: string): IVariable<T> {
        if (this.observerMap.has(key)) {
            return this.observerMap.get(key)!

        } else {
            const value: BaseConfigValue | null = ConfigUtils.getConfigForKey(key, this.resolvedConfig)

            if (value !== null) {
                const observer: Observer<T> = new Observer((sink: (val: T) => boolean) => {
                    value.watcher = (val: T): void => {
                        sink(val)
                    }

                    const resolver: ConfigResolver | undefined = this.getResolverForValue(value)

                    if (resolver !== undefined && resolver.type === 'remote' && value.source.key !== undefined) {
                        resolver.watch(value.source.key, (val: any) => {
                            const baseValue: BaseConfigValue = ConfigBuilder.buildBaseConfigValue(value.source, val)
                            this.setConfig(
                                ConfigUtils.setValueForKey(key, baseValue, this.resolvedConfig, true) as IRootConfigValue,
                            )
                        })

                    } else {
                        logger.error(`No resolver found for key[${key}]`)
                    }
                }, ConfigUtils.readConfigValue(value))

                this.observerMap.set(key, observer)

                return observer

            } else {
                const observer = new Observer<T>((sink: ValueSink<T>) => {
                    this.getConfig().then((resolvedConfig: IRootConfigValue) => {
                        const rawValue: BaseConfigValue | null = ConfigUtils.getConfigForKey(
                            key,
                            resolvedConfig,
                        )

                        if (rawValue !== null) {
                            // Set initial value
                            sink(ConfigUtils.readConfigValue(rawValue))

                            rawValue.watcher = (val: T): void => {
                                sink(val)
                            }

                            const resolver: ConfigResolver | undefined = this.getResolverForValue(rawValue)

                            if (resolver !== undefined && resolver.type === 'remote' && rawValue.source.key !== undefined) {
                                resolver.watch(rawValue.source.key, (val: any) => {
                                    const baseValue: BaseConfigValue = ConfigBuilder.buildBaseConfigValue(rawValue.source, val)
                                    this.setConfig(
                                        ConfigUtils.setValueForKey(key, baseValue, this.resolvedConfig, true) as IRootConfigValue,
                                    )
                                })

                            } else {
                                logger.error(`No resolver found for key[${key}]`)
                            }

                        } else {
                            logger.warn(`Value for key[${key}] not found in config`)
                            throw new DynamicConfigMissingKey(key)
                        }

                    }, (err: DynamicConfigError) => {
                        logger.error(`Unable to load config. ${err.message}`)
                        this.setError(err)
                    })
                })

                this.observerMap.set(key, observer)

                return observer
            }
        }
    }

    public async source(key: string): Promise<string> {
        if (this.error === null) {
            this.configState = ConfigState.RUNNING

            return this.getConfig().then((resolvedConfig: IRootConfigValue) => {
                const value: BaseConfigValue | null = ConfigUtils.getConfigForKey(
                    key,
                    resolvedConfig,
                )

                if (value !== null) {
                    return value.source.name

                } else {
                    throw new DynamicConfigMissingKey(key)
                }
            }, (err: DynamicConfigError) => {
                this.setError(err)
                throw err
            })
        } else {
           throw this.error
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
     * @param key The key to look up
     * @param defaultVal The value to return if the get fails
     */
    public async getWithDefault<T = any>(
        key: string,
        defaultVal: T,
    ): Promise<T> {
        return this.get(key).then(
            (val: T) => {
                return Promise.resolve(val)
            },
            (err: any) => {
                return Promise.resolve(defaultVal)
            },
        )
    }

    public async getRemoteValue<T>(key: string): Promise<T> {
        return this.getValueFromResolver<T>(key, 'remote')
    }

    public async getSecretValue<T>(key: string): Promise<T> {
        return this.getValueFromResolver<T>(key, 'secret')
    }

    /**
     * Given a ConfigPlaceholder attempt to find the value in Vault
     */
    private async getSecretPlaceholder(placeholder: IResolvedPlaceholder): Promise<any> {
        return this.getSecretValue(placeholder.key).catch((err: any) => {
            if (err instanceof DynamicConfigMissingKey) {
                return Promise.reject(
                    new MissingConfigPlaceholder(placeholder.key),
                )

            } else {
                return Promise.reject(err)
            }
        })
    }

    /**
     * Given a ConfigPlaceholder attempt to find the value in Consul
     */
    private async getRemotePlaceholder(placeholder: IResolvedPlaceholder): Promise<any> {
        return this.getRemoteValue(placeholder.key).then(
            (remoteValue: any) => {
                return Promise.resolve(remoteValue)
            },
            (err: any) => {
                if (placeholder.default !== undefined) {
                    return Promise.resolve(placeholder.default)

                } else if (err instanceof DynamicConfigMissingKey) {
                    return Promise.reject(
                        new MissingConfigPlaceholder(placeholder.key),
                    )

                } else {
                    return Promise.reject(err)
                }
            },
        )
    }

    private async resolvePlaceholder(placeholder: IResolvedPlaceholder): Promise<any> {
        switch (placeholder.resolver.type) {
            case 'remote':
                return this.getRemotePlaceholder(placeholder)

            case 'secret':
                return this.getSecretPlaceholder(placeholder)

            default:
                throw new DynamicConfigInvalidResolver(placeholder.resolver.type)
        }
    }

    /**
     * I personally think this is gross, a function that exists only to mutate one
     * of its arguments. Shh, it's a private function. We'll keep it a secret.
     */
    private appendUpdatesForObject(
        configValue: ConfigValue,
        path: Array<string>,
        updates: Array<PromisedUpdate>,
        whitelist?: Array<string>,
    ): void {
        if (
            configValue.type === 'placeholder' &&
            (whitelist === undefined || whitelist.indexOf(configValue.value._source) > -1)
        ) {
            const resolvedPlaceholder: IResolvedPlaceholder = ConfigUtils.normalizeConfigPlaceholder(
                configValue.value,
                this.resolversByName,
            )

            updates.push([
                path,
                this.resolvePlaceholder(resolvedPlaceholder).then(
                    (value: any) => {
                        return ConfigBuilder.buildBaseConfigValue({
                            type: resolvedPlaceholder.resolver.type,
                            name: resolvedPlaceholder.resolver.name,
                            key: resolvedPlaceholder.key,
                        }, this.translator(value))
                    },
                ),
            ])
        } else if (configValue.type === 'object') {
            this.collectConfigPlaceholders(configValue, path, updates, whitelist)
        }
    }

    private collectConfigPlaceholders(
        configValue: ConfigValue,
        path: Array<string>,
        updates: Array<PromisedUpdate>,
        whitelist?: Array<string>,
    ): Array<PromisedUpdate> {
        if (configValue.type === 'object' || configValue.type === 'root') {
            for (const key of Object.keys(configValue.properties)) {
                const objValue: BaseConfigValue = configValue.properties[key]
                const newPath: Array<string> = [...path, key]
                this.appendUpdatesForObject(objValue, newPath, updates, whitelist)
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
    private async replaceConfigPlaceholders(
        configValue: ConfigValue,
        whitelist?: Array<string>,
    ): Promise<ConfigValue> {
        if (
            configValue.type === 'placeholder' &&
            (whitelist === undefined || whitelist.indexOf(configValue.value._source) > -1)
        ) {
            const resolvedPlaceholder: IResolvedPlaceholder = ConfigUtils.normalizeConfigPlaceholder(
                configValue.value,
                this.resolversByName,
            )

            return this.resolvePlaceholder(resolvedPlaceholder).then(
                (value: any) => {
                    return ConfigBuilder.buildBaseConfigValue({
                        type: resolvedPlaceholder.resolver.type,
                        name: resolvedPlaceholder.resolver.name,
                        key: resolvedPlaceholder.key,
                    }, this.translator(value))
                },
            )

        } else if (
            configValue.type === 'object' ||
            configValue.type === 'root'
        ) {
            const unresolved: Array<PromisedUpdate> = this.collectConfigPlaceholders(configValue, [], [], whitelist)
            const paths: Array<string> = unresolved.map(
                (next: PromisedUpdate) => next[0].join('.'),
            )
            const promises: Array<Promise<BaseConfigValue>> = unresolved.map(
                (next: PromisedUpdate) => next[1],
            )
            const resolvedPromises: Array<BaseConfigValue> = await Promise.all(
                promises,
            )
            const newObj: ConfigValue = resolvedPromises.reduce(
                (
                    acc: ConfigValue,
                    next: BaseConfigValue,
                    currentIndex: number,
                ) => {
                    return ConfigUtils.setValueForKey(
                        paths[currentIndex],
                        next,
                        acc,
                    )
                },
                configValue,
            )

            return ConfigPromises.resolveConfigPromises(newObj)

        } else {
            return Promise.resolve(configValue)
        }
    }

    private async loadConfigs(): Promise<IRootConfigValue> {
        const defaultConfigFile: ILoadedFile = await this.configLoader.loadDefault()
        const defaultConfig: IRootConfigValue = ConfigBuilder.createConfigObject({
            type: 'local',
            name: 'default',
        }, this.translator(defaultConfigFile.config))

        const envConfigFile: ILoadedFile = await this.configLoader.loadEnvironment()
        const envConfig: IRootConfigValue = ConfigBuilder.createConfigObject({
            type: 'local',
            name: envConfigFile.name,
        }, this.translator(envConfigFile.config))

        const localConfig: IRootConfigValue = ObjectUtils.overlayObjects(defaultConfig, envConfig)

        return this.initializeResolvers(localConfig)
    }

    private setConfig(config: IRootConfigValue): void {
        this.resolvedConfig = config
        this.promisedConfig = Promise.resolve(this.resolvedConfig)
    }

    private setError(err: DynamicConfigError): void {
        switch (err.type) {
            case DynamicConfigErrorType.MissingConfigPlaceholder:
            case DynamicConfigErrorType.DynamicConfigInvalidObject:
            case DynamicConfigErrorType.ResolverUnavailable:
            case DynamicConfigErrorType.MissingEnvironmentVariable:
            case DynamicConfigErrorType.MissingProcessVariable:
            case DynamicConfigErrorType.InvalidConfigValue:
            case DynamicConfigErrorType.DynamicConfigInvalidResolver:
            case DynamicConfigErrorType.DynamicConfigMissingDefault:
            case DynamicConfigErrorType.DynamicConfigInvalidType:
                logger.error(`Fatal error encountered. Entering error state and locking config. ${err.message}`)
                this.configState = ConfigState.HAS_ERROR
                this.error = err

            default:
            logger.warn(`Non-fatal error encountered. ${err.message}`)
        }
    }

    private getConfig(): Promise<IRootConfigValue> {
        if (this.promisedConfig === null) {
            this.promisedConfig = this.loadConfigs()

            return this.promisedConfig.then(async (loadedConfigs: IRootConfigValue) => {
                const resolvedConfig = await this.replaceConfigPlaceholders(loadedConfigs) as IRootConfigValue
                this.setConfig(resolvedConfig)
                return resolvedConfig
            }).catch((err: DynamicConfigError) => {
                this.setError(err)
                throw err
            })
        }

        return this.promisedConfig
    }

    private async initializeResolvers(currentConfig: IRootConfigValue): Promise<IRootConfigValue> {
        const allResolvers: Array<ConfigResolver> = [
            this.resolvers.remote,
            this.resolvers.secret,
        ].filter((next) => next !== undefined) as Array<ConfigResolver>
        const numResolvers: number = allResolvers.length
        let index: number = 0

        return this.replaceConfigPlaceholders(currentConfig, this.initializedResolvers).then(
            (initialConfig: IRootConfigValue) => {
                const loadNextConfig = async (): Promise<IRootConfigValue> => {
                    if (index < numResolvers) {
                        const nextResolver: ConfigResolver = allResolvers[index]
                        const configStore = new SyncConfig(initialConfig)
                        const remoteConfig: any = await nextResolver.init(configStore, this.remoteOptions[nextResolver.name])
                        const mergedConfig: IRootConfigValue = ConfigBuilder.createConfigObject({
                            type: nextResolver.type,
                            name: nextResolver.name,
                        }, this.translator(remoteConfig))
                        this.initializedResolvers.push(nextResolver.name)

                        const resolvedConfig: IRootConfigValue = await this.replaceConfigPlaceholders(
                            mergedConfig,
                            this.initializedResolvers,
                        ) as IRootConfigValue

                        initialConfig = ObjectUtils.overlayObjects(initialConfig, resolvedConfig)

                        // Increment index for next resolver
                        index += 1

                        return loadNextConfig()

                    } else {
                        return initialConfig
                    }
                }

                return loadNextConfig()
            },
        )
    }

    private getValueFromResolver<T>(
        key: string,
        type: ResolverType,
    ): Promise<T> {
        const resolver: ConfigResolver | undefined = this.resolvers[type]

        if (resolver !== undefined) {
            return resolver.get<T>(key).then((remoteValue: T) => {
                if (remoteValue !== null) {
                    return Promise.resolve(remoteValue)

                } else {
                    logger.warn(`Unable to resolve ${type} value for key[${key}]`)
                    return Promise.reject(new DynamicConfigMissingKey(key))
                }
            }, (err: any) => {
                logger.warn(`Unable to resolve ${type} value for key[${key}]`)
                return Promise.reject(new DynamicConfigMissingKey(key))
            })
        } else {
            logger.error(`There are no remote resolvers for key[${key}]`)
            return Promise.reject(new ResolverUnavailable(key))
        }
    }

    private getResolverForValue(value: BaseConfigValue): ConfigResolver | undefined {
        return this.resolversByName[value.source.name]
    }
}
