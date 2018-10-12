import { Catalog, KvStore } from '@creditkarma/consul-client'

import { Just, Maybe, Nothing } from '../Maybe'

import {
    CONSUL_ADDRESS,
    CONSUL_DC,
    CONSUL_KEYS,
    CONSUL_NAMESPACE,
} from '../constants'

import * as errors from '../errors'

import {
    IConfigStore,
    IConsulOptions,
    IRemoteOverrides,
    IRemoteResolver,
    ObjectType,
    WatchFunction,
} from '../types'

import { ObjectUtils, Utils } from '../utils'

import { defaultLogger as logger } from '../logger'

export function toRemoteOptionMap(str: string): IRemoteOverrides {
    const [ key, ...tail ] = str.split('?')
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
                const addresses: Array<string> = consulAddress.get().split(',').map((next: string) => {
                    return next.trim()
                }).filter((next: string) => {
                    return next !== ''
                })

                consulClient = new Just({
                    kvStore: new KvStore(addresses),
                    catalog: new Catalog(addresses),
                })
            }

            return consulClient
        }
    }

    return {
        type: 'remote',
        name: 'consul',

        async init(configInstance: IConfigStore, remoteOptions: IConsulOptions = {}): Promise<any> {
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

            return Maybe.all(getConsulClient(), consulDc).fork(
                // Some case
                ([client, dc]) => {
                    const keys: string = consulKeys.getOrElse('')

                    if (keys !== '') {
                        const rawConfigs: Promise<Array<any>> = Promise.all(
                            keys.split(',').map((key: string) => {
                                return client.kvStore.get({ path: key, dc }).then((val: any) => {
                                    if (val === null) {
                                        throw new Error(`Unable to find key[${key}] in Consul.`)
                                    } else {
                                        return val
                                    }
                                })
                            }),
                        ).catch((err: any) => {
                            logger.error(`Unable to read keys[${keys}] from Consul. ${err.message}`)
                            return []
                        })

                        const resolvedConfigs: Promise<any> = rawConfigs.then(
                            (configs: Array<any>): any => {
                                return ObjectUtils.overlayObjects(...configs) as any
                            },
                        )

                        return resolvedConfigs

                    } else {
                        logger.log('No keys to load from Consul.')
                        return {}
                    }
                },
                // Nothing case
                () => {
                    logger.log('Consul is not configured.')
                    return {}
                },
            )
        },

        async get<T = any>(key: string): Promise<T> {
            return getConsulClient().fork(
                // Some case
                (client: IConsulClient) => {
                    const remoteOptions: IRemoteOverrides = toRemoteOptionMap(
                        key,
                    )

                    return client.kvStore
                        .get({
                            path: consulNamespace.fork(
                                // Some case
                                (val: string) => {
                                    return `${addTrailingSlash(val)}${remoteOptions.key}`
                                },
                                // Nothing case
                                () => {
                                    return `${remoteOptions.key}`
                                },
                            ),
                            dc: (remoteOptions.dc || consulDc.getOrElse('')),
                        }).then((val: any) => {
                            if (val !== null) {
                                return val

                            } else {
                                return client.catalog.resolveAddress(key).then((address: string) => {
                                    return address
                                }, (err: Error) => {
                                    throw new errors.ConsulFailed(key, err.message)
                                })
                            }
                        }, (err: any) => {
                            throw new errors.ConsulFailed(key, err.message)
                        })
                },
                // Nothing case
                () => {
                    throw new errors.ConsulNotConfigured(key)
                },
            )
        },

        watch<T = any>(key: string, callback: WatchFunction<T>, type?: ObjectType): void {
            getConsulClient().fork(
                (client: IConsulClient) => {
                    const remoteOptions: IRemoteOverrides = toRemoteOptionMap(
                        key,
                    )

                    const pathForKey = consulNamespace.fork(
                        // Some case
                        (val: string) => {
                            return `${addTrailingSlash(val)}${remoteOptions.key}`
                        },
                        // Nothing case
                        () => {
                            return `${remoteOptions.key}`
                        },
                    )

                    client.kvStore.get({
                        path: pathForKey,
                        dc: (remoteOptions.dc || consulDc.getOrElse('')),
                    }).then((_val: any) => {
                        if (_val !== null) {
                            client.kvStore
                                .watch({
                                    path: pathForKey,
                                    dc: (remoteOptions.dc || consulDc.getOrElse('')),
                                }).onValue((val: any) => {
                                    callback(val)
                                })

                        } else {
                            client.catalog.resolveAddress(key).then((address: string) => {
                                client.catalog.watchAddress(key).onValue((val: any) => {
                                    callback(val)
                                })

                            }, (err: any) => {
                                logger.error(`Unable to watch key[${key}]. Value not found in Consul`)
                            })
                        }
                    }, (err: any) => {
                        logger.error(`Unable to watch key[${key}]. Value not found in Consul`)
                    })
                },
                () => {
                    logger.warn(`Unable to watch changes for key[${key}]. Consul is not configured.`)
                },
            )
        },
    }
}
