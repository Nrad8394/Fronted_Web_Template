const BASE_URL = 'https://192.168.0.105:800';
export { BASE_URL };
// User endpoints
/**
 * Get all users or a specific user by ID.
 */
export const GET_USERS_URL = `${BASE_URL}/users/`;

/**
 * Update a specific user by ID.
 */
export const UPDATE_USER_URL = (id: number) => `${BASE_URL}/users/${id}/`;

/**
 * Register a new user.
 */
export const SIGN_UP_URL = `${BASE_URL}/register/`;

/**
 * Refresh the JWT token.
 */
export const REFRESH_TOKEN_URL = `${BASE_URL}/token/refresh/`;

/**
 * Login a user.
 */
export const LOGIN_URL = `${BASE_URL}/login/`;
/**
 * Logout a user.
 */
export const LOGOUT_URL = `${BASE_URL}/logout/`;
