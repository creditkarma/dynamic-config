export const log = (msg: string, data?: any) => {
    if (data !== undefined && process.env.CONSUL_DEBUG) {
        console.log(`[dynamic-config:info]: ${msg}: `, data)
    } else if (process.env.CONSUL_DEBUG) {
        console.log(`[dynamic-config:info]: ${msg}`)
    }
}

export const warn = (msg: string, data?: any) => {
    if (data !== undefined && process.env.CONSUL_DEBUG) {
        console.warn(`[dynamic-config:warn]: ${msg}: `, data)
    } else if (process.env.CONSUL_DEBUG) {
        console.warn(`[dynamic-config:warn]: ${msg}`)
    }
}

export const error = (msg: string, data?: any) => {
    if (data !== undefined) {
        console.error(`[dynamic-config:error]: ${msg}: `, data)
    } else {
        console.error(`[dynamic-config:error]: ${msg}`)
    }
}
