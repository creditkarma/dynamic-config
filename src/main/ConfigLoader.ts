import * as path from 'path'
import * as fs from 'fs'

import {
    DynamicConfigMissingDefault,
    DynamicConfigMissingLoader,
} from './errors'

import {
    CONFIG_PATH,
    CONFIG_SEARCH_PATHS,
    DEFAULT_CONFIG_PATH,
    DEFAULT_ENVIRONMENT,
    NODE_CONFIG_DIR,
} from './constants'

import { FileUtils, ObjectUtils, PromiseUtils, Utils } from './utils'

import { IFileLoader, ILoadedFile } from './types'

import { defaultLogger as logger } from './logger'

function getConfigPath(sourceDir: string): string {
    console.log({ sourceDir, CONFIG_SEARCH_PATHS })
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
): Promise<object> {
    return PromiseUtils.some(
        loaders.map((loader: IFileLoader): Promise<Array<object>> => {
            const types: Array<string> = Array.isArray(loader.type)
                ? loader.type
                : [loader.type]

            return PromiseUtils.some(
                types.map(async (ext: string) => {
                    const filePath: string = path.resolve(
                        configPath,
                        `${name}.${ext}`,
                    )

                    if (fs.existsSync(filePath)) {
                        return loader.load(filePath)
                    } else {
                        throw new Error(`File[${filePath}] doesn't exists`)
                    }
                }),
            ).then((val: Array<any>) => {
                return val.reduce((acc: any, next: any) => {
                    return ObjectUtils.overlayObjects(acc, next)
                }, {})
            })
        }),
    ).then((configs: Array<object>): object => {
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
        configPath = Utils.readFirstMatch(CONFIG_PATH, NODE_CONFIG_DIR) ||
            DEFAULT_CONFIG_PATH,
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
        try {
            const config = await loadFileWithName(
                this.loaders,
                this.configPath,
                'default',
            )
            console.log({ config })
            return { name: 'default', config }
        } catch {
            logger.error(
                `Unable to load default config at path[${this.configPath}]`,
            )
            throw new DynamicConfigMissingDefault(this.configPath)
        }
    }

    private loaderForType(type: string): IFileLoader {
        for (const loader of this.loaders) {
            if (loader.type === type) {
                return loader
            }
        }

        throw new DynamicConfigMissingLoader(type)
    }

    private async loadParentFiles(paths: Array<string>): Promise<object> {
        const parentConfigs = await Promise.all(
            paths.map(async (p: string) => {
                // Remove the '.' from the extension
                const ext = path.extname(p).slice(1)
                const loader = this.loaderForType(ext)
                const parentFilePath = path.resolve(this.configPath, p)
                const parentConfig = await loader.load(parentFilePath)
                return parentConfig
            }),
        )

        return parentConfigs.reduce((acc: object, next: object) => {
            return ObjectUtils.overlay(acc, next)
        }, {})
    }

    /**
     * Loads JSON config file based on NODE_ENV.
     */
    public async loadEnvironment(): Promise<ILoadedFile> {
        try {
            const envConfig = await loadFileWithName(
                this.loaders,
                this.configPath,
                this.configEnv,
            )

            const _extends = Reflect.get(envConfig, 'extends')

            if (Utils.isStringArray(_extends)) {
                logger.log(`Loading parent config files ${_extends}`)
                const parentConfig = await this.loadParentFiles(_extends)
                return {
                    name: this.configEnv,
                    config: ObjectUtils.overlay(parentConfig, envConfig),
                    extends: _extends,
                }
            }

            return {
                name: this.configEnv,
                config: envConfig,
                extends: undefined,
            }
        } catch {
            logger.warn(
                `Unable to load config for environment[${this.configEnv}]`,
            )
            return {
                name: this.configEnv,
                config: {},
            }
        }
    }
}
