import { project } from './foo'

export { project }

export const server = {
    port: 9000,
    host: 'localhost',
}

export const database = {
    username: {
        _source: 'env',
        _key: 'TEST_USERNAME',
    },
    password: {
        _source: 'env',
        _key: 'TEST_PASSWORD',
        _default: 'monkey',
    },
}
