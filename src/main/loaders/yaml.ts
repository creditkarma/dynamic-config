import * as YAML from 'yamljs'
import { IFileLoader } from '../types'

export const ymlLoader: IFileLoader = {
    type: [ 'yml', 'yaml' ],
    async load(filePath: string): Promise<object> {
        return new Promise((resolve, reject) => {
            YAML.load(filePath, (configObj: any): void => {
                resolve(configObj)
            })
        })
    },
}
