declare module 'socket.io' {
  export class Server {
    constructor(server?: any, opts?: any);
    to(room: string): any;
    emit(event: string, ...args: any[]): any;
    on(event: string, listener: (...args: any[]) => void): any;
    close(): any;
  }
  export default Server;
}
