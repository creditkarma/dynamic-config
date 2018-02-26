import { project } from './foo'

export { project }

export const database = {
    username: {
        _source: 'env',
        _key: 'TEST_USERNAME',
        _default: 'default-user',
    },
    password: {
        _source: 'env',
        _key: 'TEST_PASSWORD',
        _default: 'monkey',
    },
}
