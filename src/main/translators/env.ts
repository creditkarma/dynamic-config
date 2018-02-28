/**
 * Plugin that replaces $<variable-name> with an environment placeholder.
 */
import {
    IConfigTranslator,
} from '../types'

function isValidChar(char: string): boolean {
    return (
        (char >= 'A' && char <= 'Z') ||
        (char === '_')
    )
}

function findEnvVariable(val: string): string | undefined {
    let match = ''
    let state = 'init'
    const trimmed = val.trim()

    for (let i = 0; i < trimmed.length; i++) {
        const current = trimmed.charAt(i)
        if (match.length === 0 && current === '$') {
            state = 'matching'

        } else if (state === 'matching' && isValidChar(current)) {
            match += current

        } else {
            return undefined
        }
    }

    return match
}

export const envTranslator: IConfigTranslator = {
    translate(configValue: any): any {
        if (typeof configValue === 'string') {
            const envVar: string | undefined = findEnvVariable(configValue)
            if (envVar !== undefined) {
                return {
                    _source: 'env',
                    _key: envVar,
                }
            }
        }
        return configValue
    },
}
