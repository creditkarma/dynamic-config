import * as JsonValidator from 'ajv'
import { IObjectSchema, ISchema } from '../types'

const JSON_VALIDATOR: JsonValidator.Ajv = new JsonValidator()

export function objectMatchesSchema(schema: object, data: any): boolean {
    return JSON_VALIDATOR.validate(schema, data) as boolean
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
                const propSchema = objectAsSimpleSchema(obj[key])
                schema.properties![key] = propSchema

                if (
                    schema.required !== undefined &&
                    (propSchema as any).type !== 'undefined'
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
