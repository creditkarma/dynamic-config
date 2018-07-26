import {
    IConfigStore,
    IConsulOptions,
    IRemoteResolver,
    ObjectType,
    WatchFunction,
} from '../types'

import { MissingProcessVariable } from '../errors'

import { ConfigUtils, Utils } from '../utils'

import * as logger from '../logger'

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
                logger.error(`Error retrieving key[${key}] from command line arguments.`)
                return Promise.reject(new MissingProcessVariable(key))
            }
        },

        watch<T = any>(key: string, cb: WatchFunction<T>, type?: ObjectType): void {
            // Can't watch process arguments
        },
    }
}
