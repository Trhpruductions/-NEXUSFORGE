declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        username: string;
        email: string;
        appRole?: "USER" | "MODERATOR" | "ADMIN" | "EXEC" | "OWNER";
        /** The access token's id, so a request can be matched to its own socket. */
        jti?: string;
      };
    }
  }
}

export {};
