import "socket.io";

declare module "socket.io" {
  interface Socket {
    data: {
      user: {
        id: string;
        username: string;
        email: string;
      };
    };
  }
}
