import { ChildProcess, exec } from 'child_process'
import { expect } from 'code'
import * as fs from 'fs'
import * as Lab from 'lab'
import * as path from 'path'
import * as rp from 'request-promise-native'

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
        })

        after(async () => {
            // Reset environment options for DynamicConfig
            process.env[CONFIG_PATH] = undefined
            process.env[CONSUL_ADDRESS] = undefined
            process.env[CONSUL_DC] = undefined
            process.env[CONSUL_KEYS] = undefined
        })

        describe('get', () => {
            it('should return the full config with empty call to get', async () => {
                return config().get()
                    .then((actual: any) => {
                        expect(actual).to.equal({
                            version: '2.0.1',
                            server: {
                                port: 8000,
                                host: 'localhost',
                            },
                            database: {
                                username: 'testUser',
                                password: 'K1ndaS3cr3t',
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
                                first: [ 'Bob', 'Helen', 'Joe', 'Jane' ],
                                last: [ 'Smith', 'Warren', 'Malick' ],
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
                        })
                    })
            })

            it('should return the value from Consul if available', async () => {
                return config()
                    .get<string>('database.username')
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
                            expect(err.message).to.equal('Unable to find value for key[fake.path].')
                        },
                    )
            })
        })

        describe('getSecretValue', () => {
            it('should get secret value from Vault', async () => {
                return config()
                    .getSecretValue<string>('test-secret')
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
                            expect(err.message).to.equal('Unable to find value for key[missing-secret].')
                        },
                    )
            })
        })
    })

    describe('Command Line Args', () => {
        let server: ChildProcess

        before((done) => {
            server = exec('node ./server.js CONSUL_DC=dc1 CONFIG_PATH=./config CONSUL_ADDRESS=http://localhost:8510 CONSUL_KEYS=test-config-three')
            server.stdout.on('data', (data) => {
                console.log('msg: ', data)
            })

            server.stderr.on('data', (data) => {
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
            setTimeout(done, 3000)
        })

        after((done) => {
            fs.unlinkSync('./config-settings.json')

            server.on('exit', (data) => {
                done()
            })

            server.kill()
        })

        it('should correctly run configuration with command line args', async () => {
            return rp.get('http://localhost:8080/control').then((val) => {
                expect(val).to.equal('success')
            })
        })
    })
})
