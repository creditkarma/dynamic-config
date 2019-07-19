import * as express from 'express'
import { config } from '../../main'
;(async function startServer() {
    const port: number = await config().get('server.port')
    const app: express.Application = express()

    app.get('/control', (req, res) => {
        res.send('success')
    })

    app.listen(port, () => {
        console.log(`Express server listening on port: ${port}`)
    })
})()
