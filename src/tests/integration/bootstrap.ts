#!/usr/bin/env node
import { Catalog, KvStore } from '@creditkarma/consul-client'
import { VaultClient } from '@creditkarma/vault-client'
import { execSync } from 'child_process'

import * as fs from 'fs'
import * as os from 'os'
import * as path from 'path'

process.chdir(__dirname)

setTimeout(() => {
    const catalog: Catalog = new Catalog('http://localhost:8510')
    const consulClient: KvStore = new KvStore('http://localhost:8510')
    const vaultClient: VaultClient = new VaultClient({
        apiVersion: 'v1',
        protocol: 'http',
        destination: 'localhost:8210',
        tokenPath: './tmp/token',
    })

    const token: string = execSync(
        'curl http://localhost:8211/client-token',
    ).toString()

    function rootDir(): string {
        if (os.platform() === 'win32') {
            return process.cwd().split(path.sep)[0]
        } else {
            return '/'
        }
    }

    function createPath(parts: Array<string>, soFar: string): void {
        const current: string = path.join(soFar, parts[0])
        if (!fs.existsSync(current)) {
            fs.mkdirSync(current)
        }

        if (parts.length > 1) {
            createPath(parts.slice(1), current)
        }
    }

    function mkdir(dirPath: string): void {
        const parts: Array<string> = dirPath
            .split(path.sep)
            .filter((val: string) => val !== '')

        // Check for absolute path
        if (parts.length > 0 && path.isAbsolute(dirPath)) {
            createPath(parts, rootDir())
        } else if (parts.length > 0) {
            createPath(parts, process.cwd())
        }
    }

    // create directory for test token
    mkdir('./tmp')

    fs.writeFile('./tmp/token', token, (err: any) => {
        Promise.all<void | boolean>([
            catalog.registerEntity({
                Node: 'bango',
                Address: '192.168.4.19',
                Service: {
                    Service: 'test-service',
                    Address: '127.0.0.1',
                    Port: 3000,
                },
            }),
            catalog.registerEntity({
                Node: 'bango',
                Address: '192.168.4.19',
                Service: {
                    Service: 'shard-map-host-1',
                    Address: '127.0.0.1',
                    Port: 3000,
                },
            }),
            catalog.registerEntity({
                Node: 'bango',
                Address: '192.168.4.19',
                Service: {
                    Service: 'shard-map-host-2',
                    Address: '127.0.0.2',
                    Port: 4000,
                },
            }),
            catalog.registerEntity({
                Node: 'bango',
                Address: '192.168.4.19',
                Service: {
                    Service: 'shard-map-host-3',
                    Address: '127.0.0.3',
                    Port: 5000,
                },
            }),
            consulClient.set(
                { path: 'test-config-one' },
                {
                    persistedQueries: {
                        databaseLookup: {
                            username: 'testUser',
                            password: {
                                _source: 'consul',
                                _key: 'password',
                            },
                            shardedDBHostsInfo: {
                                sharding: {
                                    client: {
                                        'shard-info': {
                                            _source: 'consul',
                                            _key: 'shard-map-12',
                                        },
                                    },
                                },
                            },
                        },
                    },
                },
            ),
            consulClient.set(
                { path: 'test-config-two' },
                {
                    persistedQueries: {
                        databaseLookup: {
                            username: 'fakeUser',
                            password: {
                                _source: 'consul',
                                _key: 'missing-password',
                                _default: 'NotSoSecret',
                            },
                        },
                    },
                },
            ),
            consulClient.set(
                { path: 'test-config-three' },
                {
                    server: {
                        port: 8080,
                    },
                },
            ),
            consulClient.set(
                { path: 'shard-map-12' },
                {
                    'shard-count': 12,
                    'shard-map': [
                        {
                            'virtual-start': 0,
                            'virtual-end': 3,
                            'destination': 'consul!/shard-map-host-1?dc=dc1',
                        },
                        {
                            'virtual-start': 4,
                            'virtual-end': 7,
                            'destination': 'consul!/shard-map-host-2?dc=dc1',
                        },
                        {
                            'virtual-start': 8,
                            'virtual-end': 11,
                            'destination': 'consul!/shard-map-host-3?dc=dc1',
                        },
                    ],
                },
            ),
            consulClient.set({ path: 'password' }, 'Sup3rS3cr3t'),
            consulClient.set(
                { path: 'with-vault' },
                {
                    persistedQueries: {
                        databaseLookup: {
                            password: {
                                _source: 'vault',
                                _key: 'password',
                            },
                        },
                    },
                    'hashicorp-vault': {
                        apiVersion: 'v1',
                        protocol: 'http',
                        destination: 'localhost:8210',
                        mount: 'secret',
                        tokenPath: './tmp/token',
                    },
                },
            ),
            vaultClient.set('test-secret', 'this is a secret'),
            vaultClient.set('password', 'K1ndaS3cr3t'),
        ]).then(
            (result: any) => {
                console.log('Done populating mock data')
            },
            (failure: any) => {
                console.log('Error populating mock data: ', failure)
            },
        )
    })
}, 2000)
