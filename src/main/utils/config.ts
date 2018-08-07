import {
    isNothing,
    isPrimitive,
    splitKey,
} from './basic'

import {
    deepMap,
} from './object'

import {
    objectMatchesSchema,
} from './json'

import {
    BaseConfigValue,
    ConfigResolver,
    ConfigValue,
    IConfigPlaceholder,
    IConfigProperties,
    IConfigTranslator,
    IObjectConfigValue,
    IResolvedPlaceholder,
    IResolverMap,
    IRootConfigValue,
    ITranslator,
    ObjectType,
} from '../types'

import {
    DynamicConfigInvalidType, ResolverUnavailable,
} from '../errors'

import * as logger from '../logger'

import { InvalidConfigValue } from '../errors'

export function makeTranslator(translators: Array<IConfigTranslator>): ITranslator {
    return function applyTranslators(obj: any): any {
        return deepMap((val, path) => {
            try {
                return translators.reduce((acc: any, next: IConfigTranslator) => {
                    return next.translate(acc)
                }, val)

            } catch (err) {
                throw new InvalidConfigValue(path, err.message)
            }
        }, obj)
    }
}

export async function readValueForType(raw: string, type: ObjectType): Promise<any> {
    const rawType: string = typeof raw

    if (rawType === 'string') {
        try {
            switch (type) {
                case 'object':
                case 'array':
                    return Promise.resolve(JSON.parse(raw))

                case 'number':
                    return Promise.resolve(parseFloat(raw))

                case 'boolean':
                    return Promise.resolve(raw === 'true')

                default:
                    return Promise.resolve(raw)
            }
        } catch (err) {
            logger.error(`Unable to parse value as type[${type}]`)
            throw new DynamicConfigInvalidType(type)
        }
    } else {
        logger.log(`Raw value of type[${rawType}] being returned as is`)
        return Promise.resolve(raw)
    }
}

export function normalizeConfigPlaceholder(
    placeholder: IConfigPlaceholder,
    resolvers: IResolverMap,
): IResolvedPlaceholder {
    const source: string = placeholder._source
    const resolver: ConfigResolver | undefined =
        Object.keys(resolvers).reduce<ConfigResolver | undefined>((acc, next) => {
            if (source === (resolvers as any)[next].name) {
                acc = (resolvers as any)[next]
            }
            return acc
        }, undefined)

    if (resolver === undefined) {
        throw new ResolverUnavailable(placeholder._key)

    } else {
        return {
            key: placeholder._key,
            resolver: {
                name: source,
                type: resolver.type,
            },
            type: (placeholder._type || 'string'),
            default: placeholder._default,
        }
    }
}

export function isValidRemote(name: string, resolvers: Set<string>): boolean {
    return resolvers.has(name)
}

export function isConfigPlaceholder(obj: any): obj is IConfigPlaceholder {
    return objectMatchesSchema({
        type: 'object',
        properties: {
            '_key': {
                type: 'string',
            },
            '_source': {
                type: 'string',
            },
            '_type': {
                type: 'string',
            },
            '_default': {},
        },
        required: [ '_key', '_source' ],
    }, obj)
}

function newConfigValue(
    oldValue: BaseConfigValue,
    newValue: BaseConfigValue,
): BaseConfigValue {
    switch (newValue.type) {
        case 'array':
            return {
                source: newValue.source,
                type: newValue.type,
                items: newValue.items,
                watcher: oldValue.watcher,
            }
        case 'object':
            return {
                source: newValue.source,
                type: newValue.type,
                properties: newValue.properties,
                watcher: oldValue.watcher,
            }
        default:
            return {
                source: newValue.source,
                type: newValue.type,
                value: newValue.value,
                watcher: oldValue.watcher,
            } as BaseConfigValue
    }
}

function setBaseConfigValueForKey(
    key: string,
    newValue: BaseConfigValue,
    oldValue: BaseConfigValue,
    alertWatchers: boolean = false,
): BaseConfigValue {
    const [ head, ...tail ] = splitKey(key)

    if (oldValue.type === 'object') {
        const returnValue: IObjectConfigValue = {
            source: oldValue.source,
            type: oldValue.type,
            properties: Object.keys(oldValue.properties).reduce((acc: IConfigProperties, next: string): IConfigProperties => {
                const oldValueAtKey = oldValue.properties[next]
                if (next === head) {
                    if (tail.length > 0) {
                        acc[next] = setBaseConfigValueForKey(
                            tail.join('.'),
                            newValue,
                            oldValueAtKey,
                            alertWatchers,
                        )

                    } else {
                        acc[next] = newConfigValue(oldValueAtKey, newValue)
                        acc[next].watcher = oldValueAtKey.watcher

                        if (alertWatchers && oldValueAtKey.watcher) {
                            oldValueAtKey.watcher(readConfigValue(newValue))
                        }
                    }

                } else {
                    acc[next] = oldValueAtKey
                }

                return acc
            }, {}),
            watcher: oldValue.watcher,
        }

        if (alertWatchers && returnValue.watcher) {
            returnValue.watcher(readConfigValue(returnValue))
        }

        return returnValue

    } else if (tail.length === 0) {
        const returnValue = newConfigValue(oldValue, newValue)
        returnValue.watcher = returnValue.watcher

        if (alertWatchers && returnValue.watcher !== null) {
            returnValue.watcher(readConfigValue(newValue))
        }

        return returnValue

    } else {
        throw new Error(`Cannot set value at key[${key}] because it is not an object`)
    }
}

function setRootConfigValueForKey(
    key: string,
    newValue: BaseConfigValue,
    oldValue: IRootConfigValue,
    alertWatchers: boolean = false,
): IRootConfigValue {
    const [ head, ...tail ] = splitKey(key)

    const returnValue: IRootConfigValue = {
        type: 'root',
        properties: Object.keys(oldValue.properties).reduce((acc: IConfigProperties, next: string): IConfigProperties => {
            const oldValueAtKey = oldValue.properties[next]
            if (next === head) {
                if (tail.length > 0) {
                    acc[next] = setBaseConfigValueForKey(
                        tail.join('.'),
                        newValue,
                        oldValueAtKey,
                        alertWatchers,
                    )

                } else {
                    acc[next] = newConfigValue(oldValueAtKey, newValue)
                    acc[next].watcher = oldValueAtKey.watcher

                    if (alertWatchers && oldValueAtKey.watcher) {
                        oldValueAtKey.watcher(readConfigValue(newValue))
                    }
                }

            } else {
                acc[next] = oldValueAtKey
            }

            return acc
        }, {}),
        watcher: oldValue.watcher,
    }

    if (alertWatchers && returnValue.watcher) {
        returnValue.watcher(readConfigValue(returnValue))
    }

    return returnValue
}

export function setValueForKey(
    key: string,
    newValue: BaseConfigValue,
    oldConfig: ConfigValue,
    alertWatchers: boolean = false,
): ConfigValue {
    if (oldConfig.type === 'root') {
        return setRootConfigValueForKey(key, newValue, oldConfig, alertWatchers)

    } else {
        return setBaseConfigValueForKey(key, newValue, oldConfig, alertWatchers)
    }
}

function buildObjectValue(obj: IObjectConfigValue | IRootConfigValue): any {
    const objectValue: any = {}

    for (const key of Object.keys(obj.properties)) {
        objectValue[key] = readConfigValue(obj.properties[key])
    }

    return objectValue
}

export function readConfigValue(obj: ConfigValue): any {
    switch (obj.type) {
        case 'root':
        case 'object':
            return buildObjectValue(obj)

        case 'array':
            return obj.items

        case 'string':
        case 'number':
        case 'boolean':
            return obj.value

        case 'placeholder':
            logger.warn(`Trying to read value of unresolved Placeholder`)
            return null

        case 'promise':
            logger.warn(`Trying to read value of unresolved Promise`)
            return null

        default:
            return null
    }
}

function getValueFromConfigValue(key: string, obj: ConfigValue): BaseConfigValue | null {
    if (isPrimitive(obj) || isNothing(obj)) {
        return null

    } else {
        const parts: Array<string> = splitKey(key)

        if (parts.length > 1) {
            const [ head, ...tail ] = parts
            if (obj.type === 'object') {
                return getValueFromConfigValue(tail.join('.'), obj.properties[head])

            } else {
                return null
            }

        } else if (
            obj.type === 'object' &&
            obj.properties[key] !== undefined
        ) {
            return obj.properties[key]

        } else {
            return null
        }
    }
}

export function getConfigForKey(key: string, obj: IRootConfigValue): BaseConfigValue | null {
    if (isPrimitive(obj) || isNothing(obj)) {
        return null

    } else {
        const parts: Array<string> = splitKey(key)

        if (parts.length > 1) {
            const [ head, ...tail ] = parts
            return getValueFromConfigValue(tail.join('.'), obj.properties[head])

        } else if (obj.properties[parts[0]] !== undefined) {
            return obj.properties[parts[0]]

        } else {
            return null
        }
    }
}
