import { IFileLoader } from '../types'
import * as logger from '../logger'

export const jsLoader: IFileLoader = {
    type: 'js',
    async load(filePath: string): Promise<object> {
        try {
            const configObj = require(filePath)

            if (typeof configObj.default === 'object') {
                return configObj.default
            } else {
                return configObj
            }
        } catch (err) {
            if (err.message !== undefined) {
                logger.error(err.message)
            } else {
                logger.error(`Error loading file[${filePath}]`)
            }

            return {}
        }
    },
}
