import { expect } from 'code'
import * as Lab from 'lab'

import { ObjectUtils } from '../../../main/utils'

export const lab = Lab.script()

const describe = lab.describe
const it = lab.it

describe('ObjectUtils', () => {
    describe('deepMap', () => {
        it('should correctly transform values of object', async () => {
            const mockObj = {
                one: 1,
                two: 2,
            }
            const actual = ObjectUtils.deepMap((val: any) => {
                return val + 1
            }, mockObj)
            const expected = {
                one: 2,
                two: 3,
            }

            expect(actual).to.equal(expected)
        })

        it('should correctly transform values of an array', async () => {
            const mockObj = [ 1, 5, 8, 23 ]

            const actual = ObjectUtils.deepMap((val: any) => {
                return val + 1
            }, mockObj)

            const expected = [ 2, 6, 9, 24 ]

            expect(actual).to.equal(expected)
        })

        it('should map over leafs first', async () => {
            const mockObj = {
                one: {
                    two: {
                        three: 3,
                        four: 4,
                    },
                },
            }
            const actual = ObjectUtils.deepMap(
                (val: any, key: string) => {
                    if (
                        typeof val === 'object' &&
                        val.three === 5 &&
                        val.four === 5
                    ) {
                        return 'success'

                    } else if (typeof val === 'number') {
                        return 5

                    } else {
                        return val
                    }
                },
                mockObj,
            )
            const expected = {
                one: {
                    two: 'success',
                },
            }

            expect(actual).to.equal(expected)
        })
    })

    describe('getValueForKey', () => {
        const mockJSON = {
            one: {
                two: {
                    three: false,
                },
            },
        }

        it('should return value for key at object root', async () => {
            const actual: any = ObjectUtils.getValueForKey('one', mockJSON)
            const expected: any = {
                two: {
                    three: false,
                },
            }

            expect(actual).to.equal(expected)
        })

        it('should return null for a missing key', async () => {
            const actual: any = ObjectUtils.getValueForKey('two', mockJSON)
            const expected: any = null

            expect(actual).to.equal(expected)
        })

        it('should return value for a nested key', async () => {
            const actual: any = ObjectUtils.getValueForKey(
                'one.two.three',
                mockJSON,
            )
            const expected: any = false

            expect(actual).to.equal(expected)
        })
    })

    describe('setValueForKey', () => {
        const mockJSON = {
            one: {
                two: {
                    three: false,
                },
            },
        }

        it('should set the value of given key', async () => {
            const actual: any = ObjectUtils.setValueForKey(
                'one',
                'one',
                mockJSON,
            )
            const expected: any = {
                one: 'one',
            }

            expect(actual).to.equal(expected)
        })

        it('should set the value of given nested key', async () => {
            const actual: any = ObjectUtils.setValueForKey(
                'one.two.three',
                true,
                mockJSON,
            )
            const expected: any = {
                one: {
                    two: {
                        three: true,
                    },
                },
            }

            expect(actual).to.equal(expected)
        })

        it('should set the value of an array at given index', async () => {
            const mockWithArray = {
                one: {
                    two: [
                        { three: true },
                        { three: true },
                        { three: true },
                        { three: true },
                    ],
                },
            }
            const actual: any = ObjectUtils.setValueForKey(
                'one.two.2.three',
                false,
                mockWithArray,
            )
            const expected: any = {
                one: {
                    two: [
                        { three: true },
                        { three: true },
                        { three: false },
                        { three: true },
                    ],
                },
            }

            expect(actual).to.equal(expected)
        })

        it('should ignore setting non-existent props', async () => {
            const actual: any = ObjectUtils.setValueForKey(
                'one.two.four',
                true,
                mockJSON,
            )
            const expected: any = {
                one: {
                    two: {
                        three: false,
                    },
                },
            }

            expect(actual).to.equal(expected)
        })
    })

    describe('objectHasShape', () => {
        const tester = ObjectUtils.objectHasShape({
            default: 'default',
            key: 'key',
        })

        it('shoult return true if object matches given shape', async () => {
            const actual: boolean = tester({
                default: 'foo',
                key: 'bar',
            })

            expect(actual).to.equal(true)
        })

        it('shoult return false if object does not match given shape', async () => {
            const actual: boolean = tester({
                foo: 'foo',
                key: 'bar',
            })

            expect(actual).to.equal(false)
        })
    })

    describe('overlayObjects', () => {
        it('should override base values with update values', async () => {
            const baseConfig = {
                protocol: 'https',
                destination: '127.0.0.1:9000',
                hostHeader: 'hvault.com',
                sslValidation: false,
                namespace: '/your-group/your-service',
                tokenPath: '/tmp/test-token',
            }

            const updateConfig = {
                protocol: 'http',
                destination: '127.0.0.1:8200',
                hostHeader: 'hvault.com',
                sslValidation: true,
            }

            const expected = {
                protocol: 'http',
                destination: '127.0.0.1:8200',
                hostHeader: 'hvault.com',
                sslValidation: true,
                namespace: '/your-group/your-service',
                tokenPath: '/tmp/test-token',
            }

            const actual = ObjectUtils.overlayObjects(baseConfig, updateConfig)

            expect(actual).to.equal(expected)
        })

        it('should correctly handle nested objects', async () => {
            const baseConfig = {
                serviceName: 'test',
                lru: {
                    max: 500,
                    maxAge: 3600000,
                },
            }

            const updateConfig = {
                serviceName: 'test-development',
                lru: {
                    maxAge: 480000,
                },
            }

            const expected = {
                serviceName: 'test-development',
                lru: {
                    max: 500,
                    maxAge: 480000,
                },
            }

            const actual = ObjectUtils.overlayObjects(baseConfig, updateConfig)

            expect(actual).to.equal(expected)
        })
    })
})
