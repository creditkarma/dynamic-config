import * as fs from 'fs'
import * as path from 'path'

import {
    CONFIG_SEARCH_PATHS,
    DEFAULT_CONFIG_PATH,
    DEFAULT_ENVIRONMENT,
} from './constants'

import {
    ObjectUtils,
    PromiseUtils,
} from './utils'

import {
    IFileLoader,
    ILoadedFile,
} from './types'

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
    configPath: string,
    name: string,
): Promise<ILoadedFile> {
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

    return {
        name,
        config: ObjectUtils.overlayObjects(...configs),
    }
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
        configPath = DEFAULT_CONFIG_PATH,
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
        return loadFileWithName(this.loaders, this.configPath, 'default')
    }

    /**
     * Loads JSON config file based on NODE_ENV.
     */
    public async loadEnvironment(): Promise<ILoadedFile> {
        return loadFileWithName(this.loaders, this.configPath, this.configEnv)
    }
}
