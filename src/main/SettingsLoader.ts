import {  } from 'ajv'
import * as fs from 'fs'
import * as logger from './logger'

import {
    IConfigOptions,
    IConfigTranslator,
    IFileLoader,
    IRemoteOptions,
    IRemoteResolver,
} from './types'

import { FileUtils, JSONUtils } from './utils'

import {
    consulTranslator,
    debugTranslator,
    envTranslator,
} from './translators'

import {
    consulResolver,
    packageResolver,
    vaultResolver,
} from './resolvers'

import {
    jsLoader,
    jsonLoader,
    tsLoader,
    ymlLoader,
} from './loaders'

export const SETTINGS_FILE_NAME: string = 'config-settings.json'

export interface IConfigSettings {
    configPath?: string
    configEnv?: string
    remoteOptions?: IRemoteOptions
    resolvers?: Array<string>
    loaders?: Array<string>
    translators?: Array<string>
}

export const configSettingsSchema: object = {
    type: 'object',
    properties: {
        configPath: {
            type: 'string',
        },
        configEnv: {
            type: 'string',
        },
        remoteOptions: {
            type: 'object',
        },
        resolvers: {
            type: 'array',
            items: {
                type: 'string',
            },
        },
        loaders: {
            type: 'array',
            items: {
                type: 'string',
            },
        },
        translators: {
            type: 'array',
            items: {
                type: 'string',
            },
        },
        schemas: {
            type: 'object',
        },
    },
}

interface ITranslatorMap {
    [name: string]: IConfigTranslator
}

const defaultTranslatorMap: ITranslatorMap = {
    debug: debugTranslator,
    env: envTranslator,
    consul: consulTranslator,
}

interface ILoaderMap {
    [name: string]: IFileLoader
}

const defaultLoaderMap: ILoaderMap = {
    js: jsLoader,
    ts: tsLoader,
    json: jsonLoader,
    yml: ymlLoader,
    yaml: ymlLoader,
}

interface IResolverMap {
    [name: string]: () => IRemoteResolver
}

const defaultResolverMap: IResolverMap = {
    package: packageResolver,
    consul: consulResolver,
    vault: vaultResolver,
}

function settingsToOptions(settings: IConfigSettings): IConfigOptions {
    const result: IConfigOptions = {}

    if (settings.configPath !== undefined) {
        result.configPath = settings.configPath
    }

    if (settings.configEnv !== undefined) {
        result.configEnv = settings.configEnv
    }

    if (settings.remoteOptions !== undefined) {
        result.remoteOptions = settings.remoteOptions
    }

    if (settings.resolvers !== undefined) {
        result.resolvers = {}

        if (settings.resolvers.indexOf('consul') > -1) {
            result.resolvers.remote = defaultResolverMap.consul()
        }

        if (settings.resolvers.indexOf('vault') > -1) {
            result.resolvers.secret = defaultResolverMap.vault()
        }

    } else {
        result.resolvers = {
            remote: consulResolver(),
            secret: vaultResolver(),
        }
    }

    if (settings.loaders !== undefined) {
        result.loaders = settings.loaders.reduce((acc: Array<IFileLoader>, next: string) => {
            if (defaultLoaderMap[next] !== undefined) {
                acc.push(defaultLoaderMap[next])
            }
            return acc
        }, [])

    } else {
        result.loaders = [
            jsonLoader,
            ymlLoader,
            jsLoader,
            tsLoader,
        ]
    }

    if (settings.translators !== undefined) {
        result.translators = settings.translators.reduce((acc: Array<IConfigTranslator>, next: string) => {
            if (defaultTranslatorMap[next] !== undefined) {
                acc.push(defaultTranslatorMap[next])
            }
            return acc
        }, [])

    } else {
        result.translators = [
            envTranslator,
            consulTranslator,
        ]
    }

    return result
}

export function loadSettings(): IConfigOptions {
    const settingsPath = FileUtils.findFile(SETTINGS_FILE_NAME, [])
    if (settingsPath !== null) {
        try {
            const content: string = fs.readFileSync(settingsPath).toString('utf-8')
            const settings: IConfigSettings = JSON.parse(content)
            if (JSONUtils.objectMatchesSchema(configSettingsSchema, settings)) {
                return settingsToOptions(settings)

            } else {
                logger.error(`Config settings does not match the expected schema`)
                return settingsToOptions({})
            }

        } catch (e) {
            logger.error(`Failed to load config-settings from file[${settingsPath}]`)
            return settingsToOptions({})
        }

    } else {
        logger.log(`Unable to find static config-settings`)
        return settingsToOptions({})
    }
}
