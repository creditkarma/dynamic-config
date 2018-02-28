import { expect } from 'code'
import * as Lab from 'lab'
import {
    ConfigLoader,
    consulTranslator,
    envTranslator,
    IRootConfigValue,
    jsLoader,
    jsonLoader,
    tsLoader,
    ymlLoader,
} from '../../main/'

import {
    ConfigUtils,
} from '../../main/utils'

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

    describe('resolve', () => {
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
                translator: ConfigUtils.makeTranslator([
                    envTranslator,
                    consulTranslator,
                ]),
                loaders: [
                    jsonLoader,
                    ymlLoader,
                    jsLoader,
                    tsLoader,
                ],
            })
            const expected: IRootConfigValue = {
                type: 'root',
                properties: {
                    server: {
                        source: {
                            type: 'local',
                            name: 'default',
                        },
                        type: 'object',
                        properties: {
                            port: {
                                source: {
                                    type: 'local',
                                    name: 'default',
                                },
                                type: 'number',
                                value: 8000,
                                watchers: [],
                            },
                            host: {
                                source: {
                                    type: 'local',
                                    name: 'default',
                                },
                                type: 'string',
                                value: 'localhost',
                                watchers: [],
                            },
                        },
                        watchers: [],
                    },
                    project: {
                        source: {
                            type: 'local',
                            name: 'development',
                        },
                        type: 'object',
                        properties: {
                            id: {
                                source: {
                                    type: 'local',
                                    name: 'development',
                                },
                                type: 'object',
                                properties: {
                                    name: {
                                        source: {
                                            type: 'local',
                                            name: 'development',
                                        },
                                        type: 'string',
                                        value: 'yaml-project',
                                        watchers: [],
                                    },
                                    ref: {
                                        source: {
                                            type: 'local',
                                            name: 'development',
                                        },
                                        type: 'number',
                                        value: 123456,
                                        watchers: [],
                                    },
                                },
                                watchers: [],
                            },
                            health: {
                                source: {
                                    type: 'local',
                                    name: 'development',
                                },
                                type: 'object',
                                properties: {
                                    control: {
                                        source: {
                                            type: 'local',
                                            name: 'development',
                                        },
                                        type: 'string',
                                        value: '/javascript',
                                        watchers: [],
                                    },
                                    response: {
                                        source: {
                                            type: 'local',
                                            name: 'development',
                                        },
                                        type: 'string',
                                        value: 'BOOYA',
                                        watchers: [],
                                    },
                                },
                                watchers: [],
                            },
                        },
                        watchers: [],
                    },
                    database: {
                        source: {
                            type: 'local',
                            name: 'default',
                        },
                        type: 'object',
                        properties: {
                            username: {
                                source: {
                                    type: 'local',
                                    name: 'default',
                                },
                                type: 'string',
                                value: 'root',
                                watchers: [],
                            },
                            password: {
                                source: {
                                    type: 'local',
                                    name: 'default',
                                },
                                type: 'string',
                                value: 'root',
                                watchers: [],
                            },
                        },
                        watchers: [],
                    },
                },
            }

            return loader.resolve().then((actual: any) => {
                expect(actual).to.equal(expected)
            })
        })

        it('should return the correct config for production', async () => {
            process.env.NODE_ENV = 'production'
            const loader: ConfigLoader = new ConfigLoader({
                translator: ConfigUtils.makeTranslator([
                    envTranslator,
                    consulTranslator,
                ]),
                loaders: [
                    jsonLoader,
                    ymlLoader,
                    jsLoader,
                    tsLoader,
                ],
            })
            const expected: IRootConfigValue = {
                type: 'root',
                properties: {
                    server: {
                        source: {
                            type: 'local',
                            name: 'production',
                        },
                        type: 'object',
                        properties: {
                            port: {
                                source: {
                                    type: 'local',
                                    name: 'production',
                                },
                                type: 'number',
                                value: 9000,
                                watchers: [],
                            },
                            host: {
                                source: {
                                    type: 'local',
                                    name: 'production',
                                },
                                type: 'string',
                                value: 'localhost',
                                watchers: [],
                            },
                        },
                        watchers: [],
                    },
                    project: {
                        source: {
                            type: 'local',
                            name: 'production',
                        },
                        type: 'object',
                        properties: {
                            id: {
                                source: {
                                    type: 'local',
                                    name: 'default',
                                },
                                type: 'object',
                                properties: {
                                    name: {
                                        source: {
                                            type: 'local',
                                            name: 'default',
                                        },
                                        type: 'string',
                                        value: 'test-project',
                                        watchers: [],
                                    },
                                    ref: {
                                        source: {
                                            type: 'local',
                                            name: 'default',
                                        },
                                        type: 'number',
                                        value: 987860,
                                        watchers: [],
                                    },
                                },
                                watchers: [],
                            },
                            health: {
                                source: {
                                    type: 'local',
                                    name: 'production',
                                },
                                type: 'object',
                                properties: {
                                    control: {
                                        source: {
                                            type: 'local',
                                            name: 'production',
                                        },
                                        type: 'string',
                                        value: '/typescript',
                                        watchers: [],
                                    },
                                    response: {
                                        source: {
                                            type: 'local',
                                            name: 'production',
                                        },
                                        type: 'string',
                                        value: 'PASS',
                                        watchers: [],
                                    },
                                },
                                watchers: [],
                            },
                        },
                        watchers: [],
                    },
                    database: {
                        source: {
                            type: 'local',
                            name: 'production',
                        },
                        type: 'object',
                        properties: {
                            username: {
                                source: {
                                    type: 'local',
                                    name: 'production',
                                },
                                type: 'placeholder',
                                value: {
                                    _source: 'env',
                                    _key: 'TEST_USERNAME',
                                },
                                watchers: [],
                            },
                            password: {
                                source: {
                                    type: 'local',
                                    name: 'production',
                                },
                                type: 'placeholder',
                                value: {
                                    _source: 'env',
                                    _key: 'TEST_PASSWORD',
                                    _default: 'monkey',
                                },
                                watchers: [],
                            },
                        },
                        watchers: [],
                    },
                },
            }

            return loader.resolve().then((actual: any) => {
                expect(actual).to.equal(expected)
            })
        })

        it('should return the correct config for test', async () => {
            process.env.NODE_ENV = 'test'
            const loader: ConfigLoader = new ConfigLoader({
                translator: ConfigUtils.makeTranslator([
                    envTranslator,
                    consulTranslator,
                ]),
                loaders: [
                    jsonLoader,
                    ymlLoader,
                    jsLoader,
                    tsLoader,
                ],
            })
            const expected: IRootConfigValue = {
                type: 'root',
                properties: {
                    server: {
                        source: {
                            type: 'local',
                            name: 'default',
                        },
                        type: 'object',
                        properties: {
                            port: {
                                source: {
                                    type: 'local',
                                    name: 'default',
                                },
                                type: 'number',
                                value: 8000,
                                watchers: [],
                            },
                            host: {
                                source: {
                                    type: 'local',
                                    name: 'default',
                                },
                                type: 'string',
                                value: 'localhost',
                                watchers: [],
                            },
                        },
                        watchers: [],
                    },
                    project: {
                        source: {
                            type: 'local',
                            name: 'test',
                        },
                        type: 'object',
                        properties: {
                            id: {
                                source: {
                                    type: 'local',
                                    name: 'default',
                                },
                                type: 'object',
                                properties: {
                                    name: {
                                        source: {
                                            type: 'local',
                                            name: 'default',
                                        },
                                        type: 'string',
                                        value: 'test-project',
                                        watchers: [],
                                    },
                                    ref: {
                                        source: {
                                            type: 'local',
                                            name: 'default',
                                        },
                                        type: 'number',
                                        value: 987860,
                                        watchers: [],
                                    },
                                },
                                watchers: [],
                            },
                            health: {
                                source: {
                                    type: 'local',
                                    name: 'test',
                                },
                                type: 'object',
                                properties: {
                                    control: {
                                        source: {
                                            type: 'local',
                                            name: 'test',
                                        },
                                        type: 'string',
                                        value: '/test',
                                        watchers: [],
                                    },
                                    response: {
                                        source: {
                                            type: 'local',
                                            name: 'test',
                                        },
                                        type: 'string',
                                        value: 'PASS',
                                        watchers: [],
                                    },
                                },
                                watchers: [],
                            },
                        },
                        watchers: [],
                    },
                    database: {
                        source: {
                            type: 'local',
                            name: 'default',
                        },
                        type: 'object',
                        properties: {
                            username: {
                                source: {
                                    type: 'local',
                                    name: 'default',
                                },
                                type: 'string',
                                value: 'root',
                                watchers: [],
                            },
                            password: {
                                source: {
                                    type: 'local',
                                    name: 'default',
                                },
                                type: 'string',
                                value: 'root',
                                watchers: [],
                            },
                        },
                        watchers: [],
                    },
                },
            }

            return loader.resolve().then((actual: any) => {
                expect(actual).to.equal(expected)
            })
        })

        it('should only load default config if file for NODE_ENV does not exist', async () => {
            process.env.NODE_ENV = 'integration'
            const loader: ConfigLoader = new ConfigLoader({
                translator: ConfigUtils.makeTranslator([
                    envTranslator,
                    consulTranslator,
                ]),
                loaders: [
                    jsonLoader,
                    ymlLoader,
                    jsLoader,
                    tsLoader,
                ],
            })
            const expected: IRootConfigValue = {
                type: 'root',
                properties: {
                    server: {
                        source: {
                            type: 'local',
                            name: 'default',
                        },
                        type: 'object',
                        properties: {
                            port: {
                                source: {
                                    type: 'local',
                                    name: 'default',
                                },
                                type: 'number',
                                value: 8000,
                                watchers: [],
                            },
                            host: {
                                source: {
                                    type: 'local',
                                    name: 'default',
                                },
                                type: 'string',
                                value: 'localhost',
                                watchers: [],
                            },
                        },
                        watchers: [],
                    },
                    project: {
                        source: {
                            type: 'local',
                            name: 'default',
                        },
                        type: 'object',
                        properties: {
                            id: {
                                source: {
                                    type: 'local',
                                    name: 'default',
                                },
                                type: 'object',
                                properties: {
                                    name: {
                                        source: {
                                            type: 'local',
                                            name: 'default',
                                        },
                                        type: 'string',
                                        value: 'test-project',
                                        watchers: [],
                                    },
                                    ref: {
                                        source: {
                                            type: 'local',
                                            name: 'default',
                                        },
                                        type: 'number',
                                        value: 987860,
                                        watchers: [],
                                    },
                                },
                                watchers: [],
                            },
                            health: {
                                source: {
                                    type: 'local',
                                    name: 'default',
                                },
                                type: 'object',
                                properties: {
                                    control: {
                                        source: {
                                            type: 'local',
                                            name: 'default',
                                        },
                                        type: 'string',
                                        value: '/check',
                                        watchers: [],
                                    },
                                    response: {
                                        source: {
                                            type: 'local',
                                            name: 'default',
                                        },
                                        type: 'string',
                                        value: 'GOOD',
                                        watchers: [],
                                    },
                                },
                                watchers: [],
                            },
                        },
                        watchers: [],
                    },
                    database: {
                        source: {
                            type: 'local',
                            name: 'default',
                        },
                        type: 'object',
                        properties: {
                            username: {
                                source: {
                                    type: 'local',
                                    name: 'default',
                                },
                                type: 'string',
                                value: 'root',
                                watchers: [],
                            },
                            password: {
                                source: {
                                    type: 'local',
                                    name: 'default',
                                },
                                type: 'string',
                                value: 'root',
                                watchers: [],
                            },
                        },
                        watchers: [],
                    },
                },
            }

            return loader.resolve().then((actual: any) => {
                expect(actual).to.equal(expected)
            })
        })

        it('should default to loading development config', async () => {
            process.env.NODE_ENV = ''
            const loader: ConfigLoader = new ConfigLoader({
                translator: ConfigUtils.makeTranslator([
                    envTranslator,
                    consulTranslator,
                ]),
                loaders: [
                    jsonLoader,
                    ymlLoader,
                    jsLoader,
                    tsLoader,
                ],
            })
            const expected: IRootConfigValue = {
                type: 'root',
                properties: {
                    server: {
                        source: {
                            type: 'local',
                            name: 'default',
                        },
                        type: 'object',
                        properties: {
                            port: {
                                source: {
                                    type: 'local',
                                    name: 'default',
                                },
                                type: 'number',
                                value: 8000,
                                watchers: [],
                            },
                            host: {
                                source: {
                                    type: 'local',
                                    name: 'default',
                                },
                                type: 'string',
                                value: 'localhost',
                                watchers: [],
                            },
                        },
                        watchers: [],
                    },
                    project: {
                        source: {
                            type: 'local',
                            name: 'development',
                        },
                        type: 'object',
                        properties: {
                            id: {
                                source: {
                                    type: 'local',
                                    name: 'development',
                                },
                                type: 'object',
                                properties: {
                                    name: {
                                        source: {
                                            type: 'local',
                                            name: 'development',
                                        },
                                        type: 'string',
                                        value: 'yaml-project',
                                        watchers: [],
                                    },
                                    ref: {
                                        source: {
                                            type: 'local',
                                            name: 'development',
                                        },
                                        type: 'number',
                                        value: 123456,
                                        watchers: [],
                                    },
                                },
                                watchers: [],
                            },
                            health: {
                                source: {
                                    type: 'local',
                                    name: 'development',
                                },
                                type: 'object',
                                properties: {
                                    control: {
                                        source: {
                                            type: 'local',
                                            name: 'development',
                                        },
                                        type: 'string',
                                        value: '/javascript',
                                        watchers: [],
                                    },
                                    response: {
                                        source: {
                                            type: 'local',
                                            name: 'development',
                                        },
                                        type: 'string',
                                        value: 'BOOYA',
                                        watchers: [],
                                    },
                                },
                                watchers: [],
                            },
                        },
                        watchers: [],
                    },
                    database: {
                        source: {
                            type: 'local',
                            name: 'default',
                        },
                        type: 'object',
                        properties: {
                            username: {
                                source: {
                                    type: 'local',
                                    name: 'default',
                                },
                                type: 'string',
                                value: 'root',
                                watchers: [],
                            },
                            password: {
                                source: {
                                    type: 'local',
                                    name: 'default',
                                },
                                type: 'string',
                                value: 'root',
                                watchers: [],
                            },
                        },
                        watchers: [],
                    },
                },
            }

            return loader.resolve().then((actual: any) => {
                expect(actual).to.equal(expected)
            })
        })
    })
})
