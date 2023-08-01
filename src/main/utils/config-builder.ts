import { isObject, isPrimitiveType } from './basic'

import {
    ConfigValue,
    IConfigProperties,
    IInvalidConfigValue,
    INullConfigValue,
    IObjectConfigValue,
    IResolvedPlaceholder,
    ISource,
} from '../types'

import * as ConfigUtils from './config'

export function invalidValueForPlaceholder(
    placeholder: IResolvedPlaceholder,
): IInvalidConfigValue {
    return {
        source: {
            type: placeholder.resolver.type,
            name: placeholder.resolver.name,
            key: placeholder.key,
        },
        type: 'invalid',
        value: null,
        watcher: null,
        nullable: placeholder.nullable || false,
    }
}

export function nullValueForPlaceholder(
    placeholder: IResolvedPlaceholder,
): INullConfigValue {
    return {
        source: {
            type: placeholder.resolver.type,
            name: placeholder.resolver.name,
            key: placeholder.key,
        },
        type: 'null',
        value: null,
        watcher: null,
        nullable: placeholder.nullable || false,
    }
}

export function buildBaseConfigValue(
    source: ISource,
    obj: any,
    nullable: boolean = false,
): ConfigValue {
    const objType = typeof obj

    if (obj instanceof Promise) {
        return {
            source,
            type: 'promise',
            value: obj,
            watcher: null,
            nullable,
        }
    } else if (ConfigUtils.isConfigPlaceholder(obj)) {
        return {
            source,
            type: 'placeholder',
            value: obj,
            watcher: null,
            nullable,
        }
    } else if (Array.isArray(obj)) {
        return {
            source,
            type: 'array',
            items: obj.reduce((acc: Array<ConfigValue>, next: any) => {
                acc.push(
                    buildBaseConfigValue(
                        {
                            type: source.type,
                            name: source.name,
                        },
                        next,
                    ),
                )
                return acc
            }, []),
            watcher: null,
            nullable,
        }
    } else if (isObject(obj)) {
        return {
            source,
            type: 'object',
            properties: Object.keys(obj).reduce(
                (acc: IConfigProperties, next: string) => {
                    acc[next] = buildBaseConfigValue(
                        {
                            type: source.type,
                            name: source.name,
                        },
                        (obj as any)[next],
                    )
                    return acc
                },
                {},
            ),
            watcher: null,
            nullable,
        }
    } else if (isPrimitiveType(objType)) {
        return {
            source,
            type: objType,
            value: obj,
            watcher: null,
            nullable,
        }
    } else if (obj === null || obj === undefined) {
        return {
            source,
            type: 'null',
            value: null,
            watcher: null,
            nullable,
        }
    } else {
        throw new TypeError(
            `Cannot build config from object of type[${objType}]`,
        )
    }
}

export function createConfigObject(
    source: ISource,
    obj: any,
): IObjectConfigValue {
    if (isObject(obj)) {
        const configObj: IObjectConfigValue = {
            type: 'object',
            source,
            nullable: false,
            properties: {},
            watcher: null,
        }

        for (const key of Object.keys(obj)) {
            configObj.properties[key] = buildBaseConfigValue(
                source,
                (obj as any)[key],
            )
        }

        return configObj
    } else {
        throw new TypeError(
            `Config value must be an object, instead found type[${typeof obj}]`,
        )
    }
}
