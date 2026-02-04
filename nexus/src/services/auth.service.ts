
import { UserModel, User } from '../models/user.model';
import { verifyPassword } from '../utils/crypto';
import { signToken, JwtPayload } from '../utils/jwt';

export class AuthService {
  static async login(username: string | undefined, password: string) {
    let user: User | undefined;
    if (username) {
      user = await UserModel.findByUsername(username.trim());
      if (!user) {
        throw new Error('Invalid credentials');
      }
    } else {
      const admin = await UserModel.findFirstAdmin();
      user = admin || await UserModel.findFirstUser();
      if (!user) {
        throw new Error('Invalid credentials');
      }
    }

    const isValid = verifyPassword(password, user.password_hash, user.salt);
    if (!isValid) {
      throw new Error('Invalid credentials');
    }

    const payload: JwtPayload = {
      userId: user.id,
      username: user.username,
      isAdmin: user.is_admin === 1
    };

    return { token: signToken(payload), user: payload };
  }

  static async register(username: string, password: string, forceAdmin = false) {
    if (await UserModel.findByUsername(username)) {
      throw new Error('Username already exists');
    }

    // Check if it's the first user by ID=1 or just count?
    // Using findById(1) assumes ID starts at 1. Postgres/SQLite usually do.
    const firstUser = await UserModel.findById(1);
    const isFirstUser = firstUser === undefined;

    const user = await UserModel.create(username, password, forceAdmin || isFirstUser);

    const payload: JwtPayload = {
      userId: user.id,
      username: user.username,
      isAdmin: user.is_admin === 1
    };

    return { token: signToken(payload), user: payload };
  }

  static async changePassword(userId: number, currentPassword: string, newPassword: string) {
    const user = await UserModel.findById(userId);
    if (!user) {
      throw new Error('User not found');
    }
    const isValid = verifyPassword(currentPassword, user.password_hash, user.salt);
    if (!isValid) {
      throw new Error('Current password is incorrect');
    }
    await UserModel.updatePassword(userId, newPassword);
  }
}
