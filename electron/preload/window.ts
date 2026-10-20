import { exposeElectron } from './bridge';

// Every other renderer preload exposes only `electron`.
exposeElectron();
