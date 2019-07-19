/**
 * Plugin that replaces ${<variable-name>} with an environment placeholder.
 *
 * http://${HOSTNAME}:9000
 */
import { InvalidCharacter, MissingEnvironmentVariable } from '../errors'

import { IConfigTranslator } from '../types'

function isValidChar(char: string): boolean {
    return (char >= 'A' && char <= 'Z') || char === '_' || char === '|'
}

class Interpolater {
    private source: string = ''
    private len: number = 0
    private index: number = 0
    private match: string = ''

    public run(source: string): string {
        this.source = source
        this.len = source.length
        this.index = 0
        this.match = ''
        let result: string = ''
        let defaultVal: string = ''

        while (this.index < this.len) {
            const char = this.current()

            if (char === '$' && this.peek() === '{') {
                this.advance() // advance past $
                this.advance() // advance path {
                while (
                    !this.isAtEnd() &&
                    this.current() !== '}' &&
                    isValidChar(this.current())
                ) {
                    // Check if we are handling a default value
                    if (this.current() === '|' && this.peek() === '|') {
                        this.advance() // advance past first |
                        this.advance() // advance past second |
                        defaultVal = this.parseDefault()

                        // Don't allow random pipe characters
                    } else if (this.current() === '|') {
                        // pipe is invalid unless defining default value
                        throw new InvalidCharacter(this.current())

                        // Otherwise we're still parsing the name match
                    } else {
                        this.match += this.current()
                        this.advance()
                    }

                    // These handle the end of our parse
                    if (
                        this.current() === '}' &&
                        process.env[this.match.trim()] !== undefined
                    ) {
                        // Match found
                        this.advance() // advance past }
                        result += process.env[this.match.trim()]
                        this.match = ''
                    } else if (this.current() === '}' && defaultVal !== '') {
                        result += defaultVal
                        this.advance() // advance past }
                    } else if (this.current() === '}') {
                        throw new MissingEnvironmentVariable(this.match)
                    } else if (this.isAtEnd()) {
                        result += this.match
                        this.match = ''
                    }
                }
            } else {
                result += char
                this.advance()
            }
        }

        return result
    }

    private parseDefault(): string {
        let result: string = ''
        while (!this.isAtEnd() && this.current() !== '}') {
            result += this.current()
            this.advance()
        }

        return result.trim()
    }

    private current(): string {
        return this.source.charAt(this.index)
    }

    private isAtEnd(): boolean {
        return this.index >= this.len
    }

    private peek(): string {
        return this.source.charAt(this.index + 1)
    }

    private advance(): void {
        this.index += 1
    }
}

const interpolater = new Interpolater()

export const envTranslator: IConfigTranslator = {
    translate(configValue: any): any {
        if (typeof configValue === 'string') {
            const envVar: string | undefined = interpolater.run(configValue)
            if (envVar !== undefined) {
                return envVar
            }
        }

        return configValue
    },
}
