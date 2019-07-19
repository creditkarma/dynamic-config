import { expect } from '@hapi/code'
import * as Lab from '@hapi/lab'

import { Utils } from '../../../main/utils'

export const lab = Lab.script()

const describe = lab.describe
const it = lab.it

describe('BasicUtils', () => {
    describe('dashToCamel', () => {
        it('should transform dashed string to camel-case', async () => {
            const base: string = 'this-is-test'
            const actual: string = Utils.dashToCamel(base)
            const expected: string = 'thisIsTest'

            expect(actual).to.equal(expected)
        })

        it('should return a camel-case string unaltered', async () => {
            const base: string = 'thisIsTest'
            const actual: string = Utils.dashToCamel(base)
            const expected: string = 'thisIsTest'

            expect(actual).to.equal(expected)
        })

        it('should normalize case to lower and capitalize each word', async () => {
            const base: string = 'THIS-Is-Test'
            const actual: string = Utils.dashToCamel(base)
            const expected: string = 'thisIsTest'

            expect(actual).to.equal(expected)
        })
    })

    describe('parseArrayKey', () => {
        it('should return an object of string/number if key contains array index', async () => {
            const testKey: string = 'shards[3]'
            const expected = {
                key: 'shards',
                index: 3,
            }

            const actual = Utils.parseArrayKey(testKey)

            expect(actual).to.equal(expected)
        })

        it('should handle multi-digit index numbers', async () => {
            const testKey: string = 'shards[349]'
            const expected = {
                key: 'shards',
                index: 349,
            }

            const actual = Utils.parseArrayKey(testKey)

            expect(actual).to.equal(expected)
        })

        it('should return an null if the key does not contain array index', async () => {
            const testKey: string = 'name'
            const expected = null

            const actual = Utils.parseArrayKey(testKey)

            expect(actual).to.equal(expected)
        })

        it('should return an null if the key only contains a left bracket', async () => {
            const testKey: string = 'name[0'
            const expected = null

            const actual = Utils.parseArrayKey(testKey)

            expect(actual).to.equal(expected)
        })

        it('should return an null if the key only contains a right bracket', async () => {
            const testKey: string = 'name0]'
            const expected = null

            const actual = Utils.parseArrayKey(testKey)

            expect(actual).to.equal(expected)
        })
    })
})
