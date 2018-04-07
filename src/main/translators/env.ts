/**
 * Plugin that replaces ${<variable-name>} with an environment placeholder.
 *
 * http://${HOSTNAME}:9000
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

function interpolate(source: string): string {
    const len: number = source.length
    let index: number = 0
    let result: string = ''
    let match: string = ''

    while (index < len) {
        const char = current()

        if (char === '$' && peek() === '{') {
            advance() // advance past $
            advance() // advance path {
            while (!isAtEnd() && current() !== '}' && isValidChar(current())) {
                match += current()
                advance()
                if (current() === '}' && process.env[match]) {
                    // Match found
                    advance() // advance past }
                    result += process.env[match]
                    match = ''
                } else if (current() === '}') {
                    throw new Error(`Environment variable '${result}' not set`)
                } else if (isAtEnd()) {
                    result += match
                    match = ''
                }
            }
        } else {
            result += char
            advance()
        }
    }

    function current(): string {
        return source.charAt(index)
    }

    function isAtEnd(): boolean {
        return index >= source.length
    }

    function peek(): string {
        return source.charAt(index + 1)
    }

    function advance(): void {
        index += 1
    }

    return result
}

export const envTranslator: IConfigTranslator = {
    translate(configValue: any): any {
        if (typeof configValue === 'string') {
            const envVar: string | undefined = interpolate(configValue)
            if (envVar !== undefined) {
                return envVar
            }
        }
        return configValue
    },
}
