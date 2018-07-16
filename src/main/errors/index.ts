export const enum DynamicConfigErrorType {
    MissingConfigPlaceholder = 'MissingConfigPlaceholder',
    DynamicConfigMissingKey = 'DynamicConfigMissingKey',
    DynamicConfigInvalidObject = 'DynamicConfigInvalidObject',
    UnknownError = 'UnkownError',
    HVNotConfigured = 'HVNotConfigured',
    HVFailed = 'HVFailed',
    ConsulNotConfigured = 'ConsulNotConfigured',
    ConsulFailed = 'ConsulFailed',
    ResolverUnavailable = 'ResolverUnavailable',
    MissingEnvironmentVariable = 'MissingEnvironmentVariable',
    MissingProcessVariable = 'MissingProcessVariable',
    InvalidConfigValue = 'InvalidConfigValue',
}

export type DynamicConfigError =
    MissingConfigPlaceholder | DynamicConfigMissingKey | DynamicConfigInvalidObject |
    HVNotConfigured | HVFailed | ConsulFailed | ResolverUnavailable | InvalidConfigValue |
    MissingEnvironmentVariable | MissingProcessVariable | UnknownError

export class InvalidConfigValue extends Error {
    public readonly type = DynamicConfigErrorType.InvalidConfigValue
    constructor(key: string, msg: string) {
        super(`Unable to resolve config at key[${key}]. ${msg}`)
    }
}

export class MissingConfigPlaceholder extends Error {
    public readonly type = DynamicConfigErrorType.MissingConfigPlaceholder
    constructor(key: string) {
        super(`Unable to resolve placeholder with key[${key}].`)
    }
}

export class DynamicConfigMissingKey extends Error {
    public readonly type = DynamicConfigErrorType.DynamicConfigMissingKey
    constructor(key: string) {
        super(`Unable to find value for key[${key}].`)
    }
}

export class DynamicConfigInvalidObject extends Error {
    public readonly type = DynamicConfigErrorType.DynamicConfigInvalidObject
    constructor(key: string) {
        super(`Object does not match expected schema[${key}].`)
    }
}

export class UnknownError extends Error {
    public readonly type = DynamicConfigErrorType.UnknownError
    constructor(msg: string) {
        super(msg)
    }
}

export class HVNotConfigured extends Error {
    public readonly type = DynamicConfigErrorType.HVNotConfigured
    constructor(key: string) {
        super(`Unable to retrieve key: ${key}. Hashicorp Vault is not configured.`)
    }
}

export class HVFailed extends Error {
    public readonly type = DynamicConfigErrorType.HVFailed
    constructor(message?: string) {
        super(`Vault failed with error: ${message}.`)
    }
}

export class ConsulNotConfigured extends Error {
    public readonly type = DynamicConfigErrorType.ConsulNotConfigured
    constructor(key: string) {
        super(`Unable to retrieve key: ${key}. Hashicorp Consul is not configured.`)
    }
}

export class ConsulFailed extends Error {
    public readonly type = DynamicConfigErrorType.ConsulFailed
    constructor(message?: string) {
        super(`Consul failed with error: ${message}.`)
    }
}

export class ResolverUnavailable extends Error {
    public readonly type = DynamicConfigErrorType.ResolverUnavailable
    constructor(key: string) {
        super(`Unable to retrieve key[${key}]. No resolver found.`)
    }
}

export class MissingEnvironmentVariable extends Error {
    public readonly type = DynamicConfigErrorType.MissingEnvironmentVariable
    constructor(key: string) {
        super(`Environment variable '${key}' not set.`)
    }
}

export class MissingProcessVariable extends Error {
    public readonly type = DynamicConfigErrorType.MissingProcessVariable
    constructor(key: string) {
        super(`Unable to retrieve key[${key}]. Argument not provided.`)
    }
}
