declare module "cloudflare:test" {
  interface ProvidedEnv { DB: D1Database }
}
declare module "*.sql?raw" {
  const text: string;
  export default text;
}
