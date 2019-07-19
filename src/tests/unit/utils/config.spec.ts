import { expect } from '@hapi/code'
import * as Lab from '@hapi/lab'

import { ConfigBuilder, ConfigUtils } from '../../../main/utils'

import {
    BaseConfigValue,
    ConfigValue,
    IRootConfigValue,
    ISource,
} from '../../../main/types'

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
                                        watcher: null,
                                        nullable: false,
                                    },
                                    response: {
                                        source: {
                                            type: 'local',
                                            name: 'development',
                                        },
                                        type: 'string',
                                        value: 'PASS',
                                        watcher: null,
                                        nullable: false,
                                    },
                                },
                                watcher: null,
                                nullable: false,
                            },
                        },
                        watcher: null,
                        nullable: false,
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
                                watcher: null,
                                nullable: false,
                            },
                            password: {
                                source: {
                                    type: 'local',
                                    name: 'default',
                                },
                                type: 'string',
                                value: 'root',
                                watcher: null,
                                nullable: false,
                            },
                        },
                        watcher: null,
                        nullable: false,
                    },
                },
                watcher: null,
            }

            const actual: ConfigValue | null = ConfigUtils.getConfigForKey(
                'project.health',
                mockConfig,
            )
            const expected: ConfigValue = {
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
                        watcher: null,
                        nullable: false,
                    },
                    response: {
                        source: {
                            type: 'local',
                            name: 'development',
                        },
                        type: 'string',
                        value: 'PASS',
                        watcher: null,
                        nullable: false,
                    },
                },
                watcher: null,
                nullable: false,
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
                'shard-info': {
                    'shard-count': 4,
                    'shard-map': [
                        {
                            'virtual-start': 0,
                            'virtual-end': 3,
                            destination: 'localhost:4141',
                        },
                    ],
                },
            })
        })

        it('should correctly set value for object', async () => {
            const newValue: BaseConfigValue = ConfigBuilder.buildBaseConfigValue(
                mockSource,
                'fake-service',
            )
            const newConfig: IRootConfigValue = ConfigUtils.setValueForKey(
                'serviceName',
                newValue,
                mockConfg,
            ) as IRootConfigValue
            const baseValue = ConfigUtils.getConfigForKey(
                'serviceName',
                newConfig,
            )

            if (baseValue !== null) {
                const actual = ConfigUtils.readConfigValue(baseValue)
                expect(actual).to.equal('fake-service')
            } else {
                throw new Error('Config not found')
            }
        })

        it('should correctly set value for object with nested key', async () => {
            const newValue: BaseConfigValue = ConfigBuilder.buildBaseConfigValue(
                mockSource,
                '123456',
            )
            const newConfig: IRootConfigValue = ConfigUtils.setValueForKey(
                'database.username',
                newValue,
                mockConfg,
            ) as IRootConfigValue
            const baseValue = ConfigUtils.getConfigForKey(
                'database.username',
                newConfig,
            )

            if (baseValue !== null) {
                expect(ConfigUtils.readConfigValue(baseValue)).to.equal(
                    '123456',
                )
            } else {
                throw new Error('Config not found')
            }
        })

        it('should correctly set value for object with nested key', async () => {
            const newValue: BaseConfigValue = ConfigBuilder.buildBaseConfigValue(
                mockSource,
                '123456',
            )
            const newConfig: IRootConfigValue = ConfigUtils.setValueForKey(
                'database.username',
                newValue,
                mockConfg,
            ) as IRootConfigValue
            const baseValue = ConfigUtils.getConfigForKey(
                'database.username',
                newConfig,
            )

            if (baseValue !== null) {
                expect(ConfigUtils.readConfigValue(baseValue)).to.equal(
                    '123456',
                )
            } else {
                throw new Error('Config not found')
            }
        })
    })

    describe('readConfigValue', () => {
        const mockConfig: IRootConfigValue = {
            type: 'root',
            properties: {
                'shard-map': {
                    source: {
                        type: 'local',
                        name: 'test',
                    },
                    type: 'array',
                    items: [
                        {
                            source: {
                                type: 'local',
                                name: 'test',
                            },
                            type: 'object',
                            properties: {
                                'virtual-start': {
                                    source: {
                                        type: 'local',
                                        name: 'test',
                                    },
                                    type: 'number',
                                    value: 0,
                                    watcher: null,
                                    nullable: false,
                                },
                                'virtual-end': {
                                    source: {
                                        type: 'local',
                                        name: 'test',
                                    },
                                    type: 'number',
                                    value: 3,
                                    watcher: null,
                                    nullable: false,
                                },
                                destination: {
                                    source: {
                                        type: 'local',
                                        name: 'test',
                                    },
                                    type: 'string',
                                    value: 'localhost:4141',
                                    watcher: null,
                                    nullable: false,
                                },
                            },
                            watcher: null,
                            nullable: false,
                        },
                    ],
                    watcher: null,
                    nullable: false,
                },
            },
            watcher: null,
        }

        const configValue: BaseConfigValue | null = ConfigUtils.getConfigForKey(
            'shard-map',
            mockConfig,
        )

        if (configValue !== null) {
            const actual: any = ConfigUtils.readConfigValue(configValue)

            const expected: any = [
                {
                    'virtual-start': 0,
                    'virtual-end': 3,
                    destination: 'localhost:4141',
                },
            ]

            expect(actual).to.equal(expected)
        } else {
            throw new Error('Unable to read config value')
        }
    })
})
