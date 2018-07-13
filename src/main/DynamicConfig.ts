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
    PromiseUtils,
    Utils,
} from './utils'

import {
    // DynamicConfigInvalidObject,
    DynamicConfigInvalidObject,
    DynamicConfigMissingKey,
    MissingConfigPlaceholder,
    ResolverUnavailable,
} from './errors'

import {
    BaseConfigValue,
    ConfigResolver,
    ConfigValue,
    IConfigOptions,
    IDynamicConfig,
    ILoadedFile,
    IRemoteOptions,
    IResolvedPlaceholder,
    IResolverMap,
    IRootConfigValue,
    ISchemaMap,
    ITranslator,
    PromisedUpdate,
    ResolverType,
    // SetFunction,
} from './types'

import * as logger from './logger'

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

    private resolvers: IResolverMap
    private translator: ITranslator
    private schemas: ISchemaMap
    private error: string
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
        this.error = ''
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
        this.resolvers = {
            names: new Set<string>(),
            all: new Map(),
        }
        this.observerMap = new Map()
        this.register(...resolvers)
    }

    public register(...resolvers: Array<ConfigResolver>): void {
        if (this.configState === ConfigState.INIT) {
            resolvers.forEach((resolver: ConfigResolver) => {
                this.resolvers.names.add(resolver.name)
                this.resolvers.all.set(resolver.name, resolver)
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
        if (this.configState !== ConfigState.HAS_ERROR) {
            this.configState = ConfigState.RUNNING

            return this.getConfig().then((rootConfig: IRootConfigValue) => {
                // If the key is not set we return the entire structure
                if (key === undefined) {
                    return this.replaceConfigPlaceholders(rootConfig).then(
                        (resolvedConfig: IRootConfigValue): Promise<IRootConfigValue> => {
                            this.setConfig(ObjectUtils.overlayObjects(
                                this.resolvedConfig,
                                resolvedConfig,
                            ))

                            return Promise.resolve(
                                ConfigUtils.readConfigValue(this.resolvedConfig),
                            )
                        },
                    )

                // If the key is set we try to find it in the structure
                } else {
                    const value: ConfigValue | null = ConfigUtils.getConfigForKey(
                        key,
                        rootConfig,
                    )

                    // If the value is a thing we need to resolve any placeholders
                    if (value !== null) {
                        return this.replaceConfigPlaceholders(value).then(
                            (resolvedValue: BaseConfigValue) => {
                                const baseValue = ConfigUtils.readConfigValue(
                                    resolvedValue,
                                )

                                const schema: object | undefined = this.schemas[key]

                                this.setConfig(ConfigUtils.setValueForKey(
                                    key,
                                    resolvedValue,
                                    this.resolvedConfig,
                                ) as IRootConfigValue)

                                if (schema !== undefined && !JSONUtils.objectMatchesSchema(schema, baseValue)) {
                                    return Promise.reject(new DynamicConfigInvalidObject(key))

                                } else {
                                    return Promise.resolve(baseValue)
                                }
                            },
                        )
                    } else {
                        logger.error(`Value for key[${key}] not found in config`)
                        return Promise.reject(new DynamicConfigMissingKey(key))
                    }
                }
            })
        } else {
            return Promise.reject(this.error)
        }
    }

    public watch<T>(key: string): Observer<T> {
        if (this.observerMap.has(key)) {
            return this.observerMap.get(key)!

        } else {
            const value: ConfigValue | null = ConfigUtils.getConfigForKey(key, this.resolvedConfig)

            if (value !== null) {
                const observer: Observer<T> = new Observer((sink: (val: T) => boolean) => {
                    value.watcher = (val: T): void => {
                        sink(val)
                    }

                    const resolver: ConfigResolver | undefined = this.resolvers.all.get(value.source.name)

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
                    this.getConfig().then((rootConfig: IRootConfigValue) => {
                        this.replaceConfigPlaceholders(rootConfig).then((resolvedConfig: IRootConfigValue) => {
                            this.setConfig(ObjectUtils.overlayObjects(
                                this.resolvedConfig,
                                resolvedConfig,
                            ))

                            const rawValue: ConfigValue | null = ConfigUtils.getConfigForKey(
                                key,
                                this.resolvedConfig,
                            )

                            if (rawValue !== null) {
                                // Set initial value
                                sink(ConfigUtils.readConfigValue(rawValue))

                                rawValue.watcher = (val: T): void => {
                                    sink(val)
                                }

                                const resolver: ConfigResolver | undefined = this.resolvers.all.get(rawValue.source.name)

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
                                logger.error(`Value for key[${key}] not found in config`)
                                throw new DynamicConfigMissingKey(key)
                            }
                        })

                    }, (err: any) => {
                        logger.error(`Unable to load config: `, err)
                        throw new Error(`Unable to load configs: ${err.message}`)
                    })
                })

                this.observerMap.set(key, observer)

                return observer
            }
        }
    }

    public async source(key: string): Promise<string> {
        if (this.configState !== ConfigState.HAS_ERROR) {
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
            })
        } else {
           return Promise.reject(this.error)
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

    public async getRemoteValue<T>(key: string, remoteName?: string): Promise<T> {
        return this.getValueFromResolver<T>(key, 'remote', remoteName)
    }

    public async getSecretValue<T>(key: string, remoteName?: string): Promise<T> {
        return this.getValueFromResolver<T>(key, 'secret', remoteName)
    }

    /**
     * Given a ConfigPlaceholder attempt to find the value in Vault
     */
    private async getSecretPlaceholder(placeholder: IResolvedPlaceholder): Promise<any> {
        return this.getSecretValue(placeholder.key, placeholder.resolver.name).catch((err: any) => {
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
        return this.getRemoteValue(placeholder.key, placeholder.resolver.name).then(
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

    private resolvePlaceholder(placeholder: IResolvedPlaceholder): Promise<any> {
        switch (placeholder.resolver.type) {
            case 'remote':
                return this.getRemotePlaceholder(placeholder)

            case 'secret':
                return this.getSecretPlaceholder(placeholder)

            default:
                return Promise.reject(
                    new Error(`Unrecognized placeholder type[${placeholder.resolver.type}]`),
                )
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
    ): void {
        if (configValue.type === 'placeholder') {
            const resolvedPlaceholder: IResolvedPlaceholder = ConfigUtils.normalizeConfigPlaceholder(
                configValue.value,
                this.resolvers,
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
            this.collectConfigPlaceholders(configValue, path, updates)
        }
    }

    private collectConfigPlaceholders(
        configValue: ConfigValue,
        path: Array<string>,
        updates: Array<PromisedUpdate>,
    ): Array<PromisedUpdate> {
        if (configValue.type === 'object' || configValue.type === 'root') {
            for (const key of Object.keys(configValue.properties)) {
                const objValue: BaseConfigValue = configValue.properties[key]
                const newPath: Array<string> = [...path, key]
                this.appendUpdatesForObject(objValue, newPath, updates)
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
    ): Promise<ConfigValue> {
        if (configValue.type === 'placeholder') {
            const resolvedPlaceholder: IResolvedPlaceholder = ConfigUtils.normalizeConfigPlaceholder(
                configValue.value,
                this.resolvers,
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
            const unresolved: Array<PromisedUpdate> = this.collectConfigPlaceholders(configValue, [], [])
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
        const defaultConfig: ILoadedFile = await this.configLoader.loadDefault()
        const envConfig: ILoadedFile = await this.configLoader.loadEnvironment()
        const remoteConfigs: Array<IRootConfigValue> = await this.initializeResolvers()
        return ObjectUtils.overlayObjects(
            ConfigBuilder.createConfigObject({
                type: 'local',
                name: 'default',
            }, this.translator(defaultConfig.config)),
            ConfigBuilder.createConfigObject({
                type: 'local',
                name: envConfig.name,
            }, this.translator(envConfig.config)),
            ...remoteConfigs,
        )
    }

    private setConfig(config: IRootConfigValue): void {
        this.resolvedConfig = config
        this.promisedConfig = Promise.resolve(this.resolvedConfig)
    }

    private getConfig(): Promise<IRootConfigValue> {
        if (this.promisedConfig === null) {
            this.promisedConfig = this.loadConfigs()
            return this.promisedConfig.then((loadedConfigs: IRootConfigValue) => {
                this.setConfig(loadedConfigs)
                return loadedConfigs
            })
        }

        return this.promisedConfig
    }

    private initializeResolvers(): Promise<Array<IRootConfigValue>> {
        return Promise.all(
            [...this.resolvers.all.values()].map((next: ConfigResolver) => {
                switch (next.type) {
                    case 'remote':
                        return next
                            .init(this, this.remoteOptions[next.name])
                            .then((config: any) => {
                                return ConfigBuilder.createConfigObject({
                                    type: next.type,
                                    name: next.name,
                                }, this.translator(config))
                            })

                    case 'secret':
                        return next
                            .init(this, this.remoteOptions[next.name])
                            .then((config: any) => {
                                return ConfigBuilder.createConfigObject({
                                    type: next.type,
                                    name: next.name,
                                }, this.translator(config))
                            })
                }
            }),
        )
    }

    private getValueFromResolver<T>(
        key: string,
        type: ResolverType,
        remoteName?: string,
    ): Promise<T> {
        const resolvers = [...this.resolvers.all.values()].filter(
            (next: ConfigResolver) => {
                return (
                    next.type === type &&
                    (remoteName === undefined || remoteName === next.name)
                )
            },
        )

        if (resolvers.length > 0) {
            return PromiseUtils.race(
                resolvers.map((next: ConfigResolver) => {
                    return next.get<T>(key)
                }),
            ).then(
                (remoteValue: T) => {
                    if (remoteValue !== null) {
                        return Promise.resolve(remoteValue)
                    } else {
                        logger.error(`Unable to resolve remote value for key[${key}]`)
                        return Promise.reject(new DynamicConfigMissingKey(key))
                    }
                },
                (err: any) => {
                    logger.error(`Unable to resolve remote value for key[${key}]`)
                    return Promise.reject(new DynamicConfigMissingKey(key))
                },
            )

        } else {
            logger.error(`There are no remote resolvers for key[${key}]`)
            return Promise.reject(new ResolverUnavailable(key))
        }
    }
}
