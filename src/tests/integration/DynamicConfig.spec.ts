// import { KvStore } from '@creditkarma/consul-client'
import { expect } from 'code'
import * as Lab from 'lab'
import * as path from 'path'

import {
    consulResolver,
    consulTranslator,
    DynamicConfig,
    envResolver,
    envTranslator,
    jsLoader,
    jsonLoader,
    tsLoader,
    vaultResolver,
    ymlLoader,
} from '../../main/'

export const lab = Lab.script()

const describe = lab.describe
const it = lab.it
const before = lab.before
const after = lab.after

describe('DynamicConfig', () => {
    before(async () => {
        process.chdir(__dirname)
    })

    describe('Configured with Vault and Consul', () => {
        const dynamicConfig: DynamicConfig = new DynamicConfig({
            configEnv: 'development',
            configPath: path.resolve(__dirname, './config'),
            remoteOptions: {
                consul: {
                    consulAddress: 'http://localhost:8510',
                    consulKeys: 'test-config-one,with-vault',
                    consulDc: 'dc1',
                },
            },
            resolvers: [
                consulResolver(),
                vaultResolver(),
            ],
            loaders: [
                jsonLoader,
                ymlLoader,
                jsLoader,
                tsLoader,
            ],
            translators: [
                envTranslator,
                consulTranslator,
            ],
        })

        describe('get', () => {
            it('should return full config when making empty call to get', async () => {
                return dynamicConfig.get().then((actual: any) => {
                    console.log('actual: ', actual)
                    expect(actual).to.equal({
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
                                name: 'yaml-project',
                                ref: 123456,
                            },
                            health: {
                                control: '/javascript',
                                response: 'BOOYA',
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
                            destination: '127.0.0.1:3000',
                        },
                    })
                })
            })

            it('should return the value from Consul if available', async () => {
                return dynamicConfig.get<string>('database.username').then((actual: string) => {
                    expect(actual).to.equal('testUser')
                })
            })

            it('should fetch value from Vault when value is Vault placeholder', async () => {
                return dynamicConfig.get<string>('database.password').then((actual: string) => {
                    expect(actual).to.equal('K1ndaS3cr3t')
                })
            })

            it('should fallback to returning from local config', async () => {
                return dynamicConfig.get<object>('project.health').then((actual: object) => {
                    expect(actual).to.equal({
                        control: '/javascript',
                        response: 'BOOYA',
                    })
                })
            })

            it('should reject for a missing key', async () => {
                return dynamicConfig.get<object>('fake.path').then((actual: object) => {
                    throw new Error('Should reject for missing key')
                }, (err: any) => {
                    expect(err.message).to.equal('Unable to find value for key[fake.path]')
                })
            })
        })

        describe('getAll', () => {
            it('should resolve with all requested config values', async () => {
                return dynamicConfig.getAll('database.username', 'database.password').then((actual: any) => {
                    expect(actual).to.equal(['testUser', 'K1ndaS3cr3t'])
                })
            })

            it('should reject if one of the values is missing', async () => {
                return dynamicConfig.getAll('database.username', 'database.fake').then((val: any) => {
                    throw new Error('Promise should reject')
                }, (err: any) => {
                    expect(err.message).to.equal('Unable to find value for key[database.fake]')
                })
            })
        })

        describe('getWithDefault', () => {
            it('should resolve with with value if found', async () => {
                return dynamicConfig.getWithDefault('database.username', 'defaultUser').then((actual: any) => {
                    expect(actual).to.equal('testUser')
                })
            })

            it('should resolve with with default if value not found', async () => {
                return dynamicConfig.getWithDefault('database.fake', 'defaultResponse').then((actual: any) => {
                    expect(actual).to.equal('defaultResponse')
                })
            })
        })

        describe('getSecretValue', () => {
            it('should get secret value from Vault', async () => {
                return dynamicConfig.getSecretValue<string>('test-secret').then((actual: string) => {
                    expect(actual).to.equal('this is a secret')
                })
            })

            it('should reject for a missing secret', async () => {
                return dynamicConfig.getSecretValue<string>('missing-secret').then((actual: string) => {
                    throw new Error('Should reject for missing secret')
                }, (err: any) => {
                    expect(err.message).to.equal('Unable to find value for key[missing-secret]')
                })
            })
        })
    })

    describe('Configured with Consul', () => {
        const dynamicConfig: DynamicConfig = new DynamicConfig({
            configEnv: 'development',
            configPath: path.resolve(__dirname, './config'),
            remoteOptions: {
                consul: {
                    consulAddress: 'http://localhost:8510',
                    consulKeys: 'test-config-one',
                    consulDc: 'dc1',
                },
            },
            resolvers: [
                consulResolver(),
                vaultResolver(),
            ],
            loaders: [
                jsonLoader,
                ymlLoader,
                jsLoader,
                tsLoader,
            ],
            translators: [
                envTranslator,
                consulTranslator,
            ],
        })

        // const consulClient = new KvStore('http://localhost:8510')

        describe('get', () => {
            it('should return full config when making empty call to get', async () => {
                return dynamicConfig.get<string>().then((actual: any) => {
                    expect(actual).to.equal({
                        server: {
                            port: 8000,
                            host: 'localhost',
                        },
                        database: {
                            username: 'testUser',
                            password: 'Sup3rS3cr3t',
                        },
                        project: {
                            id: {
                                name: 'yaml-project',
                                ref: 123456,
                            },
                            health: {
                                control: '/javascript',
                                response: 'BOOYA',
                            },
                        },
                        names: {
                            first: [ 'Bob', 'Helen', 'Joe', 'Jane' ],
                            last: [ 'Smith', 'Warren', 'Malick' ],
                        },
                        'test-service': {
                            destination: '127.0.0.1:3000',
                        },
                    })
                })
            })

            it('should return the value from Consul if available', async () => {
                return dynamicConfig.get<string>('database.username').then((actual: string) => {
                    expect(actual).to.equal('testUser')
                })
            })

            it('should fetch value from Consul when value is Consul placeholder', async () => {
                return dynamicConfig.get<string>('database.password').then((actual: string) => {
                    expect(actual).to.equal('Sup3rS3cr3t')
                })
            })

            it('should mutate config after getting new data from Consul', async () => {
                return dynamicConfig.get<string>().then((actual: any) => {
                    expect(actual).to.equal({
                        server: {
                            port: 8000,
                            host: 'localhost',
                        },
                        database: {
                            username: 'testUser',
                            password: 'Sup3rS3cr3t',
                        },
                        project: {
                            id: {
                                name: 'yaml-project',
                                ref: 123456,
                            },
                            health: {
                                control: '/javascript',
                                response: 'BOOYA',
                            },
                        },
                        names: {
                            first: [ 'Bob', 'Helen', 'Joe', 'Jane' ],
                            last: [ 'Smith', 'Warren', 'Malick' ],
                        },
                        'test-service': {
                            destination: '127.0.0.1:3000',
                        },
                    })
                })
            })

            it('should fallback to returning from local config', async () => {
                return dynamicConfig.get<object>('project.health').then((actual: object) => {
                    expect(actual).to.equal({
                        control: '/javascript',
                        response: 'BOOYA',
                    })
                })
            })

            it('should reject for a missing key', async () => {
                return dynamicConfig.get<object>('fake.path').then((actual: object) => {
                    throw new Error('Should reject for missing key')
                }, (err: any) => {
                    expect(err.message).to.equal('Unable to find value for key[fake.path]')
                })
            })
        })

        // describe('watch', () => {
        //     it('should return an observer for requested key', (done) => {
        //         const password = dynamicConfig.watch('database.password')
        //         console.log('password: ', password)
        //         password.onValue((next: string) => {
        //             console.log('next: ', next)
        //             if (next === '123456') {
        //                 done()
        //             }
        //         })

        //         consulClient.set({ path: 'password', dc: 'dc1' }, '123456').then((res: boolean) => {
        //             console.log('res: ', res)
        //         })
        //     })
        // })

        describe('getSecretValue', () => {
            it('should reject when Vault not configured', async () => {
                return dynamicConfig.getSecretValue<string>('test-secret').then((actual: string) => {
                    throw new Error('Should reject when Vault not configured')
                }, (err: any) => {
                    expect(err.message).to.equal('Unable to find value for key[test-secret]')
                })
            })
        })
    })

    describe('Configured with overlayed Consul Configs', () => {
        const dynamicConfig: DynamicConfig = new DynamicConfig({
            configEnv: 'development',
            configPath: path.resolve(__dirname, './config'),
            remoteOptions: {
                consul: {
                    consulAddress: 'http://localhost:8510',
                    consulKeys: 'test-config-one,test-config-two',
                    consulDc: 'dc1',
                },
            },
            resolvers: [
                consulResolver(),
                vaultResolver(),
            ],
            loaders: [
                jsonLoader,
                ymlLoader,
                jsLoader,
                tsLoader,
            ],
            translators: [
                envTranslator,
                consulTranslator,
            ],
        })

        describe('get', () => {
            it('should return full config when making empty call to get', async () => {
                return dynamicConfig.get<string>().then((actual: any) => {
                    expect(actual).to.equal({
                        server: {
                            port: 8000,
                            host: 'localhost',
                        },
                        database: {
                            username: 'fakeUser',
                            password: 'NotSoSecret',
                        },
                        project: {
                            id: {
                                name: 'yaml-project',
                                ref: 123456,
                            },
                            health: {
                                control: '/javascript',
                                response: 'BOOYA',
                            },
                        },
                        names: {
                            first: [ 'Bob', 'Helen', 'Joe', 'Jane' ],
                            last: [ 'Smith', 'Warren', 'Malick' ],
                        },
                        'test-service': {
                            destination: '127.0.0.1:3000',
                        },
                    })
                })
            })

            it('should return default value if unable to get from Consul', async () => {
                return dynamicConfig.get<string>('database.password').then((actual: any) => {
                    expect(actual).to.equal('NotSoSecret')
                })
            })
        })
    })

    describe('Without Consul or Vault Configured', () => {
        const dynamicConfig: DynamicConfig = new DynamicConfig({
            configEnv: 'development',
            configPath: path.resolve(__dirname, './config'),
            loaders: [
                jsonLoader,
                ymlLoader,
                jsLoader,
                tsLoader,
            ],
            translators: [
                envTranslator,
                consulTranslator,
            ],
            schemas: {
                'project.health': {
                    type: 'object',
                    properties: {
                        control: {
                            type: 'string',
                        },
                        response: {
                            type: 'string',
                        },
                    },
                    required: [ 'control', 'response' ],
                },
                'database': {
                    type: 'object',
                    properties: {
                        username: {
                            type: 'string',
                        },
                        password: {
                            type: 'number',
                        },
                    },
                    required: [ 'username', 'password' ],
                },
            },
        })

        describe('get', () => {
            it('should return the value from local config', async () => {
                return dynamicConfig.get<string>('database.username').then((actual: string) => {
                    console.log('actual: ', actual)
                    expect(actual).to.equal('root')
                })
            })

            it('should fallback to returning from local config', async () => {
                return dynamicConfig.get<object>('project.health').then((actual: object) => {
                    expect(actual).to.equal({
                        control: '/javascript',
                        response: 'BOOYA',
                    })
                })
            })

            it('should reject for a missing key', async () => {
                return dynamicConfig.get<object>('fake.path').then((actual: object) => {
                    throw new Error('Should reject for missing key')
                }, (err: any) => {
                    expect(err.message).to.equal('Unable to find value for key[fake.path]')
                })
            })

            it('should reject if the value does not match specified schema', async () => {
                return dynamicConfig.get<object>('database').then((actual: object) => {
                    throw new Error('Should reject for missing key')
                }, (err: any) => {
                    expect(err.message).to.equal('Object does not match expected schema[database]')
                })
            })
        })

        describe('getSecretValue', () => {
            it('should reject when Vault not configured', async () => {
                return dynamicConfig.getSecretValue<string>('test-secret').then((actual: string) => {
                    throw new Error(`Unable to retrieve key[test-secret]. Should reject when Vault not configured`)
                }, (err: any) => {
                    expect(err.message).to.equal('Unable to retrieve key[test-secret]. No resolver found.')
                })
            })
        })
    })

    describe('When Using Environment Variables', () => {
        const dynamicConfig: DynamicConfig = new DynamicConfig({
            configEnv: 'production',
            configPath: path.resolve(__dirname, './config'),
            resolvers: [
                envResolver(),
            ],
            loaders: [
                jsonLoader,
                ymlLoader,
                jsLoader,
                tsLoader,
            ],
            translators: [
                envTranslator,
                consulTranslator,
            ],
        })

        before(async () => {
            process.env.TEST_USERNAME = 'foobarwilly'
        })

        after(async () => {
            process.env.TEST_USERNAME = undefined
        })

        describe('get', () => {
            it('should return value stored in environment variable', async () => {
                return dynamicConfig.get<string>('database.username').then((actual: string) => {
                    expect(actual).to.equal('foobarwilly')
                })
            })

            it('should return the default for value missing in environment', async () => {
                return dynamicConfig.get<string>('database.password').then((actual: string) => {
                    expect(actual).to.equal('monkey')
                })
            })

            it('should fallback to returning from local config', async () => {
                return dynamicConfig.get<object>('project.health').then((actual: object) => {
                    expect(actual).to.equal({
                        control: '/typescript',
                        response: 'PASS',
                    })
                })
            })

            it('should reject for a missing key', async () => {
                return dynamicConfig.get<object>('fake.path').then((actual: object) => {
                    throw new Error('Should reject for missing key')
                }, (err: any) => {
                    expect(err.message).to.equal('Unable to find value for key[fake.path]')
                })
            })
        })

        describe('getSecretValue', () => {
            it('should reject when Vault not configured', async () => {
                return dynamicConfig.getSecretValue<string>('test-secret').then((actual: string) => {
                    throw new Error(`Unable to retrieve key[test-secret]. Should reject when Vault not configured`)
                }, (err: any) => {
                    expect(err.message).to.equal('Unable to retrieve key[test-secret]. No resolver found.')
                })
            })
        })
    })

    describe('When Using only default config', () => {
        const dynamicConfig: DynamicConfig = new DynamicConfig({
            configEnv: 'default',
            configPath: path.resolve(__dirname, './config'),
            resolvers: [
                envResolver(),
            ],
            loaders: [
                jsonLoader,
                ymlLoader,
                jsLoader,
                tsLoader,
            ],
            translators: [
                envTranslator,
                consulTranslator,
            ],
        })

        describe('get', () => {
            it('should return value stored in environment variable', async () => {
                return dynamicConfig.get<string>('project.health.response').then((actual: string) => {
                    expect(actual).to.equal('GOOD')
                })
            })

            it('should fetch value from default config', async () => {
                return dynamicConfig.get<string>('database.password').then((actual: string) => {
                    expect(actual).to.equal('root')
                })
            })
        })

        describe('getSecretValue', () => {
            it('should reject when Vault not configured', async () => {
                return dynamicConfig.getSecretValue<string>('test-secret').then((actual: string) => {
                    throw new Error(`Unable to retrieve key[test-secret]. Should reject when Vault not configured`)
                }, (err: any) => {
                    expect(err.message).to.equal('Unable to retrieve key[test-secret]. No resolver found.')
                })
            })
        })
    })

    describe('When Using Environment Variables with default config', () => {
        const dynamicConfig: DynamicConfig = new DynamicConfig({
            configEnv: 'default',
            configPath: path.resolve(__dirname, './config'),
            resolvers: [
                envResolver(),
            ],
            loaders: [
                jsonLoader,
                ymlLoader,
                jsLoader,
                tsLoader,
            ],
            translators: [
                envTranslator,
                consulTranslator,
            ],
        })

        before(async () => {
            process.env.HEALTH_RESPONSE = 'WHAM BAM!'
            process.env.TEST_USERNAME = 'foobarwilly'
        })

        after(async () => {
            process.env.HEALTH_RESPONSE = undefined
            process.env.TEST_USERNAME = undefined
        })

        describe('get', () => {
            it('should return value stored in environment variable', async () => {
                return dynamicConfig.get<string>('project.health.response').then((actual: string) => {
                    expect(actual).to.equal('WHAM BAM!')
                })
            })

            it('should fetch value from default config', async () => {
                return dynamicConfig.get<string>('database.password').then((actual: string) => {
                    expect(actual).to.equal('root')
                })
            })
        })

        describe('getSecretValue', () => {
            it('should reject when Vault not configured', async () => {
                return dynamicConfig.getSecretValue<string>('test-secret').then((actual: string) => {
                    throw new Error(`Unable to retrieve key[test-secret]. Should reject when Vault not configured`)
                }, (err: any) => {
                    expect(err.message).to.equal('Unable to retrieve key[test-secret]. No resolver found.')
                })
            })
        })
    })
})
