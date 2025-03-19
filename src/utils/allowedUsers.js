
import { query } from "./database.js"

export async function getAllowedUsers() {

  return await query("SELECT * FROM user_radius_access")
}

export async function isUserAllowed(username) {
  const users = await query("SELECT * FROM user_radius_access WHERE user_principal_name = ?", [username])
  return users.length > 0
}

export async function addAllowedUser(user) {
  await query("INSERT INTO user_radius_access (user_principal_mame, displayName) VALUES (?, ?)", [
    user.userPrincipalName,
    user.displayName,
  ])
}

export async function removeAllowedUser(username) {
  await query("DELETE FROM user_radius_access WHERE user_principal_name = ?", [username])
}


