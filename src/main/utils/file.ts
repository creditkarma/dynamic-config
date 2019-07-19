import * as fs from 'fs'
import * as path from 'path'

export function fileExists(filePath: string): Promise<void> {
    return new Promise((resolve, reject) => {
        fs.exists(filePath, (exists: boolean) => {
            if (exists) {
                resolve()
            } else {
                reject(new Error(`File[${filePath}] doesn't exists`))
            }
        })
    })
}

export function readFile(filePath: string): Promise<string> {
    return new Promise((resolve, reject) => {
        fs.readFile(filePath, (err: any, data: Buffer) => {
            if (err) {
                reject(err)
            } else {
                resolve(data.toString('utf-8'))
            }
        })
    })
}

// Should we fail if one file fails?
export function parseContent<T>(content: string): Promise<T> {
    return new Promise((resolve, reject) => {
        try {
            resolve(JSON.parse(content))
        } catch (e) {
            reject(e)
        }
    })
}

export function findFile(
    filePath: string,
    paths: Array<string>,
): string | null {
    const firstPath: string = path.resolve(process.cwd(), filePath)
    if (fs.existsSync(firstPath) && fs.statSync(firstPath).isFile) {
        return firstPath
    } else {
        for (const next of paths) {
            const nextPath: string = path.resolve(process.cwd(), next, filePath)
            if (fs.existsSync(nextPath) && fs.statSync(nextPath).isFile) {
                return nextPath
            }
        }
    }

    return null
}

export function findDir(dirName: string, paths: Array<string>): string | null {
    const firstPath: string = path.resolve(process.cwd(), dirName)
    if (fs.existsSync(firstPath) && fs.statSync(firstPath).isDirectory) {
        return firstPath
    } else {
        for (const next of paths) {
            const nextPath: string = path.resolve(process.cwd(), next, dirName)
            if (fs.existsSync(nextPath) && fs.statSync(nextPath).isDirectory) {
                return nextPath
            }
        }
    }

    return null
}
