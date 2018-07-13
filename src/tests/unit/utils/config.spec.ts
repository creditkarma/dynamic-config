import { expect } from 'code'
import * as Lab from 'lab'

import {
    ConfigBuilder,
    ConfigUtils,
} from '../../../main/utils'

import {
    BaseConfigValue,
    ConfigValue,
    IRootConfigValue,
    ISource,
} from '../../../main'

export const lab = Lab.script()

const describe = lab.describe
const it = lab.it
const before = lab.before

describe('ConfigUtils', () => {
    describe('getConfigForKey', () => {
        it('should get specified value from root config', async () => {
            const mockConfig: IRootConfigValue = {
                type: 'root',
                properties: {
                    project: {
                        source: {
                            type: 'local',
                            name: 'development',
                        },
                        type: 'object',
                        properties: {
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
                                        observer: null,
                                        watcher: null,
                                    },
                                    response: {
                                        source: {
                                            type: 'local',
                                            name: 'development',
                                        },
                                        type: 'string',
                                        value: 'PASS',
                                        observer: null,
                                        watcher: null,
                                    },
                                },
                                observer: null,
                                watcher: null,
                            },
                        },
                        observer: null,
                        watcher: null,
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
                                observer: null,
                                watcher: null,
                            },
                            password: {
                                source: {
                                    type: 'local',
                                    name: 'default',
                                },
                                type: 'string',
                                value: 'root',
                                observer: null,
                                watcher: null,
                            },
                        },
                        observer: null,
                        watcher: null,
                    },
                },
                observer: null,
                watcher: null,
            }

            const actual: ConfigValue | null = ConfigUtils.getConfigForKey('project.health', mockConfig)
            const expected: any = {
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
                        observer: null,
                        watcher: null,
                    },
                    response: {
                        source: {
                            type: 'local',
                            name: 'development',
                        },
                        type: 'string',
                        value: 'PASS',
                        observer: null,
                        watcher: null,
                    },
                },
                observer: null,
                watcher: null,
            }

            expect(actual).to.equal(expected)
        })
    })

    describe('setValueForKey', () => {
        const mockSource: ISource = {
            type: 'local',
            name: 'default',
        }
        let mockConfg: IRootConfigValue

        before(async () => {
            mockConfg = ConfigBuilder.createConfigObject(mockSource, {
                serviceName: 'test-service',
                database: {
                    username: 'root',
                    password: 'root',
                },
            })
        })

        it('should correctly set value for object', async () => {
            const newValue: BaseConfigValue = ConfigBuilder.buildBaseConfigValue(mockSource, 'fake-service')
            const newConfig: IRootConfigValue = ConfigUtils.setValueForKey('serviceName', newValue, mockConfg) as IRootConfigValue
            const baseValue = ConfigUtils.getConfigForKey('serviceName', newConfig)

            if (baseValue !== null) {
                const actual = ConfigUtils.readConfigValue(baseValue)
                expect(actual).to.equal('fake-service')

            } else {
                throw new Error('Config not found')
            }
        })

        it('should correctly set value for object with nested key', async () => {
            const newValue: BaseConfigValue = ConfigBuilder.buildBaseConfigValue(mockSource, '123456')
            const newConfig: IRootConfigValue = ConfigUtils.setValueForKey('database.username', newValue, mockConfg) as IRootConfigValue
            const baseValue = ConfigUtils.getConfigForKey('database.username', newConfig)

            if (baseValue !== null) {
                expect(ConfigUtils.readConfigValue(baseValue)).to.equal('123456')

            } else {
                throw new Error('Config not found')
            }
        })
    })
})
