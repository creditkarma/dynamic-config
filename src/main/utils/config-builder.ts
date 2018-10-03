import {
    isObject,
    isPrimitiveType,
} from './basic'

import {
    BaseConfigValue,
    IConfigProperties,
    IInvalidConfigValue,
    INullConfigValue,
    IResolvedPlaceholder,
    IRootConfigValue,
    ISource,
} from '../types'

import * as ConfigUtils from './config'

export function invalidValueForPlaceholder(placeholder: IResolvedPlaceholder): IInvalidConfigValue {
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

export function nullValueForPlaceholder(placeholder: IResolvedPlaceholder): INullConfigValue {
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

export function buildBaseConfigValue(source: ISource, obj: any, nullable: boolean = false): BaseConfigValue {
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
            items: obj.reduce((acc: Array<BaseConfigValue>, next: any) => {
                acc.push(buildBaseConfigValue(source, next))
                return acc
            }, []),
            watcher: null,
            nullable,
        }

    } else if (isObject(obj)) {
        return {
            source,
            type: 'object',
            properties: Object.keys(obj).reduce((acc: IConfigProperties, next: string) => {
                acc[next] = buildBaseConfigValue(source, obj[next])
                return acc
            }, {}),
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
        throw new TypeError(`Cannot build config from with object of type[${objType}]`)
    }
}

export function createConfigObject(
    source: ISource,
    obj: any,
): IRootConfigValue {
    if (isObject(obj)) {
        const configObj: IRootConfigValue = {
            type: 'root',
            properties: {},
            watcher: null,
        }

        for (const key of Object.keys(obj)) {
            configObj.properties[key] = buildBaseConfigValue(source, obj[key])
        }

        return configObj

    } else {
        throw new TypeError(`Config value must be an object, instead found type[${typeof obj}]`)
    }
}
