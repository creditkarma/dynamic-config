/**
 * Plugin that replaces ${<variable-name>} with an environment placeholder.
 *
 * http://${HOSTNAME}:9000
 */
import { MissingEnvironmentVariable } from '../errors'
import {
    IConfigTranslator,
} from '../types'

function isValidChar(char: string): boolean {
    return (
        (char >= 'A' && char <= 'Z') ||
        (char === '_')
    )
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

        while (this.index < this.len) {
            const char = this.current()

            if (char === '$' && this.peek() === '{') {
                this.advance() // advance past $
                this.advance() // advance path {
                while (!this.isAtEnd() && this.current() !== '}' && isValidChar(this.current())) {
                    this.match += this.current()
                    this.advance()

                    if (this.current() === '}' && process.env[this.match] !== undefined) {
                        // Match found
                        this.advance() // advance past }
                        result += process.env[this.match]
                        this.match = ''

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
