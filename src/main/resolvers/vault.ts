import { IHVConfig, VaultClient } from '@creditkarma/vault-client'

import { HVAULT_CONFIG_KEY } from '../constants'

import { Just, Maybe, Nothing } from '../Maybe'

import { HVFailed, HVNotConfigured } from '../errors'

import { IConfigStore, ISecretResolver } from '../types'

import * as logger from '../logger'

export function vaultResolver(): ISecretResolver {
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

        init(configInstance: IConfigStore, remoteOptions: any = {}): Promise<any> {
            vaultConfig = configInstance.get<IHVConfig>(HVAULT_CONFIG_KEY)
            return Promise.resolve({})
        },

        async get<T>(key: string): Promise<T> {
            return getVaultClient().then((maybeClient: Maybe<VaultClient>) => {
                return maybeClient.fork(
                    (client: VaultClient) => {
                        return client.get<T>(key).then(
                            (value: T) => {
                                return Promise.resolve(value)
                            },
                            (err: any) => {
                                logger.error(`Unable to get key[${key}] from Vault. ${err.message}`)
                                throw new HVFailed(err.message)
                            },
                        )
                    },
                    () => {
                        logger.error(`Unable to get key[${key}]. Vault is not configured.`)
                        throw new HVNotConfigured(key)
                    },
                )
            })
        },
    }
}
