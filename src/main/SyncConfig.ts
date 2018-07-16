import { ConfigValue, IConfigStore, IRootConfigValue } from './types'
import { ConfigUtils } from './utils'

export class SyncConfig implements IConfigStore {
    private config: IRootConfigValue

    constructor(config: IRootConfigValue) {
        this.config = config
    }

    public get<T = any>(key: string): T | null {
        const baseValue: ConfigValue | null = ConfigUtils.getConfigForKey(key, this.config)
        if (baseValue !== null) {
            return ConfigUtils.readConfigValue(baseValue)
        } else {
            return null
        }
    }

    public getAll(...args: Array<string>): Array<any> {
        return args.map((next: string) => {
            return this.get(next)
        }).map((baseValue: ConfigValue | null) => {
            if (baseValue !== null) {
                return ConfigUtils.readConfigValue(baseValue)
            } else {
                return null
            }
        })
    }

    public getWithDefault<T = any>(key: string, defaultVal: T): T {
        const configVal: T | null = this.get<T>(key)
        if (configVal !== null) {
            return configVal
        } else {
            return defaultVal
        }
    }
}
