declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        username: string;
        email: string;
        appRole?: "USER" | "MODERATOR" | "ADMIN" | "EXEC" | "OWNER";
      };
    }
  }
}

export {};
