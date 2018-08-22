import { expect } from 'code'
import * as Lab from 'lab'
import {
    ConfigLoader,
    jsLoader,
    jsonLoader,
    tsLoader,
    ymlLoader,
} from '../../main/'

export const lab = Lab.script()

const describe = lab.describe
const it = lab.it
const before = lab.before
const beforeEach = lab.beforeEach
const afterEach = lab.afterEach

describe('ConfigLoader', () => {

    before(async () => {
        process.chdir(__dirname)
    })

    describe('loadDefault', () => {
        let savedEnv: string | undefined

        beforeEach(async () => {
            savedEnv = process.env.NODE_ENV
        })

        afterEach(async () => {
            process.env.NODE_ENV = savedEnv
        })

        it('should return the correct config for development', async () => {
            process.env.NODE_ENV = 'development'
            const loader: ConfigLoader = new ConfigLoader({
                loaders: [
                    jsonLoader,
                    ymlLoader,
                    jsLoader,
                    tsLoader,
                ],
            })
            const expected: object = {
                name: 'default',
                config: {
                    project: {
                        id: {
                            name: 'test-project',
                            ref: 987860,
                        },
                        health: {
                            control: '/check',
                            response: {
                                _source: 'env',
                                _key: 'HEALTH_RESPONSE',
                                _default: 'GOOD',
                            },
                        },
                    },
                    server: {
                        port: 8000,
                        host: 'localhost',
                    },
                    database: {
                        username: 'root',
                        password: 'root',
                    },
                    names: {
                        first: [ 'Bob', 'Helen', 'Joe', 'Jane' ],
                        last: [ 'Smith', 'Warren', 'Malick' ],
                    },
                    'test-service': {
                        destination: '${HOST_NAME||localhost}:8080',
                    },
                },
            }

            return loader.loadDefault().then((actual: any) => {
                expect(actual).to.equal(expected)
            })
        })
    })

    describe('loadEnvironment', () => {
        let savedEnv: string | undefined

        beforeEach(async () => {
            savedEnv = process.env.NODE_ENV
        })

        afterEach(async () => {
            process.env.NODE_ENV = savedEnv
        })

        it('should return the correct config for development', async () => {
            process.env.NODE_ENV = 'development'
            const loader: ConfigLoader = new ConfigLoader({
                loaders: [
                    jsonLoader,
                    ymlLoader,
                    jsLoader,
                    tsLoader,
                ],
            })
            const expected: object = {
                name: 'development',
                config: {
                    project: {
                        health: {
                            control: '/javascript',
                            response: 'BOOYA',
                        },
                        id: {
                            name: 'yaml-project',
                            ref: 123456,
                        },
                    },
                    'test-service': {
                        destination: 'consul!/test-service?dc=dc1',
                    },
                },
            }

            return loader.loadEnvironment().then((actual: any) => {
                expect(actual).to.equal(expected)
            })
        })
    })

    describe('NODE_CONFIG_DIR', () => {
        let savedEnv: string | undefined

        beforeEach(async () => {
            savedEnv = process.env.NODE_ENV
        })

        afterEach(async () => {
            process.env.NODE_ENV = savedEnv
        })

        it('should return config from the correct directory', async () => {
            process.env.NODE_CONFIG_DIR = 'nested/config'
            const loader: ConfigLoader = new ConfigLoader({
                loaders: [
                    jsonLoader,
                ],
            })
            const expected: object = {
                name: 'default',
                config: {
                    foo: 'nested-bar',
                },
            }

            return loader.loadDefault().then((actual: any) => {
                expect(actual).to.equal(expected)
            })
        })
    })

    describe('CONFIG_PATH', () => {
        let savedEnv: string | undefined

        beforeEach(async () => {
            savedEnv = process.env.NODE_ENV
        })

        afterEach(async () => {
            process.env.NODE_ENV = savedEnv
        })

        it('should return config from the correct directory', async () => {
            process.env.CONFIG_PATH = 'nested/config'
            const loader: ConfigLoader = new ConfigLoader({
                loaders: [
                    jsonLoader,
                ],
            })
            const expected: object = {
                name: 'default',
                config: {
                    foo: 'nested-bar',
                },
            }

            return loader.loadDefault().then((actual: any) => {
                expect(actual).to.equal(expected)
            })
        })
    })
})
