import { DynamicConfig } from '../DynamicConfig'

import { IConsulOptions, IRemoteResolver, ObjectType } from '../types'

import { MissingEnvironmentVariable } from '../errors'

import { ConfigUtils } from '../utils'

import * as logger from '../logger'

export function envResolver(): IRemoteResolver {
    return {
        type: 'remote',
        name: 'env',

        init(
            configInstance: DynamicConfig,
            remoteOptions: IConsulOptions = {},
        ): Promise<any> {
            return Promise.resolve({})
        },

        get<T = any>(key: string, type?: ObjectType): Promise<T> {
            const value: string | undefined = process.env[key]
            if (value !== undefined) {
                if (type !== undefined) {
                    return ConfigUtils.readValueForType(value, type)
                } else {
                    return Promise.resolve(value) as any
                }
            } else {
                logger.warn(`Unable to retrieve key[${key}] from environment`)
                return Promise.reject(new MissingEnvironmentVariable(key))
            }
        },
    }
}
