import { createApp } from './app.factory.js';
import { ENV, type Env } from './config/env.js';

const app = await createApp();
const env = app.get<Env>(ENV);
await app.listen(env.PORT, '0.0.0.0');
console.log(`Asva API listening on http://localhost:${env.PORT}/api/v1 (docs: ${env.SWAGGER_ENABLED ? `http://localhost:${env.PORT}/api/docs` : 'disabled'})`);
