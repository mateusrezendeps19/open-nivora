import { exposeElectron, exposeInitConfig } from './bridge';

// .webpack/renderer/main/preload.js exposes both `electron` and `init_config`.
exposeElectron();
exposeInitConfig(process.env.APP_VERSION ?? '0.1.0');
