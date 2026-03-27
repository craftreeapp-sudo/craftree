/** @deprecated Préférez auth-client + auth-utils selon le contexte. */
export {
  signInWithGoogle,
  signOut,
  getCurrentUser,
  type SignInWithGoogleOptions,
  type SignOutOptions,
} from './auth-client';
export { isAdminEmail } from './auth-utils';
