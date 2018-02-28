import { expect } from 'code'
import * as Lab from 'lab'

import * as Translators from '../../main/translators'

export const lab = Lab.script()

const describe = lab.describe
const it = lab.it

describe('Translators', () => {
    describe('consulTranslator', () => {
        it('should transform consul! urls to config placeholders', async () => {
            const actual = Translators.consulTranslator.translate('consul!/my-service/password')
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
})
