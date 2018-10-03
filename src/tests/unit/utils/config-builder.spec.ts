import { expect } from 'code'
import * as Lab from 'lab'

import {
    IRootConfigValue,
} from '../../../main/types'

import {
    ConfigBuilder,
} from '../../../main/utils'

export const lab = Lab.script()

const describe = lab.describe
const it = lab.it

describe('ConfigBuilder', () => {
    describe('createConfigObject', () => {
        it('should build config for object', async () => {
            const actual: IRootConfigValue = ConfigBuilder.createConfigObject({
                type: 'local',
                name: 'test',
            }, {
                protocol: 'https',
                destination: '127.0.0.1:9000',
                hostHeader: 'hvault.com',
                sslValidation: false,
                namespace: '/your-group/your-service',
                tokenPath: '/tmp/test-token',
            })

            const expected: IRootConfigValue = {
                type: 'root',
                properties: {
                    protocol: {
                        source: {
                            type: 'local',
                            name: 'test',
                        },
                        type: 'string',
                        value: 'https',
                        watcher: null,
                        nullable: false,
                    },
                    destination: {
                        source: {
                            type: 'local',
                            name: 'test',
                        },
                        type: 'string',
                        value: '127.0.0.1:9000',
                        watcher: null,
                        nullable: false,
                    },
                    hostHeader: {
                        source: {
                            type: 'local',
                            name: 'test',
                        },
                        type: 'string',
                        value: 'hvault.com',
                        watcher: null,
                        nullable: false,
                    },
                    sslValidation: {
                        source: {
                            type: 'local',
                            name: 'test',
                        },
                        type: 'boolean',
                        value: false,
                        watcher: null,
                        nullable: false,
                    },
                    namespace: {
                        source: {
                            type: 'local',
                            name: 'test',
                        },
                        type: 'string',
                        value: '/your-group/your-service',
                        watcher: null,
                        nullable: false,
                    },
                    tokenPath: {
                        source: {
                            type: 'local',
                            name: 'test',
                        },
                        type: 'string',
                        value: '/tmp/test-token',
                        watcher: null,
                        nullable: false,
                    },
                },
                watcher: null,
            }

            expect(actual).to.equal(expected)
        })

        it('should build config for an array', async () => {
            const actual: IRootConfigValue = ConfigBuilder.createConfigObject({
                type: 'local',
                name: 'test',
            }, {
                'shard-map': [
                    {
                        'virtual-start': 0,
                        'virtual-end': 3,
                        destination: 'localhost:4141',
                    },
                ],
            })

            const expected: IRootConfigValue = {
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

            expect(actual).to.equal(expected)
        })

        it('should build config with nested keys', async () => {
            const actual: IRootConfigValue = ConfigBuilder.createConfigObject({
                type: 'local',
                name: 'test',
            }, {
                server: {
                    host: 'localhost',
                    port: 8080,
                },
            })

            const expected: IRootConfigValue = {
                type: 'root',
                properties: {
                    server: {
                        source: {
                            type: 'local',
                            name: 'test',
                        },
                        type: 'object',
                        properties: {
                            host: {
                                source: {
                                    type: 'local',
                                    name: 'test',
                                },
                                type: 'string',
                                value: 'localhost',
                                watcher: null,
                                nullable: false,
                            },
                            port: {
                                source: {
                                    type: 'local',
                                    name: 'test',
                                },
                                type: 'number',
                                value: 8080,
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

            expect(actual).to.equal(expected)
        })

        it('should build config with promised values', async () => {
            const actual: IRootConfigValue = ConfigBuilder.createConfigObject({
                type: 'local',
                name: 'test',
            }, {
                server: {
                    host: Promise.resolve('localhost'),
                    port: Promise.resolve(8080),
                },
            })

            const expected: IRootConfigValue = {
                type: 'root',
                properties: {
                    server: {
                        source: {
                            type: 'local',
                            name: 'test',
                        },
                        type: 'object',
                        properties: {
                            host: {
                                source: {
                                    type: 'local',
                                    name: 'test',
                                },
                                type: 'promise',
                                value: Promise.resolve('localhost'),
                                watcher: null,
                                nullable: false,
                            },
                            port: {
                                source: {
                                    type: 'local',
                                    name: 'test',
                                },
                                type: 'promise',
                                value: Promise.resolve(8080),
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

            expect(actual).to.equal(expected)
        })

        it('should build config with placeholder values', async () => {
            const actual: IRootConfigValue = ConfigBuilder.createConfigObject({
                type: 'local',
                name: 'test',
            }, {
                server: {
                    host: {
                        _source: 'consul',
                        _key: 'host-name',
                    },
                    port: {
                        _source: 'consul',
                        _key: 'port-number',
                        _default: 8080,
                    },
                },
            })

            const expected: IRootConfigValue = {
                type: 'root',
                properties: {
                    server: {
                        source: {
                            type: 'local',
                            name: 'test',
                        },
                        type: 'object',
                        properties: {
                            host: {
                                source: {
                                    type: 'local',
                                    name: 'test',
                                },
                                type: 'placeholder',
                                value: {
                                    _source: 'consul',
                                    _key: 'host-name',
                                },
                                watcher: null,
                                nullable: false,
                            },
                            port: {
                                source: {
                                    type: 'local',
                                    name: 'test',
                                },
                                type: 'placeholder',
                                value: {
                                    _source: 'consul',
                                    _key: 'port-number',
                                    _default: 8080,
                                },
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

            expect(actual).to.equal(expected)
        })

        it('should throw if config value is not an object', async () => {
            expect(() => {
                ConfigBuilder.createConfigObject({
                    type: 'local',
                    name: 'test',
                }, 5)
            }).to.throw()
        })
    })
})
