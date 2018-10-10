import { ILogger } from './types'

function isDebug(): boolean {
    return (
        process.env.CONFIG_DEBUG === 'true' ||
        process.env.DEBUG === 'true'
    )
}

export const defaultLogger: ILogger = {
    log(msg: string, data?: any) {
        if (data !== undefined && isDebug()) {
            console.log(`[dynamic-config:info]: ${msg}: `, data)
        } else {
            console.log(`[dynamic-config:info]: ${msg}`)
        }
    },

    warn(msg: string, data?: any) {
        if (data !== undefined) {
            console.warn(`[dynamic-config:warn]: ${msg}: `, data)
        } else {
            console.warn(`[dynamic-config:warn]: ${msg}`)
        }
    },

    error(msg: string, data?: any) {
        if (data !== undefined) {
            console.error(`[dynamic-config:error]: ${msg}: `, data)
        } else {
            console.error(`[dynamic-config:error]: ${msg}`)
        }
    },
}
