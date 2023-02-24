export interface ILogger {
    log(msg: string, data?: any): void
    warn(msg: string, data?: any): void
    error(msg: string, data?: any): void
}

export interface IVariable<T> {
    onValue(callback: (val: T) => void): void
    onError(callback: (err: Error) => void): void
    current(): T | null
    previous(): T | null
}

export interface IRemoteOptions {
    [name: string]: any
}

export interface ISchemaMap {
    [key: string]: object
}

export interface IConfigOptions {
    configPath?: string
    configEnv?: string
    remoteOptions?: IRemoteOptions
    resolvers?: IResolverMap
    loaders?: Array<IFileLoader>
    translators?: Array<IConfigTranslator>
    schemas?: ISchemaMap
}

export interface IConsulOptions {
    consulAddress?: string
    consulDc?: string
    consulKeys?: string
    consulNamespace?: string
}

export interface IRemoteOverrides {
    key: string
    [name: string]: string
}

export interface IConfigStore {
    get<T = any>(key: string): T | null
    getAll(...args: Array<string>): Array<any>
    getWithDefault<T = any>(key: string, defaultVal: T): T
}

export interface IDynamicConfig {
    get<T = any>(key?: string): Promise<T>
    watch<T = any>(key?: string): IVariable<T>
    getAll(...args: Array<string>): Promise<Array<any>>
    getWithDefault<T = any>(key: string, defaultVal: T): Promise<T>
    getRemoteValue<T>(key: string): Promise<T>
    getSecretValue<T>(key: string): Promise<T>
}

// CONFIG TRANSLATOR TYPES

export interface IConfigTranslator {
    translate(configValue: any): any
}

export type ITranslator = (obj: any) => any

// FILE LOADER TYPES

export interface IFileLoader {
    type: string | Array<string>
    load(filePath: string): Promise<object>
}

export interface ILoadedFile {
    name: string
    config: object
}

// RESOLVER TYPES

export interface IResolvers {
    env: IRemoteResolver
    process: IRemoteResolver
    remote?: IRemoteResolver
    secret?: IRemoteResolver
}

export interface IResolverMap {
    remote?: IRemoteResolver
    secret?: IRemoteResolver
}

export interface INamedResolvers {
    [name: string]: IRemoteResolver
}

export type SetFunction<T = any> = (key: string, value: T) => void

export type RemoteInitializer = (
    config: IConfigStore,
    remoteOptions?: IRemoteOptions,
) => Promise<any>

export type ResolverType = 'remote' | 'secret'

export interface IRemoteResolver {
    type: ResolverType
    name: string
    init: RemoteInitializer
    get<T>(key: string, type?: ObjectType, altKey?: string): Promise<T>
    watch<T>(
        key: string,
        cb: WatchFunction<T>,
        type?: ObjectType,
        altKey?: string,
    ): void
}

// CONFIG TYPES

export type SourceType = 'local' | 'remote' | 'secret' | 'env' | 'process'

export interface ISource {
    type: SourceType
    name: string
    key?: string
    altKey?: string
}

export type ConfigType = 'root' | ObjectType | DeferredType | InvalidType

export type ObjectType =
    | 'object'
    | 'array'
    | 'string'
    | 'number'
    | 'boolean'
    | 'null'

export type DeferredType = 'promise' | 'placeholder'

export type InvalidType = 'invalid'

export type WatchFunction<T = any> = (
    err: Error | undefined,
    val: T | undefined,
) => void

export interface IConfigValue {
    type: ConfigType
    watcher: WatchFunction<any> | null
}

export interface IConfigError {
    key: string
    message: string
}

export interface IBaseConfigValue extends IConfigValue {
    source: ISource
    nullable: boolean
}

export type ConfigValue = IRootConfigValue | BaseConfigValue

export type BaseConfigValue =
    | IObjectConfigValue
    | IArrayConfigValue
    | IPrimitiveConfigValue
    | INullConfigValue
    | IPromisedConfigValue
    | IPlaceholderConfigValue
    | IInvalidConfigValue

export interface IConfigProperties {
    [name: string]: BaseConfigValue
}

export type ConfigItems = Array<BaseConfigValue>

export interface IRootConfigValue extends IConfigValue {
    type: 'root'
    properties: IConfigProperties
}

export interface IObjectConfigValue extends IBaseConfigValue {
    type: 'object'
    properties: IConfigProperties
}

export interface IArrayConfigValue extends IBaseConfigValue {
    type: 'array'
    items: ConfigItems
}

export interface IPrimitiveConfigValue extends IBaseConfigValue {
    type: 'string' | 'number' | 'boolean'
    value: string | number | boolean
}

export interface INullConfigValue extends IBaseConfigValue {
    type: 'null'
    value: null
}

export interface IInvalidConfigValue extends IBaseConfigValue {
    type: 'invalid'
    value: null
}

export interface IPromisedConfigValue extends IBaseConfigValue {
    type: 'promise'
    value: Promise<any>
}

export interface IPlaceholderConfigValue extends IBaseConfigValue {
    type: 'placeholder'
    value: IConfigPlaceholder
}

// CONFIG PLACEHOLDER TYPES

export interface IResolver {
    name: string
    type: ResolverType
}

/**
 * Config placeholder as it appears in the raw config
 */
export interface IConfigPlaceholder {
    _source: string
    _key: string
    _type?: ObjectType
    _default?: any
    _nullable?: boolean
    _altKey?: string
}

/**
 * Config placeholder as is resolved after all resolvers have been registered.
 *
 * name - name of remote resolver
 * key - key to fetch from resolver
 * type - type of resolver
 * default - default value if fetching fails
 */
export interface IResolvedPlaceholder {
    path: string
    resolver: IResolver
    key: string
    type: ObjectType
    nullable: boolean
    default?: any
    altKey?: string
}

// UTILITY TYPES

export type KeyPath = Array<string>

export type ObjectUpdate = [KeyPath, Promise<any>]

export type PromisedUpdate = [KeyPath, Promise<BaseConfigValue>]

// SCHEMA TYPES

export type ISchema =
    | IArraySchema
    | IObjectSchema
    | IStringSchema
    | INumberSchema
    | IBooleanSchema
    | IAnySchema
    | INullSchema
    | IInvalidSchema
    | IUndefinedSchema

export interface IArraySchema {
    type: 'array'
    items?: ISchema
}

export interface IObjectSchema {
    type: 'object'
    properties?: ISchemaMap
    required?: Array<string>
}

export interface IStringSchema {
    type: 'string'
}

export interface INumberSchema {
    type: 'number'
}

export interface IBooleanSchema {
    type: 'boolean'
}

// eslint-disable-next-line @typescript-eslint/no-empty-interface
export interface IAnySchema {}

export interface INullSchema {
    type: 'null'
}

export interface IUndefinedSchema {
    type: 'undefined'
}

export interface IInvalidSchema {
    type: 'invalid'
}
