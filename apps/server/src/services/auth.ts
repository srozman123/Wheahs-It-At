import bcrypt from "bcryptjs";
import { HTTPException } from "hono/http-exception";
import { createUser, findUserByEmail, type Me } from "../db/users.js";

export const BCRYPT_COST = 10;
const UNIQUE_VIOLATION = "23505";
// Compared against when the email is unknown, so both failures take about as long.
const DUMMY_HASH = "$2b$10$cuTBRU8AqYZy9VW2xCS0fuuKzjhGBFzb0nxuORcdUPwjVF8hHDsXC";

export async function signup(name: string, email: string, password: string): Promise<Me> {
  const passwordHash = await bcrypt.hash(password, BCRYPT_COST);
  try {
    return await createUser(name, email, passwordHash);
  } catch (error) {
    if ((error as { code?: string }).code === UNIQUE_VIOLATION) {
      throw new HTTPException(409, { message: "Email already registered" });
    }
    throw error;
  }
}

export async function login(email: string, password: string): Promise<Me> {
  const user = await findUserByEmail(email);
  const valid = await bcrypt.compare(password, user?.passwordHash ?? DUMMY_HASH);
  if (!user || !valid) {
    throw new HTTPException(401, { message: "Invalid email or password" });
  }
  const { passwordHash: _passwordHash, ...me } = user;
  return me;
}
