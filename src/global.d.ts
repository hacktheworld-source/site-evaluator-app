declare module 'jsdom-browser' {
  export class JSDOM {
    constructor(html: string);
    window: Window;
  }
}