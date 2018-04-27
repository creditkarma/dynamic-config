/**
 * Plugin that replaces consul! urls with consul config placeholders
 */
import { IConfigTranslator } from '../types'
import { JSONUtils } from '../utils'

const CONSUL_PREFIX: string = 'consul!/'

function isPlaceholderKey(key: string): string | undefined {
    if (key.startsWith(CONSUL_PREFIX)) {
        return key.replace(CONSUL_PREFIX, '')
    }

    return undefined
}

function isConsulPlaceholder(obj: any): boolean {
    return JSONUtils.objectMatchesSchema({
            type: 'object',
            properties: {
                default: {},
                key: {
                    type: 'string',
                },
            },
            required: [ 'key' ],
        },
        obj,
    )
}

export const consulTranslator: IConfigTranslator = {
    translate(configValue: any): any {
        if (typeof configValue === 'string') {
            const placeholderKey = isPlaceholderKey(configValue)
            if (placeholderKey !== undefined) {
                return {
                    _source: 'consul',
                    _key: placeholderKey,
                }
            }

        } else if (typeof configValue === 'object') {
            if (
                isConsulPlaceholder(configValue) &&
                configValue.key.startsWith(CONSUL_PREFIX)
            ) {
                return {
                    _source: 'consul',
                    _key: configValue.key.replace(CONSUL_PREFIX, ''),
                    _default: configValue.default,
                }
            }
        }

        return configValue
    },
}
