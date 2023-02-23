import * as Utils from './basic'

import { deepMap } from './object'

import { objectMatchesSchema } from './json'

import {
    BaseConfigValue,
    ConfigItems,
    ConfigValue,
    IArrayConfigValue,
    IConfigPlaceholder,
    IConfigProperties,
    IConfigTranslator,
    INamedResolvers,
    IObjectConfigValue,
    IRemoteResolver,
    IResolvedPlaceholder,
    IRootConfigValue,
    ITranslator,
    KeyPath,
    ObjectType,
} from '../types'

import {
    DynamicConfigError,
    DynamicConfigInvalidType,
    IConfigErrorMap,
    ResolverUnavailable,
} from '../errors'

import { defaultLogger as logger } from '../logger'

import { InvalidConfigValue } from '../errors'

export const emptyRootConfig = (): IRootConfigValue => ({
    type: 'root',
    properties: {},
    watcher: null,
})

export function getErrorForKey(
    key: string | undefined,
    errorMap: IConfigErrorMap,
): Error | undefined {
    if (key !== undefined) {
        return errorMap[key]
    } else {
        const keys = Object.keys(errorMap)
        if (keys.length > 0) {
            return errorMap[keys[0]]
        } else {
            return
        }
    }
}

export function setErrorForKey(
    key: string,
    error: DynamicConfigError,
    errorMap: IConfigErrorMap,
): IConfigErrorMap {
    const parts = key
        .split('.')
        .map((next: string) => next.trim())
        .filter((next: string) => next !== '')
    let soFar: string = ''
    for (const part of parts) {
        soFar = soFar !== '' ? `${soFar}.${part}` : part
        errorMap[soFar] = error
    }
    return errorMap
}

export function makeTranslator(
    translators: Array<IConfigTranslator>,
): ITranslator {
    return function applyTranslators(obj: any): any {
        return deepMap((val, path) => {
            try {
                return translators.reduce(
                    (acc: any, next: IConfigTranslator) => {
                        return next.translate(acc)
                    },
                    val,
                )
            } catch (err) {
                throw new InvalidConfigValue(
                    path,
                    err instanceof Error
                        ? err.message
                        : `Non Error Thrown: ${err}`,
                )
            }
        }, obj)
    }
}

export async function readValueForType(
    key: string,
    raw: string,
    type: ObjectType,
): Promise<any> {
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
                    if (raw === 'true') {
                        return Promise.resolve(true)
                    } else if (raw === 'false') {
                        return Promise.resolve(false)
                    } else {
                        throw new DynamicConfigInvalidType(key, type)
                    }

                default:
                    return Promise.resolve(raw)
            }
        } catch (err) {
            logger.error(`Unable to parse value[${raw}] as type[${type}]`)
            throw new DynamicConfigInvalidType(key, type)
        }
    } else {
        logger.log(`Raw value of type[${rawType}] being returned as is`)
        return Promise.resolve(raw)
    }
}

export function normalizeConfigPlaceholder(
    path: KeyPath,
    placeholder: IConfigPlaceholder,
    resolvers: INamedResolvers,
): IResolvedPlaceholder {
    const source: string = placeholder._source
    const resolver: IRemoteResolver | undefined = resolvers[source]

    if (resolver === undefined) {
        throw new ResolverUnavailable(placeholder._key)
    } else {
        return {
            path: path.join('.'),
            key: placeholder._key,
            altKey: placeholder._altKey,
            resolver: {
                name: source,
                type: resolver.type,
            },
            type: placeholder._type || 'string',
            nullable: placeholder._nullable || false,
            default: placeholder._default,
        }
    }
}

export function isValidRemote(name: string, resolvers: Set<string>): boolean {
    return resolvers.has(name)
}

export function isConfigPlaceholder(obj: any): obj is IConfigPlaceholder {
    return objectMatchesSchema(
        {
            type: 'object',
            properties: {
                _key: {
                    type: 'string',
                },
                _altKey: {
                    type: 'string',
                },
                _source: {
                    type: 'string',
                },
                _type: {
                    type: 'string',
                },
                _nullable: {
                    type: 'boolean',
                },
                _default: {},
            },
            required: ['_key', '_source'],
        },
        obj,
    )
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
                nullable: newValue.nullable,
            }

        case 'object':
            return {
                source: newValue.source,
                type: newValue.type,
                properties: newValue.properties,
                watcher: oldValue.watcher,
                nullable: newValue.nullable,
            }

        default:
            return {
                source: newValue.source,
                type: newValue.type,
                value: newValue.value,
                watcher: oldValue.watcher,
                nullable: newValue.nullable,
            } as BaseConfigValue
    }
}

function setBaseConfigValueForKey(
    key: string,
    newValue: BaseConfigValue,
    oldValue: BaseConfigValue,
    alertWatchers: boolean = false,
): BaseConfigValue {
    const [head, ...tail] = Utils.splitKey(key)

    if (oldValue.type === 'object') {
        const returnValue: IObjectConfigValue = {
            source: oldValue.source,
            type: oldValue.type,
            properties: Object.keys(oldValue.properties).reduce(
                (acc: IConfigProperties, next: string): IConfigProperties => {
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
                                oldValueAtKey.watcher(
                                    undefined,
                                    readConfigValue(newValue),
                                )
                            }
                        }
                    } else {
                        acc[next] = oldValueAtKey
                    }

                    return acc
                },
                {},
            ),
            watcher: oldValue.watcher,
            nullable: newValue.nullable,
        }

        if (alertWatchers && returnValue.watcher) {
            returnValue.watcher(undefined, readConfigValue(returnValue))
        }

        return returnValue
    } else if (oldValue.type === 'array') {
        const headIndex = parseInt(head, 10)
        const returnValue: IArrayConfigValue = {
            source: oldValue.source,
            type: oldValue.type,
            items: oldValue.items.reduce(
                (
                    acc: ConfigItems,
                    nextValue: BaseConfigValue,
                    index: number,
                ): ConfigItems => {
                    if (index === headIndex) {
                        if (tail.length > 0) {
                            acc.push(
                                setBaseConfigValueForKey(
                                    tail.join('.'),
                                    newValue,
                                    nextValue,
                                    alertWatchers,
                                ),
                            )
                        } else {
                            const tempValue = newConfigValue(
                                nextValue,
                                newValue,
                            )
                            tempValue.watcher = nextValue.watcher
                            acc.push(tempValue)

                            if (alertWatchers && nextValue.watcher) {
                                nextValue.watcher(
                                    undefined,
                                    readConfigValue(newValue),
                                )
                            }
                        }
                    } else {
                        acc.push(nextValue)
                    }

                    return acc
                },
                [],
            ),
            watcher: oldValue.watcher,
            nullable: newValue.nullable,
        }

        if (alertWatchers && returnValue.watcher) {
            returnValue.watcher(undefined, readConfigValue(returnValue))
        }

        return returnValue
    } else if (tail.length === 0) {
        const returnValue = newConfigValue(oldValue, newValue)

        if (alertWatchers && returnValue.watcher !== null) {
            returnValue.watcher(undefined, readConfigValue(newValue))
        }

        return returnValue
    } else {
        throw new Error(
            `Cannot set value at key[${key}] because it is not an object`,
        )
    }
}

function setRootConfigValueForKey(
    key: string,
    newValue: BaseConfigValue,
    oldValue: IRootConfigValue,
    alertWatchers: boolean = false,
): IRootConfigValue {
    const [head, ...tail] = Utils.splitKey(key)

    const returnValue: IRootConfigValue = {
        type: 'root',
        properties: Object.keys(oldValue.properties).reduce(
            (acc: IConfigProperties, next: string): IConfigProperties => {
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
                            oldValueAtKey.watcher(
                                undefined,
                                readConfigValue(newValue),
                            )
                        }
                    }
                } else {
                    acc[next] = oldValueAtKey
                }

                return acc
            },
            {},
        ),
        watcher: oldValue.watcher,
    }

    if (alertWatchers && returnValue.watcher) {
        returnValue.watcher(undefined, readConfigValue(returnValue))
    }

    return returnValue
}

export function setValueForKey<T extends ConfigValue>(
    key: string,
    newValue: BaseConfigValue,
    oldConfig: T,
    alertWatchers: boolean = false,
): T {
    if (oldConfig.type === 'root') {
        return setRootConfigValueForKey(
            key,
            newValue,
            oldConfig,
            alertWatchers,
        ) as T
    } else {
        return setBaseConfigValueForKey(
            key,
            newValue,
            oldConfig,
            alertWatchers,
        ) as T
    }
}

function buildObjectValue(obj: IObjectConfigValue | IRootConfigValue): any {
    const objectValue: any = {}

    for (const key of Object.keys(obj.properties)) {
        objectValue[key] = readConfigValue(obj.properties[key])
    }

    return objectValue
}

export function readConfigValue(obj: ConfigValue | null): any {
    if (obj === null) {
        return null
    } else {
        switch (obj.type) {
            case 'root':
            case 'object':
                return buildObjectValue(obj)

            case 'array':
                return obj.items.reduce(
                    (acc: Array<any>, next: BaseConfigValue) => {
                        acc.push(readConfigValue(next))
                        return acc
                    },
                    [],
                )

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
}

function getValueFromConfigValue(
    key: string,
    obj: ConfigValue,
): BaseConfigValue | null {
    if (Utils.isPrimitive(obj) || Utils.isNothing(obj)) {
        return null
    } else {
        const parts: Array<string> = Utils.splitKey(key)

        if (parts.length > 1) {
            const [head, ...tail] = parts
            if (obj.type === 'object') {
                return getValueFromConfigValue(
                    tail.join('.'),
                    obj.properties[head],
                )
            } else if (obj.type === 'array' && Utils.isNumeric(head)) {
                return getValueFromConfigValue(
                    tail.join('.'),
                    obj.items[parseInt(head, 10)],
                )
            } else {
                return null
            }
        } else if (obj.type === 'object' && obj.properties[key] !== undefined) {
            return obj.properties[key]
        } else if (obj.type === 'array' && Utils.isNumeric(key)) {
            const headIndex = parseInt(key, 10)
            if (obj.items[headIndex] !== undefined) {
                return obj.items[headIndex]
            } else {
                return null
            }
        } else {
            return null
        }
    }
}

export function getConfigForKey(
    key: string,
    obj: IRootConfigValue,
): BaseConfigValue | null {
    if (Utils.isPrimitive(obj) || Utils.isNothing(obj)) {
        return null
    } else {
        const parts: Array<string> = Utils.splitKey(key)

        if (parts.length > 1) {
            const [head, ...tail] = parts
            return getValueFromConfigValue(tail.join('.'), obj.properties[head])
        } else if (obj.properties[parts[0]] !== undefined) {
            return obj.properties[parts[0]]
        } else {
            return null
        }
    }
}
