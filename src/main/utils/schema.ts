import {
    IObjectSchema,
    ISchema,
} from '../types'

import * as logger from '../logger'

import {
    Just,
    Maybe,
    Nothing,
} from '../Maybe'

export function findSchemaForKey(schema: ISchema, key: string): Maybe<ISchema> {
    const [ head, ...tail ]: Array<string> =
        key.split('.').filter((next: string) => next.trim() !== '')

    if (
        tail.length > 0 &&
        schema.type === 'object' &&
        schema.properties !== undefined &&
        schema.properties[head] !== undefined
    ) {
        return findSchemaForKey(schema.properties[head], tail.join('.'))

    } else if (
        schema.type === 'object' &&
        schema.properties !== undefined &&
        schema.properties[head] !== undefined
    ) {
        return new Just(schema.properties[head])

    } else {
        return new Nothing()
    }
}

/**
 * Creates a schema for the given object. The resulting schema is a simple JSON Schema.
 */
export function objectAsSimpleSchema(obj: any): ISchema {
    const objType = typeof obj

    if (Array.isArray(obj)) {
        return {
            type: 'array',
            items: objectAsSimpleSchema(obj[0]),
        }

    } else if (objType === 'object') {
        const schema: IObjectSchema = {
            type: 'object',
            properties: {},
            required: [],
        }

        if (obj !== null) {
            for (const key of Object.keys(obj)) {
                schema.properties![key] = objectAsSimpleSchema(obj[key])
                if (
                    schema.required !== undefined &&
                    schema.properties![key].type !== 'undefined'
                ) {
                    schema.required.push(key)
                }
            }
        }

        return schema

    } else {
        if (objType !== 'function' && objType !== 'symbol') {
            return {
                type: objType,
            } as ISchema

        } else {
            throw new Error(`Type[${objType}] cannot be encoded to JSON`)
        }
    }
}

export function objectMatchesSchema(schema: ISchema, obj: any): boolean {
    const objType: string = typeof obj

    if (obj === null) {
        return schema.type === 'undefined'

    } else if (Array.isArray(obj) && schema.type === 'array') {
        if (schema.items !== undefined && obj.length > 0) {
            if (Array.isArray(schema.items)) {
                const schemaLen: number = schema.items.length
                const objLen: number = obj.length
                if (schemaLen !== objLen) {
                    logger.warn(`Tuple contains ${objLen}, but schema only allows ${schemaLen}`)
                    return false
                } else {
                    for (let i = 0; i < objLen; i++) {
                        if (!objectMatchesSchema(schema.items[i], obj[i])) {
                            return false
                        }
                    }

                    return true
                }

            } else {
                for (const item of obj) {
                    if (!objectMatchesSchema(schema.items, item)) {
                        return false
                    }
                }

                return true
            }

        } else {
            return true
        }

    } else if (objType === 'object' && schema.type === 'object') {
        if (schema.properties !== undefined) {
            const schemaKeys: Array<string> = Object.keys(schema.properties)

            const objKeys: Array<string> = Object.keys(obj)
            for (const key of objKeys) {
                if (schemaKeys.indexOf(key) === -1) {
                    logger.warn(`Object contains key[${key}] not in schema`)
                    return false
                }
            }

            for (const key of schemaKeys) {
                const nextSchema: ISchema = schema.properties[key]
                const nextObj: any = obj[key]

                if (nextObj === undefined && schema.required !== undefined) {
                    logger.warn(`Object is missing required key[${key}]`)
                    return schema.required.indexOf(key) === -1

                } else if (!objectMatchesSchema(nextSchema, nextObj)) {
                    return false
                }
            }

            return true
        } else {
            return true
        }

    } else if (schema.type === 'any' || schema.type === objType) {
        return true

    } else {
        logger.warn(`Schema type[${schema.type}] does not match object type[${objType}]`)
        return false
    }
}
