import * as fs from 'fs'
import * as path from 'path'

import {
    CONFIG_SEARCH_PATHS,
    DEFAULT_CONFIG_PATH,
    DEFAULT_ENVIRONMENT,
} from './constants'

import {
    ConfigBuilder,
    ObjectUtils,
    PromiseUtils,
} from './utils'

import {
    IFileLoader,
    IRootConfigValue,
    ITranslator,
} from './types'

function identity(obj: any): any  {
    return obj
}

function fileExists(filePath: string): Promise<void> {
    return new Promise((resolve, reject) => {
        fs.exists(filePath, (exists: boolean) => {
            if (exists) {
                resolve()
            } else {
                reject(new Error(`File[${filePath}] doesn't exists`))
            }
        })
    })
}

function getConfigPath(sourceDir: string): string {
    const firstPath: string = path.resolve(process.cwd(), sourceDir)
    if (fs.existsSync(firstPath) && fs.statSync(firstPath).isDirectory) {
        return firstPath

    } else {
        for (const next of CONFIG_SEARCH_PATHS) {
            const nextPath: string = path.resolve(process.cwd(), next, sourceDir)
            if (fs.existsSync(nextPath) && fs.statSync(nextPath).isDirectory) {
                return nextPath
            }
        }
    }

    throw new Error('No local config directory found')
}

async function loadFileWithName(
    loaders: Array<IFileLoader>,
    translator: ITranslator,
    configPath: string,
    name: string,
): Promise<IRootConfigValue> {
    const configs: Array<object> = await PromiseUtils.valuesForPromises(loaders.map((loader: IFileLoader) => {
        const types: Array<string> = (Array.isArray(loader.type)) ? loader.type : [ loader.type ]

        return PromiseUtils.some(types.map((ext: string) => {
            const filePath: string = path.resolve(configPath, `${name}.${ext}`)

            return fileExists(filePath).then(() => {
                return loader.load(filePath)

            }).catch((err: any) => {
                return {}
            })

        })).then((val: Array<any>) => {
            return val.reduce((acc: any, next: any) => {
                return ObjectUtils.overlayObjects(acc, next)
            }, {})
        })
    }))

    return (ObjectUtils.overlayObjects(...configs.map((next: any): IRootConfigValue => {
        return ConfigBuilder.createConfigObject(name, 'local', translator(next))
    })) as IRootConfigValue)
}

export interface ILoaderConfig {
    loaders?: Array<IFileLoader>
    translator?: ITranslator
    configPath?: string
    configEnv?: string
}

export class ConfigLoader {
    private loaders: Array<IFileLoader>
    private translator: ITranslator
    private configPath: string
    private configEnv: string
    private savedConfig: IRootConfigValue | undefined

    constructor({
        loaders = [],
        translator = identity,
        configPath = DEFAULT_CONFIG_PATH,
        configEnv = process.env.NODE_ENV || DEFAULT_ENVIRONMENT,
    }: ILoaderConfig = {}) {
        this.loaders = loaders
        this.translator = translator
        this.configPath = getConfigPath(configPath)
        this.configEnv = configEnv
    }

    /**
     * Loads default JSON config file. This is required.
     */
    public async loadDefault(): Promise<IRootConfigValue> {
        return loadFileWithName(this.loaders, this.translator, this.configPath, 'default')
    }

    /**
     * Loads JSON config file based on NODE_ENV.
     */
    public async loadEnvironment(): Promise<IRootConfigValue> {
        return loadFileWithName(this.loaders, this.translator, this.configPath, this.configEnv)
    }

    /**
     * Returns the overlay of the default and environment local config.
     */
    public async resolve(): Promise<IRootConfigValue> {
        if (this.savedConfig !== undefined) {
            return Promise.resolve(this.savedConfig)
        } else {
            const defaultConfig: any = await this.loadDefault()
            const envConfig: any = await this.loadEnvironment()
            this.savedConfig = ObjectUtils.overlayObjects(defaultConfig, envConfig)
            if (this.savedConfig !== undefined) {
                return this.savedConfig
            } else {
                throw new Error(`Unable to resolve local configs`)
            }
        }
    }
}
