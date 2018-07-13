import {
    isObject,
    isPrimitiveType,
} from './basic'

import {
    BaseConfigValue,
    IConfigProperties,
    IRootConfigValue,
    ISource,
} from '../types'

import * as ConfigUtils from './config'

export function buildBaseConfigValue(source: ISource, obj: any): BaseConfigValue {
    const objType = typeof obj

    if (obj instanceof Promise) {
        return {
            source,
            type: 'promise',
            value: obj,
            watcher: null,
        }

    } else if (ConfigUtils.isConfigPlaceholder(obj)) {
        return {
            source,
            type: 'placeholder',
            value: obj,
            watcher: null,
        }

    } else if (Array.isArray(obj)) {
        return {
            source,
            type: 'array',
            items: obj,
            watcher: null,
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
        }

    } else if (isPrimitiveType(objType)) {
        return {
            source,
            type: objType,
            value: obj,
            watcher: null,
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
