import {
    IConfigStore,
    IConsulOptions,
    IRemoteResolver,
    ObjectType,
    WatchFunction,
} from '../types'

import { MissingEnvironmentVariable } from '../errors'

import { ConfigUtils } from '../utils'

import * as logger from '../logger'

export function envResolver(): IRemoteResolver {
    return {
        type: 'remote',
        name: 'env',

        async init(configInstance: IConfigStore, remoteOptions: IConsulOptions = {}): Promise<any> {
            return {}
        },

        async get<T = any>(key: string, type?: ObjectType): Promise<T> {
            const value: string | undefined = process.env[key]
            if (value !== undefined) {
                if (type !== undefined) {
                    return ConfigUtils.readValueForType(value, type)

                } else {
                    return Promise.resolve(value) as any
                }

            } else {
                logger.warn(`Unable to retrieve key[${key}] from environment.`)
                return Promise.reject(new MissingEnvironmentVariable(key))
            }
        },

        watch<T = any>(key: string, cb: WatchFunction<T>, type?: ObjectType): void {
            // Nothing to do. Can't watch environment variables.
        },
    }
}
