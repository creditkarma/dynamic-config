import { expect } from '@hapi/code'
import * as Lab from '@hapi/lab'

import * as Translators from '../../main/translators'

export const lab = Lab.script()

const describe = lab.describe
const it = lab.it

describe('Translators', () => {
    describe('consulTranslator', () => {
        it('should transform consul! urls to config placeholders', async () => {
            const actual = Translators.consulTranslator.translate(
                'consul!/my-service/password',
            )
            const expected = {
                _source: 'consul',
                _key: 'my-service/password',
            }

            expect(actual).to.equal(expected)
        })

        it('should transform alternate consul placeholders to config placeholders', async () => {
            const actual = Translators.consulTranslator.translate({
                key: 'consul!/my-service/password',
                default: 'password123',
            })
            const expected = {
                _source: 'consul',
                _key: 'my-service/password',
                _default: 'password123',
            }

            expect(actual).to.equal(expected)
        })
    })

    describe('envTranslator', () => {
        it('should replace environment variables with values', async () => {
            process.env.HOSTNAME = 'test_one'
            const actual = Translators.envTranslator.translate('${HOSTNAME}')
            const expected = 'test_one'
            expect(actual).to.equal(expected)
        })

        it('should replace variables nested in other values', async () => {
            process.env.HOSTNAME = 'test_two'
            const actual = Translators.envTranslator.translate(
                'http://${HOSTNAME}:9000',
            )
            const expected = 'http://test_two:9000'
            expect(actual).to.equal(expected)
        })

        it('should allow for multiple environment placeholders', async () => {
            process.env.HOSTNAME = 'test_three'
            process.env.PORT = '8080'
            const actual = Translators.envTranslator.translate(
                'http://${HOSTNAME}:${PORT}',
            )
            const expected = 'http://test_three:8080'
            expect(actual).to.equal(expected)
        })
    })
})
