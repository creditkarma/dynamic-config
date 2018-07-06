import { Observer } from '@creditkarma/consul-client'
import { expect } from 'code'
import * as Lab from 'lab'

import {
    ConfigUtils,
} from '../../../main/utils'

import {
    ConfigValue,
    IRootConfigValue,
    SetFunction,
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
                                    observer: Observer.create(1),
                                    watcher: (key: string, value: any) => {},
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
                            observer: Observer.create(3),
                            watcher: (key: string, value: any) => {},
                        },
                    },
                    observer: Observer.create(4),
                    watcher: (key: string, value: any) => {},
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
                            observer: Observer.create(5),
                            watcher: (key: string, value: any) => {},
                        },
                    },
                    observer: null,
                    watcher: null,
                },
            },
            observer: Observer.create(6),
            watcher: (key: string, value: any) => {},
        }

        it('should return watchers for nested key', async () => {
            const actual: Array<SetFunction<any>> = collectWatchersForKey('project.health.control', mockConfig)

            expect(actual.length).to.equal(4)
        })

        it('should return watchers for root key', async () => {
            const actual: Array<SetFunction<any>> = collectWatchersForKey('', mockConfig)
            console.log('actual: ', actual)
            expect(actual.length).to.equal(1)
        })
    })
})
