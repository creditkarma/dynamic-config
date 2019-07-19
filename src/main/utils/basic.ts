const MALFORMED_ARGUMENT = '<Error[malformed argument]>'

export function readValueFromArgs(
    key: string,
    args: Array<string>,
): string | undefined {
    return args
        .filter((next: string) => {
            return next.startsWith(key)
        })
        .map((match: string) => {
            const parts = match.split('=')
            if (parts.length === 2) {
                return parts[1]
            } else {
                return MALFORMED_ARGUMENT
            }
        })
        .filter((next: string) => {
            return next !== MALFORMED_ARGUMENT
        })[0]
}

export function readFromEnv(key: string): string | undefined {
    const value: string | undefined = process.env[key]
    if (value === undefined || value === 'undefined') {
        return undefined
    } else {
        return value
    }
}

export function readFromEnvOrProcess(key: string): string | undefined {
    return readValueFromArgs(key, process.argv) || readFromEnv(key)
}

export function readFirstMatch(...keys: Array<string>): string | undefined {
    if (keys.length === 0) {
        return undefined
    } else {
        const [head, ...tail] = keys
        const value: string | undefined = readFromEnvOrProcess(head)

        if (value === undefined) {
            return readFirstMatch(...tail)
        } else {
            return value
        }
    }
}

export function isPrimitiveType(
    type: string,
): type is 'string' | 'number' | 'boolean' {
    return type === 'number' || type === 'string' || type === 'boolean'
}

export function isPrimitive(obj: any): obj is string | number | boolean {
    return isPrimitiveType(typeof obj)
}

export function isNothing(obj: any): boolean {
    return obj === null || obj === undefined
}

export function isSomething(obj: any): boolean {
    return !isNothing(obj)
}

export function isObject(obj: any): obj is object {
    return obj !== null && !Array.isArray(obj) && typeof obj === 'object'
}

export interface IArrayKey {
    key: string
    index: number
}

export function isNumeric(val: string): boolean {
    return val >= '0' && val <= '9'
}

/**
 * This will handle reading a key that contains an array index.
 *
 * Example:
 *
 * 'databases[2]' -> { key: 'databases', index: 2 }
 *
 * TODO:
 * This will not handle multi-dimensional arrays
 *
 * Example:
 *
 * databases[1][4] -> { key: 'databases[1]', index: 4 }
 */
export function parseArrayKey(rawKey: string): IArrayKey | null {
    const len: number = rawKey.length
    let cursor: number = len - 1

    // bail early if we know the last char isn't a right bracket
    if (rawKey.charAt(cursor) === ']') {
        const stack: Array<string> = []
        let index: string = ''

        while (cursor >= 0) {
            const next: string = rawKey.charAt(cursor)

            // Bust out when we get to our right bracket
            if (next === '[') {
                if (stack.length === 1 && index !== '') {
                    return {
                        key: rawKey.substring(0, cursor),
                        index: parseInt(index, 10),
                    }
                } else {
                    return null
                }
            } else if (next === ']') {
                stack.push(next)
            } else if (stack.length === 1 && isNumeric(next)) {
                index = next + index
            }

            cursor -= 1
        }
    }

    return null
}

export function normalizePath(key: string): string {
    const parts = splitKey(key).reduce(
        (acc: Array<string | number>, next: string) => {
            const arrayKey = parseArrayKey(next)
            if (arrayKey !== null) {
                acc.push(arrayKey.key)
                acc.push(arrayKey.index)
            } else {
                acc.push(next)
            }
            return acc
        },
        [],
    )

    return parts.join('.')
}

export function splitKey(key: string): Array<string> {
    return (key || '')
        .split('.')
        .map((val: string) => {
            return val.trim()
        })
        .filter((val) => {
            return val !== ''
        })
}

export function dashToCamel(str: string): string {
    const parts: Array<string> = str.split('-')
    if (parts.length > 1) {
        const base: string = parts
            .map((part: string) => {
                return (
                    part.charAt(0).toUpperCase() +
                    part.substring(1).toLocaleLowerCase()
                )
            })
            .join('')

        return base.charAt(0).toLocaleLowerCase() + base.substring(1)
    } else {
        return str
    }
}

export function memoize<A extends Array<any>, B>(
    fn: (...args: A) => B,
): (...args: A) => B {
    let cachedValue: any
    return (...args) => {
        if (cachedValue === undefined) {
            cachedValue = fn(...args)
        }

        return cachedValue
    }
}
