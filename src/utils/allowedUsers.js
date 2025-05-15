import { query } from "./database.js"

export async function getAllowedUsers() {
  const radiusServerId = process.env.RADIUS_SERVER_ID

  // Obtener todos los usuarios permitidos para este servidor RADIUS específico
  return await query("SELECT * FROM user_radius_access WHERE radius_server_id = ?", [radiusServerId])
}

export async function isUserAllowed(username) {
  const radiusServerId = process.env.RADIUS_SERVER_ID

  // Añadir logging detallado
  console.log(`Checking if user ${username} is allowed for RADIUS server ID ${radiusServerId}`)

  // Verificar si el usuario está permitido para este servidor RADIUS específico
  const users = await query("SELECT * FROM user_radius_access WHERE user_principal_name = ? AND radius_server_id = ?", [
    username,
    radiusServerId,
  ])

  // Añadir más logging
  console.log(`Query result: Found ${users.length} matching records`)

  return users.length > 0
}

export async function addAllowedUser(user) {
  try {
    const radiusServerId = process.env.RADIUS_SERVER_ID

    // Insertar el usuario con el servidor RADIUS específico
    await query(
      "INSERT INTO user_radius_access (user_principal_name, displayName, radius_server_id) VALUES (?, ?, ?)",
      [user.userPrincipalName, user.displayName, radiusServerId],
    )

    return true
  } catch (error) {
    console.error("Error adding allowed user:", error)
    return false
  }
}

export async function removeAllowedUser(username) {
  try {
    const radiusServerId = process.env.RADIUS_SERVER_ID

    // Eliminar el usuario para este servidor RADIUS específico
    await query("DELETE FROM user_radius_access WHERE user_principal_name = ? AND radius_server_id = ?", [
      username,
      radiusServerId,
    ])

    return true
  } catch (error) {
    console.error("Error removing allowed user:", error)
    return false
  }
}
