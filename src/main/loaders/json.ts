import { IFileLoader } from '../types'
import { FileUtils } from '../utils'

export const jsonLoader: IFileLoader = {
    type: 'json',
    async load(filePath: string): Promise<object> {
        return FileUtils.readFile(filePath).then((content: string) => {
            return FileUtils.parseContent(content)
        })
    },
}
