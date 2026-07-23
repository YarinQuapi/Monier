import type { DefaultSession } from "next-auth";

// Module augmentation so `session.user.id` and `session.user.role` are
// typed everywhere NextAuth's Session type is used.
declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      role: "ADMIN" | "USER";
    } & DefaultSession["user"];
  }

  interface User {
    role: "ADMIN" | "USER";
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string;
    role: "ADMIN" | "USER";
  }
}
