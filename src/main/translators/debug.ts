import {
    IConfigTranslator,
} from '../types'

export const debugTranslator: IConfigTranslator = {
    translate(configValue: any): any {
        console.log(`Running translator for: `, configValue)
        return configValue
    },
}
