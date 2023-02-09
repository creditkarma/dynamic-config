import { IHVConfig, VaultClient } from '@creditkarma/vault-client'

import { HVAULT_CONFIG_KEY } from '../../../main/constants'

import { Just, Maybe, Nothing } from '../../../main/Maybe'

import * as errors from '../../../main/errors'

import {
    IConfigStore,
    IRemoteResolver,
    ObjectType,
    WatchFunction,
} from '../../../main/types'

import { defaultLogger as logger } from '../../../main/logger'
import { PromiseUtils } from '../../../main/utils'

export function customVaultResolver(): IRemoteResolver {
    let vaultClient: Maybe<VaultClient> | null = null
    let vaultConfig: IHVConfig | null = null

    async function getVaultClient(): Promise<Maybe<VaultClient>> {
        if (vaultClient !== null) {
            return vaultClient
        } else {
            if (vaultConfig !== null) {
                vaultClient = new Just(new VaultClient(vaultConfig))
                logger.log(`Vault client initialized for secret config store.`)
            } else {
                logger.warn(`Unable to find valid configuration for Vault.`)
                vaultClient = new Nothing<VaultClient>()
            }

            return vaultClient
        }
    }

    return {
        type: 'secret',
        name: 'vault',

        init(
            configInstance: IConfigStore,
            remoteOptions: any = {},
        ): Promise<any> {
            vaultConfig = configInstance.get<IHVConfig>(HVAULT_CONFIG_KEY)
            return Promise.resolve({})
        },

        async get<T>(
            key: string,
            type?: ObjectType,
            altKey?: string,
        ): Promise<T> {
            return getVaultClient().then((maybeClient: Maybe<VaultClient>) => {
                return maybeClient.fork(
                    (client: VaultClient) => {
                        const keys = [key]
                        if (typeof altKey == 'string') {
                            keys.push(altKey)
                        }
                        return PromiseUtils.race(
                            keys.map((key) => client.get<T>(key)),
                        ).then(
                            (value: T) => {
                                return Promise.resolve(value)
                            },
                            (err: any) => {
                                throw new errors.HVFailed(err.message)
                            },
                        )
                    },
                    () => {
                        throw new errors.HVNotConfigured(key)
                    },
                )
            })
        },

        watch<T = any>(
            key: string,
            cb: WatchFunction<T>,
            type?: ObjectType,
        ): void {
            // Nothing to do. Can't watch environment variables.
        },
    }
}
