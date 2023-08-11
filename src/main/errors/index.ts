export interface IConfigErrorMap {
    [path: string]: Error
}

export const enum DynamicConfigErrorType {
    MissingConfigPlaceholder = 'MissingConfigPlaceholder',
    DynamicConfigMissingKey = 'DynamicConfigMissingKey',
    DynamicConfigInvalidObject = 'DynamicConfigInvalidObject',
    DynamicConfigInvalidResolver = 'DynamicConfigInvalidResolver',
    DynamicConfigInvalidType = 'DynamicConfigInvalidType',
    DynamicConfigMissingDefault = 'DynamicConfigMissingDefault',
    DynamicConfigMissingLoader = 'DynamicConfigMissingLoader',
    UnknownError = 'UnkownError',
    HVNotConfigured = 'HVNotConfigured',
    HVFailed = 'HVFailed',
    ConsulNotConfigured = 'ConsulNotConfigured',
    ConsulFailed = 'ConsulFailed',
    ResolverUnavailable = 'ResolverUnavailable',
    MissingEnvironmentVariable = 'MissingEnvironmentVariable',
    MissingProcessVariable = 'MissingProcessVariable',
    InvalidConfigValue = 'InvalidConfigValue',
    InvalidCharacter = 'InvalidCharacter',
    MissingPackageProperty = 'MissingPackageProperty',
}

export type DynamicConfigError =
    | MissingConfigPlaceholder
    | DynamicConfigMissingKey
    | DynamicConfigInvalidObject
    | DynamicConfigInvalidResolver
    | DynamicConfigMissingLoader
    | HVNotConfigured
    | HVFailed
    | ConsulFailed
    | ResolverUnavailable
    | InvalidConfigValue
    | MissingEnvironmentVariable
    | MissingProcessVariable
    | UnknownError
    | DynamicConfigMissingDefault
    | DynamicConfigInvalidType
    | InvalidCharacter
    | MissingPackageProperty

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

export class DynamicConfigMissingDefault extends Error {
    public readonly type = DynamicConfigErrorType.DynamicConfigMissingDefault
    constructor(path: string) {
        super(`Unable to load default config at path[${path}]`)
    }
}

export class DynamicConfigMissingKey extends Error {
    public readonly type = DynamicConfigErrorType.DynamicConfigMissingKey
    constructor(key: string) {
        super(`Unable to find value for key[${key}].`)
    }
}

export class DynamicConfigMissingLoader extends Error {
    public readonly type = DynamicConfigErrorType.DynamicConfigMissingLoader
    constructor(type: string) {
        super(`No loader for file type[${type}].`)
    }
}

export class DynamicConfigInvalidObject extends Error {
    public readonly type = DynamicConfigErrorType.DynamicConfigInvalidObject
    constructor(key: string) {
        super(`Object does not match expected schema[${key}].`)
    }
}

export class DynamicConfigInvalidType extends Error {
    public readonly type = DynamicConfigErrorType.DynamicConfigInvalidType
    constructor(key: string, type: string) {
        super(`Value for key[${key}] cannot parse as expected type[${type}]`)
    }
}

export class DynamicConfigInvalidResolver extends Error {
    public readonly type = DynamicConfigErrorType.DynamicConfigInvalidResolver
    constructor(type: string) {
        super(`Requested resolver type[${type}] is invalid.`)
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
        super(
            `Unable to retrieve key: ${key}. Hashicorp Vault is not configured.`,
        )
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
        super(
            `Unable to retrieve key: ${key}. Hashicorp Consul is not configured.`,
        )
    }
}

export class ConsulFailed extends Error {
    public readonly type = DynamicConfigErrorType.ConsulFailed
    constructor(key: string, message?: string) {
        super(
            `Unable to retrieve key[${key}] from Consul. Consul failed with error: ${message}.`,
        )
    }
}

export class ResolverUnavailable extends Error {
    public readonly type = DynamicConfigErrorType.ResolverUnavailable
    constructor(key: string) {
        super(`Unable to retrieve key[${key}]. No resolver found.`)
    }
}

export class InvalidCharacter extends Error {
    public readonly type = DynamicConfigErrorType.InvalidCharacter
    constructor(char: string) {
        super(
            `Environment variable must contain only characters A-Z and '_', found '${char}'`,
        )
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

export class MissingPackageProperty extends Error {
    public readonly type = DynamicConfigErrorType.MissingPackageProperty
    constructor(key: string) {
        super(`Unable to retrieve key[${key}] from package.json.`)
    }
}
