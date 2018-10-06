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

import * as errors from './errors'

import {
    envResolver,
    packageResolver,
    processResolver,
} from './resolvers'

import {
    BaseConfigValue,
    ConfigValue,
    IConfigOptions,
    IDynamicConfig,
    ILoadedFile,
    INamedResolvers,
    IRemoteOptions,
    IRemoteResolver,
    IResolvedPlaceholder,
    IResolvers,
    IRootConfigValue,
    ISchemaMap,
    ITranslator,
    IVariable,
    KeyPath,
    PromisedUpdate,
    ResolverType,
} from './types'

import { jsonLoader } from './loaders'
import * as logger from './logger'
import { SyncConfig } from './SyncConfig'
import { envTranslator } from './translators'

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
        loaders = [ jsonLoader ],
        translators = [ envTranslator ],
        schemas = {},
    }: IConfigOptions = {}) {
        this.errorMap = {}
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

    public register(...resolvers: Array<IRemoteResolver>): void {
        if (this.configState === ConfigState.INIT) {
            resolvers.forEach((resolver: IRemoteResolver) => {
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
        this.configState = ConfigState.RUNNING
        return this.getConfig().then((resolvedConfig: IRootConfigValue) => {
            const error = ConfigUtils.getErrorForKey(key, this.errorMap)

            if (error) {
                throw error

            } else {
                // If the key is not set we return the entire structure
                if (key === undefined) {
                    return Promise.resolve(ConfigUtils.readConfigValue(resolvedConfig))

                // If the key is set we try to find it in the structure
                } else {
                    const normalizedKey: string = Utils.normalizePath(key)
                    const value: ConfigValue | null = ConfigUtils.getConfigForKey(
                        normalizedKey,
                        resolvedConfig,
                    )

                    if (value !== null) {
                        const baseValue = ConfigUtils.readConfigValue(value)

                        if (baseValue !== null) {
                            const schema: object | undefined = this.schemas[key]
                            if (schema !== undefined && !JSONUtils.objectMatchesSchema(schema, baseValue)) {
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
                this.getConfig().then((resolvedConfig: IRootConfigValue) => {
                    const rawValue: BaseConfigValue | null = ConfigUtils.getConfigForKey(
                        normalizedKey,
                        resolvedConfig,
                    )

                    if (rawValue !== null) {
                        // Set initial value
                        sink(ConfigUtils.readConfigValue(rawValue))

                        rawValue.watcher = (val: T): void => {
                            sink(val)
                        }

                        const resolver: IRemoteResolver | undefined = this.getResolverForValue(rawValue)

                        if (
                            resolver !== undefined &&
                            resolver.type === 'remote' &&
                            rawValue.source.key !== undefined
                        ) {
                            resolver.watch(rawValue.source.key, (val: any) => {
                                const baseValue: BaseConfigValue = ConfigBuilder.buildBaseConfigValue(rawValue.source, val)
                                this.setConfig(
                                    ConfigUtils.setValueForKey(
                                        normalizedKey,
                                        baseValue,
                                        this.resolvedConfig,
                                        true,
                                    ) as IRootConfigValue,
                                )
                            })

                        } else {
                            logger.error(`No resolver found for key[${key}]`)
                        }

                    } else {
                        logger.warn(`Value for key[${key}] not found in config`)
                        throw new errors.DynamicConfigMissingKey(key)
                    }

                }, (err: errors.DynamicConfigError) => {
                    logger.error(`Unable to load config. ${err.message}`)
                })
            })

            this.observerMap.set(key, observer)

            return observer
        }
    }

    public async source(key: string): Promise<string> {
        this.configState = ConfigState.RUNNING
        const error = ConfigUtils.getErrorForKey(key, this.errorMap)

        if (error) {
            throw error

        } else {
            const normalizedKey = Utils.normalizePath(key)
            return this.getConfig().then((resolvedConfig: IRootConfigValue) => {
                const value: BaseConfigValue | null = ConfigUtils.getConfigForKey(
                    normalizedKey,
                    resolvedConfig,
                )

                if (value !== null) {
                    return value.source.name

                } else {
                    throw new errors.DynamicConfigMissingKey(key)
                }
            }, (err: errors.DynamicConfigError) => {
                throw err
            })
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
        return this.get(key).catch(() => defaultVal)
    }

    public async getRemoteValue<T>(key: string): Promise<T> {
        return this.getValueFromResolver<T>(key, 'remote')
    }

    public async getSecretValue<T>(key: string): Promise<T> {
        return this.getValueFromResolver<T>(key, 'secret')
    }

    private buildDefaultForPlaceholder(placeholder: IResolvedPlaceholder, err?: errors.DynamicConfigError): BaseConfigValue {
        if (placeholder.default !== undefined) {
            if (err !== undefined) {
                logger.warn(`Unable to read value. Returning default value. ${err.message}`)
            }

            return ConfigBuilder.buildBaseConfigValue({
                type: placeholder.resolver.type,
                name: placeholder.resolver.name,
                key: placeholder.key,
            }, this.translator(placeholder.default))

        } else if (placeholder.nullable) {
            if (err !== undefined) {
                logger.warn(`Unable to read value. Returning null value. ${err.message}`)
            }

            return ConfigBuilder.nullValueForPlaceholder(placeholder)

        } else if (err !== undefined) {
            logger.error(err.message)
            this.errorMap = ConfigUtils.setErrorForKey(placeholder.path, err, this.errorMap)
            return ConfigBuilder.invalidValueForPlaceholder(placeholder)

        } else {
            const missingError = new errors.MissingConfigPlaceholder(placeholder.path)
            logger.error(missingError.message)
            this.errorMap = ConfigUtils.setErrorForKey(placeholder.path, missingError, this.errorMap)
            return ConfigBuilder.invalidValueForPlaceholder(placeholder)
        }
    }

    private async getRemotePlaceholder(placeholder: IResolvedPlaceholder): Promise<BaseConfigValue> {
        const resolver: IRemoteResolver | undefined = this.resolversByName[placeholder.resolver.name]

        if (resolver === undefined) {
            return this.buildDefaultForPlaceholder(placeholder)

        } else {
            return resolver.get(placeholder.key).then(
                (remoteValue: any) => {
                    return ConfigBuilder.buildBaseConfigValue({
                        type: placeholder.resolver.type,
                        name: placeholder.resolver.name,
                        key: placeholder.key,
                    }, this.translator(remoteValue))
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
            (whitelist === undefined || whitelist.indexOf(configValue.value._source) > -1)
        ) {
            const resolvedPlaceholder: IResolvedPlaceholder = ConfigUtils.normalizeConfigPlaceholder(
                path,
                configValue.value,
                this.resolversByName,
            )

            updates.push([
                path,
                this.getRemotePlaceholder(resolvedPlaceholder).then((val: any) => {
                    return (this.replaceConfigPlaceholders(val, whitelist) as Promise<BaseConfigValue>)
                }),
            ])

        } else if (configValue.type === 'object' || configValue.type === 'array') {
            this.collectConfigPlaceholders(configValue, path, updates, whitelist)
        }
    }

    private collectConfigPlaceholders(
        configValue: ConfigValue,
        path: KeyPath,
        updates: Array<PromisedUpdate>,
        whitelist?: Array<string>,
    ): Array<PromisedUpdate> {
        if (configValue.type === 'array') {
            configValue.items.forEach((oldValue: BaseConfigValue, index: number) => {
                const newPath: KeyPath = [ ...path, `${index}` ]
                this.appendUpdatesForObject(oldValue, newPath, updates, whitelist)
            })

            return updates

        } else if (configValue.type === 'object' || configValue.type === 'root') {
            for (const key of Object.keys(configValue.properties)) {
                const objValue: BaseConfigValue = configValue.properties[key]
                const newPath: KeyPath = [ ...path, key ]
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
        rootConfig: ConfigValue,
        whitelist?: Array<string>,
    ): Promise<ConfigValue> {
        const unresolved: Array<PromisedUpdate> = this.collectConfigPlaceholders(rootConfig, [], [], whitelist)
        const paths: Array<string> = unresolved.map((next: PromisedUpdate) => next[0].join('.'))
        const promises: Array<Promise<BaseConfigValue>> = unresolved.map((next: PromisedUpdate) => next[1])
        const resolvedPromises: Array<BaseConfigValue> = await Promise.all(promises)
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
            rootConfig,
        )

        return ConfigPromises.resolveConfigPromises(newObj)
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

    private getConfig(): Promise<IRootConfigValue> {
        if (this.promisedConfig === null) {
            this.promisedConfig = this.loadConfigs().then(async (loadedConfigs: IRootConfigValue) => {
                const resolvedConfig = await this.replaceConfigPlaceholders(loadedConfigs) as IRootConfigValue
                this.setConfig(resolvedConfig)
                return resolvedConfig
            })
        }

        return this.promisedConfig
    }

    private async initializeResolvers(currentConfig: IRootConfigValue): Promise<IRootConfigValue> {
        const allResolvers: Array<IRemoteResolver> = [
            this.resolvers.remote,
            this.resolvers.secret,
        ].filter((next) => next !== undefined) as Array<IRemoteResolver>
        const numResolvers: number = allResolvers.length
        let index: number = 0

        return this.replaceConfigPlaceholders(currentConfig, this.initializedResolvers).then(
            (initialConfig: IRootConfigValue) => {
                const loadNextConfig = async (): Promise<IRootConfigValue> => {
                    if (index < numResolvers) {
                        const nextResolver: IRemoteResolver = allResolvers[index]
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
        const resolver: IRemoteResolver | undefined = this.resolvers[type]

        if (resolver !== undefined) {
            return resolver.get<T>(key).then((remoteValue: T) => {
                if (remoteValue !== null) {
                    return Promise.resolve(remoteValue)

                } else {
                    return Promise.reject(new errors.DynamicConfigMissingKey(key))
                }
            }, () => {
                return Promise.reject(new errors.DynamicConfigMissingKey(key))
            })
        } else {
            return Promise.reject(new errors.ResolverUnavailable(key))
        }
    }

    private getResolverForValue(value: BaseConfigValue): IRemoteResolver | undefined {
        return this.resolversByName[value.source.name]
    }
}
