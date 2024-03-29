import { expect } from '@hapi/code'
import * as Lab from '@hapi/lab'
import { ChildProcess, exec } from 'child_process'
import * as fs from 'fs'
import * as path from 'path'
import got from 'got'

import { config } from '../../main/'

import {
    CONFIG_PATH,
    CONSUL_ADDRESS,
    CONSUL_DC,
    CONSUL_KEYS,
} from '../../main/constants'

export const lab = Lab.script()

const describe = lab.describe
const it = lab.it
const before = lab.before
const after = lab.after

describe('DynamicConfig Singleton', () => {
    describe('Environment Variables', () => {
        before(async () => {
            // Set environment options for DynamicConfig
            process.env[CONFIG_PATH] = path.resolve(__dirname, './config')
            process.env[CONSUL_ADDRESS] = 'http://localhost:8510'
            process.env[CONSUL_DC] = 'dc1'
            process.env[CONSUL_KEYS] = 'test-config-one,with-vault'
            process.env.NOT_NULLABLE = 'NOT_NULLABLE'
        })

        after(async () => {
            // Reset environment options for DynamicConfig
            delete process.env[CONFIG_PATH]
            delete process.env[CONSUL_ADDRESS]
            delete process.env[CONSUL_DC]
            delete process.env[CONSUL_KEYS]
            delete process.env.NOT_NULLABLE
        })

        describe('get', () => {
            it('should return the full config with empty call to get', async () => {
                return config()
                    .get()
                    .then((actual: any) => {
                        expect(actual).to.equal({
                            type_test: true,
                            nullable_test: {
                                nullable: null,
                                not_nullable: 'NOT_NULLABLE',
                            },
                            version: '2.0.1',
                            server: {
                                port: 8000,
                                host: 'localhost',
                            },
                            persistedQueries: {
                                databaseLookup: {
                                    username: 'testUser',
                                    password: 'K1ndaS3cr3t',
                                    shardedDBHostsInfo: {
                                        sharding: {
                                            client: {
                                                'shard-info': {
                                                    'shard-count': 12,
                                                    'shard-map': [
                                                        {
                                                            'virtual-start': 0,
                                                            'virtual-end': 3,
                                                            destination:
                                                                '127.0.0.1:3000',
                                                        },
                                                        {
                                                            'virtual-start': 4,
                                                            'virtual-end': 7,
                                                            destination:
                                                                '127.0.0.2:4000',
                                                        },
                                                        {
                                                            'virtual-start': 8,
                                                            'virtual-end': 11,
                                                            destination:
                                                                '127.0.0.3:5000',
                                                        },
                                                    ],
                                                },
                                            },
                                        },
                                    },
                                },
                            },
                            project: {
                                id: {
                                    name: 'test-project',
                                    ref: 987860,
                                },
                                health: {
                                    control: '/test',
                                    response: 'PASS',
                                },
                            },
                            names: {
                                first: ['Bob', 'Helen', 'Joe', 'Jane'],
                                last: ['Smith', 'Warren', 'Malick'],
                            },
                            'hashicorp-vault': {
                                apiVersion: 'v1',
                                protocol: 'http',
                                destination: 'localhost:8210',
                                mount: 'secret',
                                tokenPath: './tmp/token',
                            },
                            'test-service': {
                                destination: 'http://localhost:8080',
                            },
                            secret: 'this is a secret',
                        })
                    })
            })

            it('should return the value from Consul if available', async () => {
                return config()
                    .get<string>('persistedQueries.databaseLookup.username')
                    .then((val: string) => {
                        expect(val).to.equal('testUser')
                    })
            })

            it('should fallback to returning from local config', async () => {
                return config()
                    .get<object>('project.health')
                    .then((val: object) => {
                        expect(val).to.equal({
                            control: '/test',
                            response: 'PASS',
                        })
                    })
            })

            it('should reject for a missing key', async () => {
                return config()
                    .get<object>('fake.path')
                    .then(
                        (val: object) => {
                            throw new Error('Should reject for missing key.')
                        },
                        (err: any) => {
                            expect(err.message).to.equal(
                                'Unable to find value for key[fake.path].',
                            )
                        },
                    )
            })
        })

        describe('getSecretValue', () => {
            it('should get secret value from Vault', async () => {
                return config()
                    .getSecretValue<string>('secret')
                    .then((val: string) => {
                        expect(val).to.equal('this is a secret')
                    })
            })

            it('should reject for a missing secret', async () => {
                return config()
                    .getSecretValue<string>('missing-secret')
                    .then(
                        (val: string) => {
                            throw new Error('Should reject for missing secret.')
                        },
                        (err: any) => {
                            expect(err.message).to.equal(
                                'Unable to find value for key[missing-secret].',
                            )
                        },
                    )
            })
        })
    })

    describe('Command Line Args', () => {
        let server: ChildProcess

        before(async () => {
            return new Promise((resolve, reject) => {
                process.env.NOT_NULLABLE = 'NOT_NULLABLE'
                server = exec(
                    'node ./server.js CONSUL_DC=dc1 CONFIG_PATH=./config CONSUL_ADDRESS=http://localhost:8510 CONSUL_KEYS=test-config-three',
                )
                server.stdout?.on('data', (data) => {
                    console.log('msg: ', data)
                })

                server.stderr?.on('data', (data) => {
                    console.log('err: ', data)
                })

                const configValue: string = `
                {
                    "configPath": "./config",
                    "configEnv": "development",
                    "remoteOptions": {},
                    "resolvers": [
                        "env", "process", "consul", "vault"
                    ],
                    "loaders": [
                        "json", "yml", "js", "ts"
                    ],
                    "translators": [
                        "env", "consul"
                    ]
                }
                `

                fs.writeFileSync('./config-settings.json', configValue)

                // Let server spin up
                setTimeout(resolve, 3000)
            })
        })

        after(async () => {
            return new Promise<void>((resolve, reject) => {
                fs.unlinkSync('./config-settings.json')

                server.on('exit', (data) => {
                    resolve()
                })

                server.kill()
            })
        })

        it('should correctly run configuration with command line args', async () => {
            return got('http://localhost:8080/control').then((val) => {
                expect(val.body).to.equal('success')
            })
        })
    })
})
