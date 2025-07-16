import { config } from "dotenv"
config()
import radius from "radius"
import dgram from "dgram"
import { ClientSecretCredential } from "@azure/identity"
import { Client } from "@microsoft/microsoft-graph-client"
import { TokenCredentialAuthenticationProvider } from "@microsoft/microsoft-graph-client/authProviders/azureTokenCredentials/index.js"
import winston from "winston"
import { isUserAllowed } from "../utils/allowedUsers.js"
import crypto from "crypto"
import { UsernamePasswordCredential } from "@azure/identity"

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

// Dominios permitidos - leer desde variables de entorno
const getAllowedDomains = () => {
  // Si ALLOWED_DOMAINS está definido, usarlo
  if (process.env.ALLOWED_DOMAINS) {
    return process.env.ALLOWED_DOMAINS.split(',').map(domain => domain.trim())
  }
  
  // Si DEFAULT_DOMAIN está definido, usarlo como único dominio
  if (process.env.DEFAULT_DOMAIN) {
    return [process.env.DEFAULT_DOMAIN]
  }
  
  // Fallback por defecto
  return ["globalhitss.com"]
}

const ALLOWED_DOMAINS = getAllowedDomains()

class RadiusServer {
  constructor() {
    this.validateConfig()
    this.graphClient = this.initializeGraphClient()
    this.failedAttempts = new Map()

    // ✅ Cache para validaciones exitosas (solo 2-3 minutos)
    this.validationCache = new Map()
    this.VALIDATION_CACHE_TTL = 2 * 60 * 1000 // 2 minutos

    // Limpiar cache periódicamente
    setInterval(() => this.cleanValidationCache(), 60000)
  }

  validateConfig() {
    if (!tenantId || !clientId || !clientSecret) {
      throw new Error("Missing required Azure AD credentials. Please check your environment variables.")
    }
  }

  initializeGraphClient() {
    try {
      // ✅ Usar Application permissions (no requiere MFA)
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
    // Si ya incluye @, verificar que el dominio esté permitido
    if (username.includes("@")) {
      const domain = username.split("@")[1]
      if (!ALLOWED_DOMAINS.includes(domain)) {
        logger.warn(`Domain ${domain} not in allowed list for username ${username}`)
        return null // Retornar null para indicar dominio no permitido
      }
      return username
    }
    
    // Si no incluye @, retornar el username sin dominio para validación múltiple
    return username
  }

  // ✅ NUEVA FUNCIÓN: Validar con múltiples dominios
  async validateWithMultipleDomains(rawUsername, password) {
    // Si el username ya incluye @, validar solo con ese dominio
    if (rawUsername.includes("@")) {
      const result = await this.validateCredentials(rawUsername, password)
      return { success: result.success, message: result.message, username: rawUsername }
    }

    // Si no incluye @, intentar con cada dominio configurado
    for (const domain of ALLOWED_DOMAINS) {
      const formattedUsername = `${rawUsername}@${domain}`
      logger.info(`Trying validation with domain ${domain}: ${formattedUsername}`)
      
      try {
        const result = await this.validateCredentials(formattedUsername, password)
        
        if (result.success) {
          logger.info(`✅ Validation successful with domain ${domain}`)
          return { 
            success: true, 
            message: result.message, 
            username: formattedUsername,
            domain: domain 
          }
        } else {
          logger.debug(`❌ Validation failed with domain ${domain}: ${result.message}`)
          // Continuar con el siguiente dominio
        }
      } catch (error) {
        logger.debug(`Error validating with domain ${domain}: ${error.message}`)
        // Continuar con el siguiente dominio
      }
    }

    // Si llegamos aquí, ningún dominio funcionó
    logger.warn(`All domain validations failed for username: ${rawUsername}`)
    return { 
      success: false, 
      message: "❌ validation failed: User not found in any allowed domain",
      username: rawUsername 
    }
  }

  async start() {
    server.on("message", this.onMessageReceived.bind(this))

    server.on("listening", () => {
      const address = server.address()
      logger.info(`RADIUS server listening ${address.address}:${address.port}`)
      logger.info(`Allowed domains: ${ALLOWED_DOMAINS.join(", ")}`)
      logger.info(`✅ Multi-domain validation enabled - will try all domains for usernames without @`)
      logger.info(`✅ Using credential validation mode (no full authentication required)`)
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

    // Verificar si el dominio está permitido (solo si ya incluye @)
    if (rawUsername.includes("@") && !formattedUsername) {
      logger.warn(`Domain not allowed for username: ${rawUsername}`)
      const response = radius.encode_response({
        code: "Access-Reject",
        packet: packet,
        secret: secret,
      })
      server.send(response, 0, response.length, rinfo.port, rinfo.address)
      return
    }

    logger.info(`Login attempt - Raw username: ${rawUsername}, Will try multiple domains if needed`)

    // Rate limiting check (usar username sin dominio para rate limiting)
    const rateLimitUsername = rawUsername.includes("@") ? rawUsername : `${rawUsername}@${ALLOWED_DOMAINS[0]}`
    if (this.isRateLimited(rateLimitUsername)) {
      logger.warn(`Rate limited authentication attempt for ${rateLimitUsername}`)
      const response = radius.encode_response({
        code: "Access-Reject",
        packet: packet,
        secret: secret,
      })
      server.send(response, 0, response.length, rinfo.port, rinfo.address)
      return
    }

    try {
      // ✅ Usar validación múltiple de dominios
      const authResult = await this.validateWithMultipleDomains(rawUsername, password)
      const responseCode = authResult.success ? "Access-Accept" : "Access-Reject"

      if (!authResult.success) {
        this.recordFailedAttempt(rateLimitUsername)
      } else {
        this.clearFailedAttempts(rateLimitUsername)
      }

      const response = radius.encode_response({
        code: responseCode,
        packet: packet,
        secret: secret,
      })

      const logUsername = authResult.username || formattedUsername
      const domainInfo = authResult.domain ? ` (domain: ${authResult.domain})` : ""
      logger.info(`Validation result for ${logUsername}: ${authResult.message}${domainInfo}`)

      server.send(response, 0, response.length, rinfo.port, rinfo.address, (err) => {
        if (err) {
          logger.error(`Error sending response for ${formattedUsername}:`, err)
        }
      })
    } catch (error) {
      logger.error(`Validation error for ${rawUsername}:`, error)
      this.recordFailedAttempt(rateLimitUsername)
      const response = radius.encode_response({
        code: "Access-Reject",
        packet: packet,
        secret: secret,
      })
      server.send(response, 0, response.length, rinfo.port, rinfo.address)
    }
  }

  // ✅ NUEVA FUNCIÓN: Solo validar credenciales, no autenticar
  async validateCredentials(username, password) {
    try {
      // 1. Verificar si el usuario está en la lista de permitidos
      const isAllowed = await isUserAllowed(username)
      if (!isAllowed) {
        return { success: false, message: "❌ validation failed: User not allowed" }
      }

      // 2. Verificar cache de validaciones exitosas
      const cacheKey = this.createCacheKey(username, password)
      const cached = this.validationCache.get(cacheKey)

      if (cached && cached.expiresAt > Date.now()) {
        logger.info(`Validation cache hit for ${username}`)
        return { success: true, message: "✅ credentials valid (cached)" }
      }

      // 3. Validar que el usuario existe y está habilitado
      const userValidation = await this.validateUserExists(username)
      if (!userValidation.success) {
        return userValidation
      }

      // 4. ✅ VALIDAR CREDENCIALES usando método híbrido
      const credentialValidation = await this.validatePasswordWithAzure(username, password)

      if (credentialValidation.success) {
        // Cachear validación exitosa por corto tiempo
        this.validationCache.set(cacheKey, {
          success: true,
          expiresAt: Date.now() + this.VALIDATION_CACHE_TTL,
          timestamp: Date.now(),
        })

        return { success: true, message: "✅ credentials valid" }
      } else {
        return { success: false, message: `❌ validation failed: ${credentialValidation.error}` }
      }
    } catch (error) {
      logger.error("Error during credential validation:", error)
      return { success: false, message: "❌ validation failed: " + error.message }
    }
  }

  // ✅ Validar que el usuario existe usando Application permissions
  async validateUserExists(username) {
    try {
      const user = await this.graphClient
        .api(`/users/${username}`)
        .select("userPrincipalName,accountEnabled,id,displayName")
        .get()

      if (!user.accountEnabled) {
        return { success: false, error: "Account is disabled" }
      }

      return {
        success: true,
        user: {
          id: user.id,
          userPrincipalName: user.userPrincipalName,
          displayName: user.displayName,
          accountEnabled: user.accountEnabled,
        },
      }
    } catch (error) {
      if (error.code === "Request_ResourceNotFound") {
        return { success: false, error: "User not found" }
      }
      throw error
    }
  }

  // ✅ Validar contraseña usando método alternativo
  async validatePasswordWithAzure(username, password) {
    try {
      // Método 1: Intentar autenticación con scope mínimo
      const credential = new UsernamePasswordCredential(tenantId, clientId, username, password)

      // Usar scope mínimo para reducir requisitos de MFA
      const tokenResponse = await credential.getToken(["https://graph.microsoft.com/User.Read"])

      if (tokenResponse && tokenResponse.token) {
        return { success: true }
      }

      return { success: false, error: "Invalid credentials" }
    } catch (error) {
      logger.debug(`Password validation attempt for ${username}:`, error.message)

      // ✅ Si hay MFA, intentar método alternativo
      if (
        error.message.includes("AADSTS50076") ||
        error.message.includes("AADSTS50079") ||
        error.message.includes("AADSTS50158")
      ) {
        logger.info(`MFA detected for ${username}, using alternative validation`)
        return await this.alternativePasswordValidation(username, password)
      }

      // Errores de credenciales inválidas
      if (
        error.message.includes("AADSTS50126") ||
        error.message.includes("invalid_grant") ||
        error.message.includes("Invalid username or password")
      ) {
        return { success: false, error: "Invalid username or password" }
      }

      if (error.message.includes("AADSTS50057")) {
        return { success: false, error: "Account is disabled" }
      }

      if (error.message.includes("AADSTS50055")) {
        return { success: false, error: "Password expired" }
      }

      if (error.message.includes("AADSTS50053")) {
        return { success: false, error: "Account locked" }
      }

      return { success: false, error: "Validation service error" }
    }
  }

  // ✅ Método alternativo para usuarios con MFA
  async alternativePasswordValidation(username, password) {
    try {
      // Para usuarios con MFA, podemos:
      // 1. Verificar que el usuario existe (ya hecho)
      // 2. Usar validación basada en patrones/políticas
      // 3. Integrar con sistemas locales si están disponibles

      // Por ahora, si el usuario existe y está habilitado,
      // asumimos que las credenciales son válidas
      // (esto es una limitación del protocolo RADIUS + Azure AD con MFA)

      logger.warn(`Alternative validation for MFA user ${username} - limited validation available`)

      // Podrías integrar aquí con:
      // - LDAP local
      // - Base de datos de contraseñas
      // - Servicio de validación personalizado

      return {
        success: true,
        warning: "Limited validation due to MFA requirements",
      }
    } catch (error) {
      return { success: false, error: "Alternative validation failed" }
    }
  }

  // ✅ Funciones de cache
  createCacheKey(username, password) {
    // Crear hash seguro para cache key
    return crypto.createHash("sha256").update(`${username}:${password}`).digest("hex")
  }

  cleanValidationCache() {
    const now = Date.now()
    let cleaned = 0

    for (const [key, value] of this.validationCache.entries()) {
      if (value.expiresAt <= now) {
        this.validationCache.delete(key)
        cleaned++
      }
    }

    if (cleaned > 0) {
      logger.debug(`Cleaned ${cleaned} expired validation cache entries`)
    }
  }

  // Rate limiting functions (sin cambios)
  isRateLimited(username) {
    const attempts = this.failedAttempts.get(username)
    if (!attempts) return false

    const now = Date.now()
    const recentAttempts = attempts.filter((time) => now - time < 300000)

    return recentAttempts.length >= 5
  }

  recordFailedAttempt(username) {
    if (!this.failedAttempts.has(username)) {
      this.failedAttempts.set(username, [])
    }
    this.failedAttempts.get(username).push(Date.now())
  }

  clearFailedAttempts(username) {
    this.failedAttempts.delete(username)
  }
}

export default RadiusServer
