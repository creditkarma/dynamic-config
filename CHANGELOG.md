# Change Log

All notable changes to this project will be documented in this file.
See [Conventional Commits](https://conventionalcommits.org) for commit guidelines.

<a name="0.8.0"></a>
## [0.8.0](https://github.com/creditkarma/dynamic-config/compare/v0.7.18...v0.8.0) (2018-09-18)

### Features

* Allow defining optional config keys ([662ca0](https://github.com/creditkarma/dynamic-config/pull/31/commits/662ca0bc45aa0388653aa0785f7d54a9bf4c691c))

If a key is defined as `nullable` calls to `get` will not reject if the key cannot be found and no errors will be logged. Instead `null` is returned as the expected value.

```json
{
    "optional-key": {
        "_source": "env",
        "_key": "OPTIONAL_KEY",
        "_nullable": true
    }
}
```
