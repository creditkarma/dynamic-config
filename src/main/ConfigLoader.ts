import * as path from 'path'

import {
    DynamicConfigMissingDefault,
} from './errors'

import {
    CONFIG_PATH,
    CONFIG_SEARCH_PATHS,
    DEFAULT_CONFIG_PATH,
    DEFAULT_ENVIRONMENT,
    NODE_CONFIG_DIR,
} from './constants'

import {
    FileUtils,
    ObjectUtils,
    PromiseUtils,
    Utils,
} from './utils'

import {
    IFileLoader,
    ILoadedFile,
} from './types'

import * as logger from './logger'

function getConfigPath(sourceDir: string): string {
    const configPath = FileUtils.findDir(sourceDir, CONFIG_SEARCH_PATHS)
    if (configPath !== null) {
        return configPath
    } else {
        throw new Error('No local config directory found')
    }
}

async function loadFileWithName(
    loaders: Array<IFileLoader>,
    configPath: string,
    name: string,
): Promise<Array<object>> {
    return PromiseUtils.some(loaders.map((loader: IFileLoader): Promise<Array<object>> => {
        const types: Array<string> = (Array.isArray(loader.type)) ? loader.type : [ loader.type ]

        return PromiseUtils.some(types.map((ext: string) => {
            const filePath: string = path.resolve(configPath, `${name}.${ext}`)

            return FileUtils.fileExists(filePath).then(() => {
                return loader.load(filePath)
            })

        })).then((val: Array<any>) => {
            return val.reduce((acc: any, next: any) => {
                return ObjectUtils.overlayObjects(acc, next)
            }, {})
        })

    })).then((configs: Array<object>) => {
        return PromiseUtils.resolveObjectPromises(
            ObjectUtils.overlayObjects(...configs),
        )
    })
}

export interface ILoaderConfig {
    loaders?: Array<IFileLoader>
    configPath?: string
    configEnv?: string
}

export class ConfigLoader {
    private loaders: Array<IFileLoader>
    private configPath: string
    private configEnv: string

    constructor({
        loaders = [],
        configPath = Utils.readFirstMatch(CONFIG_PATH, NODE_CONFIG_DIR) || DEFAULT_CONFIG_PATH,
        configEnv = process.env.NODE_ENV || DEFAULT_ENVIRONMENT,
    }: ILoaderConfig = {}) {
        this.loaders = loaders
        this.configPath = getConfigPath(configPath)
        this.configEnv = configEnv
    }

    /**
     * Loads default JSON config file. This is required.
     */
    public async loadDefault(): Promise<ILoadedFile> {
        return loadFileWithName(this.loaders, this.configPath, 'default').then((config: object) => {
            return {
                name: 'default',
                config,
            }
        }, (err: any) => {
            logger.error(`Unable to load default config at path[${this.configPath}]`)
            throw new DynamicConfigMissingDefault(this.configPath)
        })
    }

    /**
     * Loads JSON config file based on NODE_ENV.
     */
    public async loadEnvironment(): Promise<ILoadedFile> {
        return loadFileWithName(this.loaders, this.configPath, this.configEnv).then((config: object) => {
            return {
                name: this.configEnv,
                config,
            }
        }, (err: any) => {
            logger.warn(err.message)
            return {
                name: this.configEnv,
                config: {},
            }
        })
    }
}
