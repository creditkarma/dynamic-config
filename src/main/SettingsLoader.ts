import {  } from 'ajv'
import * as fs from 'fs'
import * as logger from './logger'
import { ConfigResolver, IConfigOptions, IConfigTranslator, IFileLoader, IRemoteOptions } from './types'
import { FileUtils, JSONUtils } from './utils'

import {
    consulTranslator,
    debugTranslator,
    envTranslator,
} from './translators'

import {
    consulResolver,
    envResolver,
    processResolver,
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
        'configPath': {
            type: 'string',
        },
        'configEnv': {
            type: 'string',
        },
        'remoteOptions': {
            type: 'object',
        },
        'resolvers': {
            type: 'array',
            items: {
                type: 'string',
            },
        },
        'loaders': {
            type: 'array',
            items: {
                type: 'string',
            },
        },
        'translators': {
            type: 'array',
            items: {
                type: 'string',
            },
        },
    },
}

const defaultTranslatorMap: { [name: string]: IConfigTranslator } = {
    debug: debugTranslator,
    env: envTranslator,
    consul: consulTranslator,
}

const defaultLoaderMap: { [name: string]: IFileLoader } = {
    js: jsLoader,
    ts: tsLoader,
    json: jsonLoader,
    yml: ymlLoader,
    yaml: ymlLoader,
}

const defaultResolverMap: { [name: string]: () => ConfigResolver } = {
    consul: consulResolver,
    vault: vaultResolver,
    env: envResolver,
    process: processResolver,
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
        result.resolvers = settings.resolvers.reduce((acc: Array<ConfigResolver>, next: string) => {
            if (defaultResolverMap[next] !== undefined) {
                acc.push(defaultResolverMap[next]())
            }
            return acc
        }, [])

    } else {
        result.resolvers = [
            envResolver(),
            processResolver(),
            consulResolver(),
            vaultResolver(),
        ]
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
