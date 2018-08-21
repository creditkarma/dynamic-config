import { DynamicConfig } from './DynamicConfig'

import * as SettingsLoader from './SettingsLoader'
import { IConfigOptions } from './types'
import { ObjectUtils, Utils } from './utils'

export * from './ConfigLoader'
export { DynamicConfig } from './DynamicConfig'
export * from './constants'
export * from './resolvers'
export * from './loaders'
export * from './translators'

export {
    IConfigOptions,
    IConfigStore,
    IDynamicConfig,
    ISchemaMap,
    IConfigTranslator,
    IRemoteOptions,
    IFileLoader,
    IRemoteResolver,
    ResolverType,
    RemoteInitializer,
    IVariable,
} from './types'

// DEFAULT CONFIG CLIENT

export const config = Utils.memoize((options: IConfigOptions = {}): DynamicConfig => {
    return new DynamicConfig(ObjectUtils.overlayObjects(
        SettingsLoader.loadSettings(),
        options,
    ))
})
