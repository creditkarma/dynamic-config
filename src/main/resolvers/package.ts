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
                        return ConfigUtils.readValueForType(key, value, type)

                    } else {
                        return value
                    }
                } else {
                    throw new MissingPackageProperty(key)
                }

            } else {
                throw new MissingPackageProperty(key)
            }
        },

        watch<T = any>(key: string, cb: WatchFunction<T>, type?: ObjectType): void {
            // Nothing to do. Can't watch environment variables.
        },
    }
}
