import { IHVConfig, VaultClient } from '@creditkarma/vault-client'

import { HVAULT_CONFIG_KEY } from '../constants'

import { Just, Maybe, Nothing } from '../Maybe'

import { HVFailed, HVNotConfigured } from '../errors'

import { IConfigStore, ISecretResolver } from '../types'

import * as logger from '../logger'

export function vaultResolver(): ISecretResolver {
    let vaultClient: Maybe<VaultClient> | null = null
    let configStore: IConfigStore

    async function getVaultClient(): Promise<Maybe<VaultClient>> {
        if (vaultClient !== null) {
            return vaultClient

        } else {
            const vaultConfig: IHVConfig | null = configStore.get<IHVConfig>(HVAULT_CONFIG_KEY)
            if (vaultConfig !== null) {
                vaultClient = new Just(new VaultClient(vaultConfig))

            } else {
                logger.warn(`Unable to find valid configuration for Vault`)
                return Promise.resolve(new Nothing<VaultClient>())
            }

            return vaultClient
        }
    }

    return {
        type: 'secret',
        name: 'vault',

        init(configInstance: IConfigStore, remoteOptions: any = {}): Promise<any> {
            configStore = configInstance
            return Promise.resolve({})
        },

        get<T>(key: string): Promise<T> {
            return getVaultClient().then((maybeClient: Maybe<VaultClient>) => {
                return maybeClient.fork(
                    (client: VaultClient) => {
                        return client.get<T>(key).then(
                            (value: T) => {
                                return Promise.resolve(value)
                            },
                            (err: any) => {
                                logger.error(`Error retrieving key[${key}] from Vault: `, err)
                                return Promise.reject(new HVFailed(err.message))
                            },
                        )
                    },
                    () => {
                        logger.error(`Unable to get key[${key}]. Vault is not configured.`)
                        return Promise.reject(new HVNotConfigured(key))
                    },
                )
            })
        },
    }
}
