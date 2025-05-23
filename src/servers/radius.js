import { config } from "dotenv"
config()
import radius from "radius"
import dgram from "dgram"
import { ClientSecretCredential } from "@azure/identity"
import { Client } from "@microsoft/microsoft-graph-client"
import { TokenCredentialAuthenticationProvider } from "@microsoft/microsoft-graph-client/authProviders/azureTokenCredentials/index.js"
import winston from "winston"
import { isUserAllowed } from "../utils/allowedUsers.js"

const server = dgram.createSocket("udp4")

// Configuración del logger
const logger = winston.createLogger({
  level: "info",
  format: winston.format.combine(winston.format.timestamp(), winston.format.json()),
  transports: [new winston.transports.Console(), new winston.transports.File({ filename: "radius.log" })],
})

const getRequiredEnvVar = (name) => {
  const value = process.env[name]
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`)
  }
  return value
}

const tenantId = getRequiredEnvVar("AZURE_TENANT_ID")
const clientId = getRequiredEnvVar("AZURE_CLIENT_ID")
const clientSecret = getRequiredEnvVar("AZURE_CLIENT_SECRET")
const secret = getRequiredEnvVar("RADIUS_SECRET")
const radiusServerId = getRequiredEnvVar("RADIUS_SERVER_ID")

// Dominio por defecto
const DEFAULT_DOMAIN = getRequiredEnvVar("DEFAULT_DOMAIN")

class RadiusServer {
  constructor() {
    this.validateConfig()
    this.graphClient = this.initializeGraphClient()
    // IMPORTANTE: Eliminar completamente el caché
    // this.tokenCache = new Map()
  }

  validateConfig() {
    if (!tenantId || !clientId || !clientSecret) {
      throw new Error("Missing required Azure AD credentials. Please check your environment variables.")
    }

    if (!radiusServerId) {
      throw new Error("Missing RADIUS_SERVER_ID environment variable.")
    }

    logger.info(`RADIUS server configured with ID: ${radiusServerId}`)
  }

  initializeGraphClient() {
    try {
      const credential = new ClientSecretCredential(tenantId, clientId, clientSecret)

      const authProvider = new TokenCredentialAuthenticationProvider(credential, {
        scopes: ["https://graph.microsoft.com/.default"],
      })

      return Client.initWithMiddleware({
        authProvider: authProvider,
      })
    } catch (error) {
      logger.error("Error initializing Graph client:", error)
      throw error
    }
  }

  formatUsername(username) {
    // Si el usuario ya incluye un dominio (@algo.com), lo dejamos como está
    if (username.includes("@")) {
      return username
    }
    // Si no incluye dominio, agregamos el dominio por defecto
    return `${username}@${DEFAULT_DOMAIN}`
  }

  async start() {
    server.on("message", this.onMessageReceived.bind(this))

    server.on("listening", () => {
      const address = server.address()
      logger.info(`RADIUS server (ID: ${radiusServerId}) listening ${address.address}:${address.port}`)
      logger.info(`Auto-appending domain @${DEFAULT_DOMAIN} for usernames without domain`)
    })

    await new Promise(() => server.bind(process.env.PORT || 1812))
  }

  async onMessageReceived(msg, rinfo) {
    const packet = radius.decode({ secret, packet: msg })

    if (packet.code !== "Access-Request") {
      logger.warn(`Unknown packet type: ${packet.code}`)
      return
    }

    const rawUsername = packet.attributes["User-Name"]
    const formattedUsername = this.formatUsername(rawUsername)
    const password = packet.attributes["User-Password"]

    logger.info(`Login attempt - Raw username: ${rawUsername}, Formatted username: ${formattedUsername}`)

    try {
      const authResult = await this.authenticateUser(formattedUsername, password)
      const responseCode = authResult.success ? "Access-Accept" : "Access-Reject"
      const response = radius.encode_response({
        code: responseCode,
        packet: packet,
        secret: secret,
      })

      logger.info(`Authentication result for ${formattedUsername}: ${authResult.message}`)

      server.send(response, 0, response.length, rinfo.port, rinfo.address, (err) => {
        if (err) {
          logger.error(`Error sending response for ${formattedUsername}:`, err)
        }
      })
    } catch (error) {
      logger.error(`Authentication error for ${formattedUsername}:`, error)
      const response = radius.encode_response({
        code: "Access-Reject",
        packet: packet,
        secret: secret,
      })
      server.send(response, 0, response.length, rinfo.port, rinfo.address)
    }
  }

  async authenticateUser(username, password) {
    try {
      // Primero, verificar si el usuario está permitido para este servidor RADIUS específico
      const isAllowed = await isUserAllowed(username)

      // Añadir logging detallado para depuración
      logger.info(
        `Checking if user ${username} is allowed for RADIUS server ID ${radiusServerId}: ${isAllowed ? "YES" : "NO"}`,
      )

      if (!isAllowed) {
        return {
          success: false,
          message: `❌ authentication failed: User not allowed for RADIUS server ID ${radiusServerId}`,
        }
      }

      // IMPORTANTE: ELIMINAR COMPLETAMENTE EL CÓDIGO DE CACHÉ
      // NO usar comentarios, eliminar el código por completo

      // Verify if the user exists in Azure AD
      const user = await this.graphClient.api(`/users/${username}`).select("userPrincipalName,accountEnabled,id").get()

      if (!user.accountEnabled) {
        return { success: false, message: "❌ authentication failed: Account is disabled" }
      }

      if (user.userPrincipalName.toLowerCase() === username.toLowerCase()) {
        // IMPORTANTE: NO almacenar en caché el resultado
        return { success: true, message: "✅ authenticated successfully" }
      }

      return { success: false, message: "❌ authentication failed: Invalid credentials" }
    } catch (error) {
      logger.error("Error during authentication:", error)
      if (error.code === "Request_ResourceNotFound") {
        return { success: false, message: "❌ authentication failed: User not found" }
      }
      return { success: false, message: "❌ authentication failed: " + error.message }
    }
  }
}

export default RadiusServer
