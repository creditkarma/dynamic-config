import { Observer } from '@creditkarma/consul-client'
import { expect } from 'code'
import * as Lab from 'lab'

import {
    ConfigUtils,
} from '../../../main/utils'

import {
    ConfigValue,
    IRootConfigValue,
} from '../../../main'
import { collectWatchersForKey } from '../../../main/utils/config'

export const lab = Lab.script()

const describe = lab.describe
const it = lab.it

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
                                        watchers: [],
                                    },
                                    response: {
                                        source: {
                                            type: 'local',
                                            name: 'development',
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
                watchers: [],
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
                        watchers: [],
                    },
                    response: {
                        source: {
                            type: 'local',
                            name: 'development',
                        },
                        type: 'string',
                        value: 'PASS',
                        watchers: [],
                    },
                },
                watchers: [],
            }

            expect(actual).to.equal(expected)
        })
    })

    describe('collectWatchersForKey', () => {
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
                                    watchers: [
                                        new Observer(1),
                                        new Observer(2),
                                    ],
                                },
                                response: {
                                    source: {
                                        type: 'local',
                                        name: 'development',
                                    },
                                    type: 'string',
                                    value: 'PASS',
                                    watchers: [],
                                },
                            },
                            watchers: [
                                new Observer(3),
                            ],
                        },
                    },
                    watchers: [
                        new Observer(4),
                    ],
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
                            watchers: [
                                new Observer(5),
                            ],
                        },
                    },
                    watchers: [],
                },
            },
            watchers: [
                new Observer(6),
            ],
        }

        it('should return watchers for nested key', async () => {
            const actual: Array<Observer<any>> = collectWatchersForKey('project.health.control', mockConfig)

            expect(actual.length).to.equal(5)
        })

        it('should return watchers for nested key', async () => {
            const actual: Array<Observer<any>> = collectWatchersForKey('', mockConfig)

            expect(actual.length).to.equal(1)
        })
    })
})
