import { expect } from '@hapi/code'
import * as Lab from '@hapi/lab'

import { ISchema } from '../../../main/types'

import { JSONUtils } from '../../../main/utils'

export const lab = Lab.script()

const describe = lab.describe
const it = lab.it

describe('JSONUtils', () => {
    describe('objectAsSimpileSchema', () => {
        it('should correctly generate a schema for an object', async () => {
            const actual: ISchema = JSONUtils.objectAsSimpleSchema({
                one: 'one',
                two: 56,
                three: {
                    type: 'word',
                    values: ['one'],
                },
            })
            const expected: ISchema = {
                type: 'object',
                properties: {
                    one: {
                        type: 'string',
                    },
                    two: {
                        type: 'number',
                    },
                    three: {
                        type: 'object',
                        properties: {
                            type: {
                                type: 'string',
                            },
                            values: {
                                type: 'array',
                                items: {
                                    type: 'string',
                                },
                            },
                        },
                        required: ['type', 'values'],
                    },
                },
                required: ['one', 'two', 'three'],
            }

            expect(actual).to.equal(expected)
        })

        it('should assign empty arrays to have undefined item types', async () => {
            const actual: ISchema = JSONUtils.objectAsSimpleSchema([])
            const expected: ISchema = {
                type: 'array',
                items: {
                    type: 'undefined',
                },
            }

            expect(actual).to.equal(expected)
        })

        it('should correctly generate schema for primitive objects', async () => {
            const actual: ISchema = JSONUtils.objectAsSimpleSchema(3)
            const expected: ISchema = {
                type: 'number',
            }

            expect(actual).to.equal(expected)
        })

        it('should correctly generate schema for null objects', async () => {
            const actual: ISchema = JSONUtils.objectAsSimpleSchema(null)
            const expected: ISchema = {
                type: 'object',
                properties: {},
                required: [],
            }

            expect(actual).to.equal(expected)
        })
    })

    describe('objectMatchesSchema', () => {
        const objectSchema: ISchema = {
            type: 'object',
            properties: {
                one: {
                    type: 'string',
                },
                two: {
                    type: 'number',
                },
            },
            required: ['one', 'two'],
        }

        const strSchema: ISchema = {
            type: 'string',
        }

        const optionalSchema: ISchema = {
            type: 'object',
            properties: {
                one: {
                    type: 'string',
                },
                two: {
                    type: 'number',
                },
            },
            required: ['one'],
        }

        const anySchema: ISchema = {
            type: 'object',
            properties: {
                one: {},
            },
            required: ['one'],
        }

        it('should return true if object matches given schema', async () => {
            const actual: boolean = JSONUtils.objectMatchesSchema(
                objectSchema,
                {
                    one: 'one',
                    two: 2,
                },
            )
            const expected: boolean = true

            expect(actual).to.equal(expected)
        })

        it('should return false if object does not match given schema', async () => {
            const actual: boolean = JSONUtils.objectMatchesSchema(
                objectSchema,
                {
                    one: 'one',
                    two: 'two',
                },
            )
            const expected: boolean = false

            expect(actual).to.equal(expected)
        })

        it('should return true if primitive matches given schema', async () => {
            const actual: boolean = JSONUtils.objectMatchesSchema(
                strSchema,
                'test',
            )
            const expected: boolean = true

            expect(actual).to.equal(expected)
        })

        it('should return false if primitive does not match given schema', async () => {
            const actual: boolean = JSONUtils.objectMatchesSchema(strSchema, 5)
            const expected: boolean = false

            expect(actual).to.equal(expected)
        })

        it('should return true if object does not include optional fields', async () => {
            const actual: boolean = JSONUtils.objectMatchesSchema(
                optionalSchema,
                {
                    one: 'one',
                },
            )
            const expected: boolean = true

            expect(actual).to.equal(expected)
        })

        it('should return true with any type matching number', async () => {
            const actual: boolean = JSONUtils.objectMatchesSchema(anySchema, {
                one: 5,
            })
            const expected: boolean = true

            expect(actual).to.equal(expected)
        })

        it('should return true with any type matching string', async () => {
            const actual: boolean = JSONUtils.objectMatchesSchema(anySchema, {
                one: 'one',
            })
            const expected: boolean = true

            expect(actual).to.equal(expected)
        })

        it('should return true with any type matching object', async () => {
            const actual: boolean = JSONUtils.objectMatchesSchema(anySchema, {
                one: {
                    test: 'test',
                },
            })
            const expected: boolean = true

            expect(actual).to.equal(expected)
        })
    })
})
