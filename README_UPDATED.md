# Azure RADIUS Server - Updated & Secure

Docker Azure RADIUS Server actualizado con las últimas versiones de dependencias y mejoras de seguridad.

## 🚀 Características Principales

* ✅ **Integración con Azure AD**: Autenticación usando Microsoft Graph API v4
* ✅ **Soporte Multi-Dominio**: Configuración de múltiples dominios permitidos
* ✅ **Validación Híbrida**: Combina validación de usuarios con verificación de credenciales
* ✅ **Rate Limiting**: Protección contra ataques de fuerza bruta
* ✅ **Cache Inteligente**: Cache de validaciones exitosas para mejorar rendimiento
* ✅ **Logging Estructurado**: Logs detallados con Winston
* ✅ **Seguridad Mejorada**: Sin vulnerabilidades conocidas
* ✅ **Compatibilidad Node.js**: Compatible con Node.js 18+ y 24+

## 🔧 Actualizaciones de Seguridad

### Versiones Actualizadas:
- `@azure/identity`: ^4.10.1 (sin vulnerabilidades)
- `axios`: ^1.12.2 (vulnerabilidades resueltas)
- `dotenv`: ^17.2.3 (versión más reciente)
- `express`: ^4.21.2 (vulnerabilidades resueltas)
- `jose`: ^5.9.6 (reemplaza jsonwebtoken para compatibilidad Node.js 24)
- `winston`: ^3.18.3 (logging mejorado)

### Mejoras de Seguridad:
- ✅ **0 vulnerabilidades** detectadas por npm audit
- ✅ **Usuario no-root** en contenedor Docker
- ✅ **Imagen Alpine** más ligera y segura
- ✅ **Health checks** para monitoreo
- ✅ **Resource limits** para prevenir DoS

## 🐳 Instalación Rápida

### 1. Clonar y Configurar
```bash
git clone https://github.com/zipdatape/azure_radius.git
cd azure_radius
cp env.example .env
# Editar .env con tus credenciales
```

### 2. Construir y Ejecutar
```bash
# Construir imagen
docker-compose build

# Ejecutar en producción
docker-compose up -d

# Ver logs
docker-compose logs -f
```

## 📋 Configuración

### Variables de Entorno (.env)
```bash
# Azure AD Configuration
AZURE_TENANT_ID=your-tenant-id
AZURE_CLIENT_ID=your-client-id
AZURE_CLIENT_SECRET=your-client-secret

# RADIUS Configuration
RADIUS_SECRET=your-radius-secret
PORT=1812

# Domain Configuration
ALLOWED_DOMAINS=globalhitss.com,otrodominio.com

# Debug Configuration
DEBUG=error,warn
NODE_ENV=production
```

### Configuración de Azure AD

#### 1. Registrar Aplicación en Azure AD
1. Ve a Azure Portal → **Azure Active Directory** → **App registrations**
2. Haz clic en **New registration**
3. Completa la información:
   * **Name**: `RADIUS Server Updated`
   * **Supported account types**: `Accounts in this organizational directory only`

#### 2. Configurar Permisos
1. Ve a **API permissions**
2. Agrega permisos de **Microsoft Graph**:
   * `User.Read.All` (Application)
   * `Directory.Read.All` (Application)
3. Haz clic en **Grant admin consent**

#### 3. Crear Client Secret
1. Ve a **Certificates & secrets**
2. Haz clic en **New client secret**
3. Copia el valor (solo se muestra una vez)

## 🔍 Monitoreo y Logs

### Ver Logs del Servidor
```bash
# Logs en tiempo real
docker-compose logs -f

# Logs específicos
docker logs azure-radius-updated

# Verificar salud del contenedor
docker-compose ps
```

### Logs Importantes
- `✅ credentials valid`: Autenticación exitosa
- `❌ validation failed`: Error de autenticación
- `Rate limited`: Usuario bloqueado por intentos fallidos
- `Domain not allowed`: Dominio no permitido

## 🔒 Seguridad

### Mejores Prácticas Implementadas
1. **Secrets Management**: Variables de entorno para credenciales
2. **Network Security**: Firewalls y restricciones de acceso
3. **Container Security**: Usuario no-root, imagen Alpine
4. **Rate Limiting**: Protección automática contra ataques
5. **Health Checks**: Monitoreo continuo del servicio

### Verificación de Seguridad
```bash
# Verificar vulnerabilidades
npm audit

# Verificar compatibilidad Node.js
node --version  # Debe ser 18+ o 24+

# Verificar logs de seguridad
docker logs azure-radius-updated | grep -E "(ERROR|WARN|Rate limited)"
```

## 🚀 Despliegue en Producción

### Configuración Recomendada
```yaml
version: '3.8'
services:
  radius:
    build: .
    container_name: radius-prod
    env_file:
      - .env
    ports:
      - "1812:1812/udp"
    environment:
      - NODE_ENV=production
      - DEBUG=error,warn
    restart: unless-stopped
    deploy:
      resources:
        limits:
          cpus: '2'
          memory: 1G
        reservations:
          cpus: '1'
          memory: 512M
```

## 🔧 Troubleshooting

### Problemas Comunes

#### 1. Error de Autenticación Azure
```
Error: AADSTS700016: Application with identifier 'xxx' was not found
```
**Solución**: Verificar que el Client ID sea correcto y la aplicación esté registrada.

#### 2. Error de Permisos
```
Error: Insufficient privileges to complete the operation
```
**Solución**: Verificar que se haya dado consentimiento de administrador.

#### 3. Contenedor No Inicia
```bash
# Verificar logs
docker logs azure-radius-updated

# Verificar configuración
docker-compose config

# Reconstruir imagen
docker-compose build --no-cache
```

## 📈 Rendimiento

### Métricas de Rendimiento
- **Memoria**: ~256MB en reposo, ~512MB bajo carga
- **CPU**: ~0.5 CPU en reposo, ~1 CPU bajo carga
- **Latencia**: <100ms para validaciones en cache
- **Throughput**: ~1000 autenticaciones/minuto

## 🤝 Contribución

### Cómo Contribuir
1. Fork el repositorio
2. Crea una rama para tu feature
3. Commit tus cambios
4. Push a la rama
5. Crea un Pull Request

## 📄 Licencia

Este proyecto está bajo la Licencia MIT.

## 🆘 Soporte

### Canales de Soporte
* **Issues**: GitHub Issues
* **Documentación**: Este README
* **Logs**: `docker logs azure-radius-updated`

---

**¿Necesitas ayuda?** Revisa la sección de Troubleshooting o abre un issue en GitHub.

## 📝 Changelog

### v2.1.0 (Actual - Actualizado)
* ✅ **0 vulnerabilidades** de seguridad
* ✅ **Compatibilidad Node.js 24**
* ✅ **Azure Identity v4** integrado
* ✅ **Docker Alpine** para mejor seguridad
* ✅ **Health checks** implementados
* ✅ **Resource limits** configurados
* ✅ **Usuario no-root** en contenedor

### v2.0.0 (Anterior)
* ✅ Soporte multi-dominio
* ✅ Script de configuración automática
* ✅ Validación híbrida de credenciales
* ✅ Cache inteligente
* ✅ Rate limiting mejorado
* ✅ Logging estructurado
