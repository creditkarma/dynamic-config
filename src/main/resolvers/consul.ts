import { Catalog, KvStore } from '@creditkarma/consul-client'

import { DynamicConfig } from '../DynamicConfig'
import { Just, Maybe, Nothing } from '../Maybe'

import {
    CONSUL_ADDRESS,
    CONSUL_DC,
    CONSUL_KEYS,
    CONSUL_NAMESPACE,
} from '../constants'

import { ConsulFailed, ConsulNotConfigured } from '../errors'

import {
    IConsulOptions,
    IRemoteOverrides,
    IRemoteResolver,
    ObjectType,
    WatchFunction,
} from '../types'

import { ObjectUtils, Utils } from '../utils'

import * as logger from '../logger'

export function toRemoteOptionMap(str: string): IRemoteOverrides {
    const [key, ...tail] = str.split('?')
    const result: IRemoteOverrides = { key }

    if (tail.length > 0) {
        const params = tail[0]
        const options = params.split('&')
        for (const option of options) {
            const [name, value] = option.split('=')
            if (value !== undefined) {
                result[name] = value
            }
        }
    }

    return result
}

function addTrailingSlash(str: string): string {
    if (str.endsWith('/')) {
        return str
    } else {
        return `${str}/`
    }
}

interface IConsulClient {
    kvStore: KvStore
    catalog: Catalog
}

export function consulResolver(): IRemoteResolver {
    let consulClient: Maybe<IConsulClient>
    let consulAddress: Maybe<string> = new Nothing()
    let consulDc: Maybe<string> = new Nothing()
    let consulKeys: Maybe<string> = new Nothing()
    let consulNamespace: Maybe<string> = new Nothing()

    function getConsulClient(): Maybe<IConsulClient> {
        if (consulClient !== undefined) {
            return consulClient

        } else {
            if (consulAddress.isNothing()) {
                logger.warn(
                    'Could not create a Consul client: Consul Address (CONSUL_ADDRESS) is not defined',
                )
                consulClient = new Nothing<IConsulClient>()

            } else if (consulDc.isNothing()) {
                logger.warn(
                    'Could not create a Consul client: Consul Data Center (CONSUL_DC) is not defined',
                )
                consulClient = new Nothing<IConsulClient>()

            } else {
                consulClient = new Just({
                    kvStore: new KvStore(consulAddress.get()),
                    catalog: new Catalog(consulAddress.get()),
                })
            }

            return consulClient
        }
    }

    return {
        type: 'remote',
        name: 'consul',
        init(
            configInstance: DynamicConfig,
            remoteOptions: IConsulOptions = {},
        ): Promise<any> {
            consulAddress = Maybe.fromNullable(
                remoteOptions.consulAddress || Utils.readFirstMatch(CONSUL_ADDRESS),
            )
            consulDc = Maybe.fromNullable(
                remoteOptions.consulDc || Utils.readFirstMatch(CONSUL_DC),
            )
            consulKeys = Maybe.fromNullable(
                remoteOptions.consulKeys || Utils.readFirstMatch(CONSUL_KEYS),
            )
            consulNamespace = Maybe.fromNullable(
                remoteOptions.consulNamespace || Utils.readFirstMatch(CONSUL_NAMESPACE),
            )

            return Maybe.all(consulKeys, getConsulClient(), consulDc).fork(
                ([keys, client, dc]) => {
                    const rawConfigs: Promise<Array<any>> = Promise.all(
                        keys.split(',').map((key: string) => {
                            return client.kvStore.get({ path: key, dc }).then((val: any) => {
                                if (val === null) {
                                    throw new Error(`Unable to find key[${key}] in Consul`)
                                } else {
                                    return val
                                }
                            })
                        }),
                    ).catch((err: any) => {
                        logger.error(`Unable to read keys[${keys}] from Consul: `, err)
                        return []
                    })

                    const resolvedConfigs: Promise<any> = rawConfigs.then(
                        (configs: Array<any>): any => {
                            return ObjectUtils.overlayObjects(...configs) as any
                        },
                    )

                    return resolvedConfigs
                },
                () => {
                    logger.log('Consul is not configured')
                    return Promise.resolve({})
                },
            )
        },

        get<T = any>(key: string): Promise<T> {
            console.log('consul get: ', key)
            return getConsulClient().fork((client: IConsulClient) => {
                const remoteOptions: IRemoteOverrides = toRemoteOptionMap(
                    key,
                )

                return client.kvStore
                    .get({ path: consulNamespace.fork((val: string) => {
                        return `${addTrailingSlash(val)}${remoteOptions.key}`
                    }, () => {
                        return `${remoteOptions.key}`
                    }), dc: remoteOptions.dc || consulDc.getOrElse('') }).then((val: any) => {
                        console.log(`val from consul[${key}]: `, val)
                        if (val !== null) {
                            return val

                        } else {
                            return client.catalog.resolveAddress(key).then((address: string) => {
                                return address
                            }, (err: Error) => {
                                logger.error(`Error retrieving key[${key}] from Consul: `, err)
                                return Promise.reject(new ConsulFailed(err.message))
                            })
                        }
                    }, (err: any) => {
                        logger.error(`Error retrieving key[${key}] from Consul: `, err)
                        return Promise.reject(new ConsulFailed(err.message))
                    })
            }, () => {
                logger.error(`Error retrieving key[${key}]: Consul is not configured`)
                return Promise.reject(new ConsulNotConfigured(key))
            })
        },

        watch<T = any>(key: string, callback: WatchFunction<T>, type?: ObjectType): void {
            getConsulClient().fork(
                (client: IConsulClient) => {
                    const remoteOptions: IRemoteOverrides = toRemoteOptionMap(
                        key,
                    )

                    client.kvStore
                        .watch({ path: consulNamespace.fork((val: string) => {
                            return `${addTrailingSlash(val)}${remoteOptions.key}`
                        }, () => {
                            return `${remoteOptions.key}`
                        }), dc: remoteOptions.dc || consulDc.getOrElse('') })
                        .onValue((val: any) => {
                            console.log('val: ', val)
                            callback(val)
                        })
                },
                () => {
                    logger.error(`Error watching key[${key}]: Consul is not configured`)
                },
            )
        },
    }
}
