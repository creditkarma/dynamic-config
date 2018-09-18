function isDebug(): boolean {
    return (
        process.env.CONFIG_DEBUG === 'true' ||
        process.env.DEBUG === 'true'
    )
}

export const log = (msg: string, data?: any) => {
    if (data !== undefined && isDebug()) {
        console.log(`[dynamic-config:info]: ${msg}: `, data)
    } else {
        console.log(`[dynamic-config:info]: ${msg}`)
    }
}

export const warn = (msg: string, data?: any) => {
    if (data !== undefined && isDebug()) {
        console.warn(`[dynamic-config:warn]: ${msg}: `, data)
    } else {
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
