import { DynamicConfig } from './DynamicConfig'

import {
    IConfigOptions,
} from './types'

import * as logger from './logger'
import * as SettingsLoader from './SettingsLoader'
import { ObjectUtils } from './utils'

export * from './ConfigLoader'
export { DynamicConfig } from './DynamicConfig'
export * from './constants'
export * from './types'
export * from './resolvers'
export * from './loaders'
export * from './translators'

// DEFAULT CONFIG CLIENT

let configInstance: DynamicConfig

export function config(options: IConfigOptions = {}): DynamicConfig {
    if (configInstance === undefined) {
        configInstance = new DynamicConfig(ObjectUtils.overlayObjects(
            SettingsLoader.loadSettings(),
            options,
        ))

    } else if (Object.keys(options).length > 0) {
        logger.warn(`Options passed to config after instantiation. These values are being ignored[${Object.keys(options).join(',')}].`)
    }

    return configInstance
}
