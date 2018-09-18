import {
    IConfigStore,
    IConsulOptions,
    IRemoteResolver,
    ObjectType,
    WatchFunction,
} from '../types'

import { MissingProcessVariable } from '../errors'

import { ConfigUtils, Utils } from '../utils'

export function processResolver(): IRemoteResolver {
    return {
        type: 'remote',
        name: 'process',

        async init(configInstance: IConfigStore, remoteOptions: IConsulOptions = {}): Promise<any> {
            return {}
        },

        async get<T = any>(key: string, type?: ObjectType): Promise<T> {
            const value = Utils.readValueFromArgs(key, process.argv)
            if (value !== undefined) {
                if (type !== undefined) {
                    return ConfigUtils.readValueForType(value, type)

                } else {
                    return Promise.resolve(value) as any
                }

            } else {
                throw new MissingProcessVariable(key)
            }
        },

        watch<T = any>(key: string, cb: WatchFunction<T>, type?: ObjectType): void {
            // Can't watch process arguments
        },
    }
}
