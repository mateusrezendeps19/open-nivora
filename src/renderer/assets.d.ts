// Vite turns an imported image into the URL it emits it at. tsconfig loads only
// the node types, not vite/client, so the module shape is declared here.
declare module '*.png' {
  const url: string;
  export default url;
}
