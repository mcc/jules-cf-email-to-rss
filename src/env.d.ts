// src/env.d.ts

declare module '*.js' {
  const content: string;
  export default content;
}


declare module '*.html' {
  const content: string;
  export default content;
}
