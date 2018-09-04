import * as path from 'path'

import {
    IConfigStore,
    IConsulOptions,
    IRemoteResolver,
    ObjectType,
    WatchFunction,
} from '../types'

import { MissingPackageProperty } from '../errors'

import { ConfigUtils } from '../utils'

import * as logger from '../logger'

export function packageResolver(): IRemoteResolver {
    return {
        type: 'remote',
        name: 'package',

        async init(configInstance: IConfigStore, remoteOptions: IConsulOptions = {}): Promise<any> {
            return {}
        },

        async get<T = any>(key: string, type?: ObjectType): Promise<T> {
            const pkg: any = require(path.resolve(process.cwd(), 'package.json'))
            if (pkg !== undefined) {
                const value: any = pkg[key]
                if (value !== undefined) {
                    if (type !== undefined) {
                        return ConfigUtils.readValueForType(value, type)

                    } else {
                        return Promise.resolve(value) as any
                    }
                } else {
                    logger.warn(`Unable to retrieve key[${key}] from package.json.`)
                    return Promise.reject(new MissingPackageProperty(key))
                }

            } else {
                logger.warn(`Unable to retrieve key[${key}] from package.json.`)
                return Promise.reject(new MissingPackageProperty(key))
            }
        },

        watch<T = any>(key: string, cb: WatchFunction<T>, type?: ObjectType): void {
            // Nothing to do. Can't watch environment variables.
        },
    }
}
