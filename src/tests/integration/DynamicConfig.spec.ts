import { Catalog, KvStore } from '@creditkarma/consul-client'
import { expect } from 'code'
import * as Lab from 'lab'
import * as path from 'path'

import {
    consulResolver,
    consulTranslator,
    DynamicConfig,
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
            resolvers: {
                remote: consulResolver(),
                secret: vaultResolver(),
            },
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
            process.env.NOT_NULLABLE = 'NOT_NULLABLE'
        })

        after(async () => {
            delete process.env.NOT_NULLABLE
        })

        describe('get', () => {
            it('should return full config when making empty call to get', async () => {
                return dynamicConfig.get().then((actual: any) => {
                    expect(actual).to.equal({
                        nullable_test: {
                            nullable: null,
                            not_nullable: 'NOT_NULLABLE',
                        },
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
                        'shard-info': {
                            'shard-count': 4,
                            'shard-map': [
                                {
                                    destination: '127.0.0.1:3000',
                                    'virtual-end': 3,
                                    'virtual-start': 0,
                                },
                            ],
                        },
                    })
                })
            })

            it('should recursively resolve consul values', async () => {
                return dynamicConfig.get('shard-info').then((actual: any) => {
                    const expected = {
                        'shard-count': 4,
                        'shard-map': [
                            {
                                destination: '127.0.0.1:3000',
                                'virtual-end': 3,
                                'virtual-start': 0,
                            },
                        ],
                    }

                    expect(actual).to.equal(expected)
                })
            })

            it('should get value at array index', async () => {
                return dynamicConfig.get('shard-info.shard-map[0]').then((actual: any) => {
                    const expected = {
                        destination: '127.0.0.1:3000',
                        'virtual-end': 3,
                        'virtual-start': 0,
                    }

                    expect(actual).to.equal(expected)
                })
            })

            it('should return null for a nullable key', async () => {
                return dynamicConfig.get<null>('nullable_test.nullable').then((actual: null) => {
                    expect(actual).to.equal(null)
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
                    expect(err.message).to.equal('Unable to find value for key[fake.path].')
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
                    expect(err.message).to.equal('Unable to find value for key[database.fake].')
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
                    expect(err.message).to.equal('Unable to find value for key[missing-secret].')
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
            resolvers: {
                remote: consulResolver(),
                secret: vaultResolver(),
            },
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

        const kvStore = new KvStore('http://localhost:8510')
        const catalog = new Catalog('http://localhost:8510')

        before(async () => {
            process.env.NOT_NULLABLE = 'NOT_NULLABLE'
        })

        after(async () => {
            delete process.env.NOT_NULLABLE
        })

        describe('watch', () => {
            it('should return an observer for requested key', (done) => {
                const password = dynamicConfig.watch('database.password')
                let count: number = 0
                password.onValue((next: string) => {
                    if (count === 0) {
                        expect(next).to.equal('Sup3rS3cr3t')
                        count += 1
                        kvStore.set({ path: 'password', dc: 'dc1' }, '123456')

                    } else if (count === 1) {
                        expect(next).to.equal('123456')
                        count += 1
                        kvStore.set({ path: 'password', dc: 'dc1' }, 'Sup3rS3cr3t')

                    } else if (count === 2) {
                        expect(next).to.equal('Sup3rS3cr3t')
                        count += 1
                        done()
                    }
                })
            })

            it('should be able to watch for changes to service address', (done) => {
                const address = dynamicConfig.watch('test-service.destination')
                let count: number = 0
                address.onValue((next: string) => {
                    if (count === 0) {
                        expect(next).to.equal('127.0.0.1:3000')
                        count += 1
                        catalog.registerEntity({
                            Node: 'bango',
                            Address: '192.168.4.19',
                            Service: {
                                Service: 'test-service',
                                Address: '192.145.3.12',
                                Port: 3000,
                            },
                        })

                    } else if (count === 1) {
                        expect(next).to.equal('192.145.3.12:3000')
                        count += 1
                        catalog.registerEntity({
                            Node: 'bango',
                            Address: '192.168.4.19',
                            Service: {
                                Service: 'test-service',
                                Address: '127.0.0.1',
                                Port: 3000,
                            },
                        })

                    } else if (count === 2) {
                        expect(next).to.equal('127.0.0.1:3000')
                        count += 1
                        done()
                    }
                })
            })

            it('should correctly watch a value in an array', (done) => {
                const address = dynamicConfig.watch('shard-info.shard-map[0].destination')
                let count: number = 0
                address.onValue((next: string) => {
                    if (count === 0) {
                        expect(next).to.equal('127.0.0.1:3000')
                        count += 1
                        catalog.registerEntity({
                            Node: 'bango',
                            Address: '192.168.4.19',
                            Service: {
                                Service: 'shard-map-host',
                                Address: '195.145.2.15',
                                Port: 3000,
                            },
                        })

                    } else if (count === 1) {
                        expect(next).to.equal('195.145.2.15:3000')
                        count += 1
                        catalog.registerEntity({
                            Node: 'bango',
                            Address: '192.168.4.19',
                            Service: {
                                Service: 'shard-map-host',
                                Address: '127.0.0.1',
                                Port: 3000,
                            },
                        })

                    } else if (count === 2) {
                        expect(next).to.equal('127.0.0.1:3000')
                        count += 1
                        done()
                    }
                })
            })
        })

        describe('get', () => {
            it('should return full config when making empty call to get', async () => {
                return dynamicConfig.get<string>().then((actual: any) => {
                    expect(actual).to.equal({
                        nullable_test: {
                            nullable: null,
                            not_nullable: 'NOT_NULLABLE',
                        },
                        version: '2.0.1',
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
                        'shard-info': {
                            'shard-count': 4,
                            'shard-map': [
                                {
                                    destination: '127.0.0.1:3000',
                                    'virtual-end': 3,
                                    'virtual-start': 0,
                                },
                            ],
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
                        nullable_test: {
                            nullable: null,
                            not_nullable: 'NOT_NULLABLE',
                        },
                        version: '2.0.1',
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
                        'shard-info': {
                            'shard-count': 4,
                            'shard-map': [
                                {
                                    destination: '127.0.0.1:3000',
                                    'virtual-end': 3,
                                    'virtual-start': 0,
                                },
                            ],
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
                    expect(err.message).to.equal('Unable to find value for key[fake.path].')
                })
            })
        })

        describe('watch', () => {
            it('should return an observer for requested key', (done) => {
                const password = dynamicConfig.watch('database.password')
                let count: number = 0
                password.onValue((next: string) => {
                    if (count === 0) {
                        expect(next).to.equal('Sup3rS3cr3t')
                        count += 1
                        kvStore.set({ path: 'password', dc: 'dc1' }, '123456')

                    } else if (count === 1) {
                        expect(next).to.equal('123456')
                        count += 1
                        kvStore.set({ path: 'password', dc: 'dc1' }, 'Sup3rS3cr3t')

                    } else if (count === 2) {
                        expect(next).to.equal('Sup3rS3cr3t')
                        count += 1
                        done()
                    }
                })
            })
        })
    })

    describe('Configured with Overlayed Consul Configs', () => {
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
            resolvers: {
                remote: consulResolver(),
                secret: vaultResolver(),
            },
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
            process.env.NOT_NULLABLE = 'NOT_NULLABLE'
        })

        after(async () => {
            delete process.env.NOT_NULLABLE
        })

        describe('get', () => {
            it('should return full config when making empty call to get', async () => {
                return dynamicConfig.get<string>().then((actual: any) => {
                    expect(actual).to.equal({
                        nullable_test: {
                            nullable: null,
                            not_nullable: 'NOT_NULLABLE',
                        },
                        version: '2.0.1',
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
                        'shard-info': {
                            'shard-count': 4,
                            'shard-map': [
                                {
                                    destination: '127.0.0.1:3000',
                                    'virtual-end': 3,
                                    'virtual-start': 0,
                                },
                            ],
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

        before(async () => {
            process.env.NOT_NULLABLE = 'NOT_NULLABLE'
        })

        after(async () => {
            delete process.env.NOT_NULLABLE
        })

        describe('get', () => {
            it('should reject when config uses consul', async () => {
                return dynamicConfig.get<string>('database.username').then((actual: string) => {
                    throw new Error('Should reject')
                }, (err: any) => {
                    expect(err.message).to.equal('Unable to retrieve key[test-service?dc=dc1]. No resolver found.')
                })
            })

            it('should reject with same error for next requested key', async () => {
                return dynamicConfig.get<object>('project.health').then((actual: object) => {
                    throw new Error('Should reject')
                }, (err: any) => {
                    expect(err.message).to.equal('Unable to retrieve key[test-service?dc=dc1]. No resolver found.')
                })
            })

            it('should reject for a missing key', async () => {
                return dynamicConfig.get<object>('fake.path').then((actual: object) => {
                    throw new Error('Should reject')
                }, (err: any) => {
                    expect(err.message).to.equal('Unable to retrieve key[test-service?dc=dc1]. No resolver found.')
                })
            })

            it('should reject if the value does not match specified schema', async () => {
                return dynamicConfig.get<object>('database').then((actual: object) => {
                    throw new Error('Should reject')
                }, (err: any) => {
                    expect(err.message).to.equal('Unable to retrieve key[test-service?dc=dc1]. No resolver found.')
                })
            })
        })

        describe('getSecretValue', () => {
            it('should reject when Vault not configured', async () => {
                return dynamicConfig.getSecretValue<string>('test-secret').then((actual: string) => {
                    throw new Error('Should reject')
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
            process.env.NOT_NULLABLE = 'NOT_NULLABLE'
            process.env.TEST_USERNAME = 'foobarwilly'
            process.env.HOST_NAME = 'testmyhost'
        })

        after(async () => {
            delete process.env.TEST_USERNAME
            delete process.env.HOST_NAME
            delete process.env.NOT_NULLABLE
        })

        describe('get', () => {
            it('should return value stored in environment variable', async () => {
                return dynamicConfig.get<string>('database.username').then((actual: string) => {
                    expect(actual).to.equal('foobarwilly')
                })
            })

            it('should return value stored in environment variable when providing default', async () => {
                return dynamicConfig.get<string>('test-service.destination').then((actual: string) => {
                    expect(actual).to.equal('http://testmyhost:8080')
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
                    expect(err.message).to.equal('Unable to find value for key[fake.path].')
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

    describe('When Using Missing Environment Variables', () => {
        const dynamicConfig: DynamicConfig = new DynamicConfig({
            configEnv: 'production',
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
        })

        describe('get', () => {
            it('should reject with empty call to get if any errors exist', async () => {
                return dynamicConfig.get().then((val: any) => {
                    throw new Error('Should reject')
                }, (err: any) => {
                    expect(err.message).to.equal(`Environment variable 'NOT_NULLABLE' not set.`)
                })
            })

            it('should reject for missing non-nullable keys', async () => {
                return dynamicConfig.get<null>('nullable_test.not_nullable').then((actual: null) => {
                    throw new Error('Should reject')
                }, (err: any) => {
                    expect(err.message).to.equal(`Environment variable 'NOT_NULLABLE' not set.`)
                })
            })

            it('should resolve to null for nullable key that is not defined', async () => {
                return dynamicConfig.get<null>('nullable_test.nullable').then((actual: null) => {
                    expect(actual).to.equal(null)
                })
            })

            it('should reject for object containing errors', async () => {
                return dynamicConfig.get<null>('nullable_test').then((actual: null) => {
                    throw new Error('Should reject')
                }, (err: any) => {
                    expect(err.message).to.equal(`Environment variable 'NOT_NULLABLE' not set.`)
                })
            })

            it('should reject if unable to resolve environment variable', async () => {
                return dynamicConfig.get<string>('database.username').then((actual: string) => {
                    throw new Error(`Should  reject`)
                }, (err: any) => {
                    expect(err.message).to.equal(`Environment variable 'TEST_USERNAME' not set.`)
                })
            })

            it('should return the default for value missing in environment', async () => {
                return dynamicConfig.get<string>('database.password').then((actual: string) => {
                    expect(actual).to.equal('monkey')
                })
            })
        })
    })

    describe('When Using only default config', () => {
        const dynamicConfig: DynamicConfig = new DynamicConfig({
            configEnv: 'default',
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
        })

        before(async () => {
            process.env.NOT_NULLABLE = 'NOT_NULLABLE'
        })

        after(async () => {
            delete process.env.NOT_NULLABLE
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
            process.env.NOT_NULLABLE = 'NOT_NULLABLE'
            process.env.HEALTH_RESPONSE = 'WHAM BAM!'
            process.env.TEST_USERNAME = 'foobarwilly'
        })

        after(async () => {
            delete process.env.NOT_NULLABLE
            delete process.env.HEALTH_RESPONSE
            delete process.env.TEST_USERNAME
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
