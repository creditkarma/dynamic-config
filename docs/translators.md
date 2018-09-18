## Translators

When data is loaded from a local file or remote source it is parsed, usually `JSON.parse`, and then added to the resolved config object that you request values from. Sometimes, particularly when dealing with remote sources, the data coming in may not be exactly the shape you want, or it may be somewhat unreliable. Translators allow you to rewrite this data before it is added to the resolved config.

As a concrete example of this we will look at environment variables. A config placeholder, as we've seen earlier, is an object that looks something like this:

```json
{
    "host": {
        "_source": "env",
        "_key": "HOSTNAME"
    }
}
```

However, in your config, you will more often want to write something like this:

```json
{
    "destination": "http://${HOSTNAME}:9000"
}
```

The `envTranslator` bundled with dynamic config will look at this and replace `${HOSTNAME}` with the environment variable `HOSTNAME` before inserting the value into the resolved config object.

### Default Values

When using the `envTranslator` you can also provide an inline default value for when the environment variable is missing. This is done with the double pipe `||` operator.

```json
{
    "destination": "http://${HOSTNAME||localhost}:9000"
}
```

In this case `localhost` will be used if `HOSTNAME` is not found in the current environment.
