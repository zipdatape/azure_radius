# Azure RADIUS Server

[![Docker](https://img.shields.io/badge/Docker-Ready-blue.svg)](https://www.docker.com/)
[![Azure](https://img.shields.io/badge/Azure-AD%20Integration-blue.svg)](https://azure.microsoft.com/)
[![RADIUS](https://img.shields.io/badge/Protocol-RADIUS-orange.svg)](https://tools.ietf.org/html/rfc2865)

Un servidor RADIUS moderno y escalable que se integra con Azure Active Directory para autenticación de usuarios. Soporta múltiples dominios, validación de credenciales híbrida y está optimizado para trabajar con FortiGate y otros dispositivos de red.

## 🚀 Características Principales

- ✅ **Integración con Azure AD**: Autenticación usando Microsoft Graph API
- ✅ **Soporte Multi-Dominio**: Configuración de múltiples dominios permitidos
- ✅ **Validación Híbrida**: Combina validación de usuarios con verificación de credenciales
- ✅ **Rate Limiting**: Protección contra ataques de fuerza bruta
- ✅ **Cache Inteligente**: Cache de validaciones exitosas para mejorar rendimiento
- ✅ **Logging Detallado**: Logs estructurados con Winston
- ✅ **Docker Ready**: Contenedorización completa con Docker Compose
- ✅ **MySQL Integration**: Base de datos para almacenamiento de datos
- ✅ **MFA Support**: Manejo básico de usuarios con Multi-Factor Authentication

## 📋 Requisitos Previos

### Software Requerido
- **Docker** (versión 20.10 o superior)
- **Docker Compose** (versión 1.29 o superior)
- **Git** (para clonar el repositorio)
- **Bash** (para ejecutar el script de configuración)

### Cuenta de Azure AD
- **Tenant ID** de Azure Active Directory
- **Application Registration** con permisos de aplicación
- **Client ID** y **Client Secret** de la aplicación
- **RADIUS Server ID** generado en Azure

### Permisos de Azure AD
La aplicación registrada debe tener los siguientes permisos:
- `User.Read.All` (Application)
- `Directory.Read.All` (Application)

## 🛠️ Instalación Rápida

### Opción 1: Script Automático (Recomendado)

```bash
# Clonar el repositorio
git clone https://github.com/De0xyS3/azure_radius.git
cd azure_radius

# Hacer ejecutable el script
chmod +x setup_radius.sh

# Ejecutar el script de configuración
sudo ./setup_radius.sh
```

El script automático:
- ✅ Instala Docker y Docker Compose si no están presentes
- ✅ Configura MySQL automáticamente
- ✅ Solicita toda la información necesaria de Azure
- ✅ Permite configurar múltiples dominios
- ✅ Crea y configura todos los archivos necesarios
- ✅ Inicia los servicios automáticamente

### Opción 2: Configuración Manual

```bash
# 1. Clonar el repositorio
git clone https://github.com/De0xyS3/azure_radius.git
cd azure_radius

# 2. Crear archivo .env
cp .env.example .env
# Editar .env con tus credenciales de Azure

# 3. Construir y ejecutar
docker-compose up -d
```

## ⚙️ Configuración

### Variables de Entorno

Crea un archivo `.env` con las siguientes variables:

```env
# Azure AD Configuration
AZURE_TENANT_ID=your-tenant-id
AZURE_CLIENT_ID=your-client-id
AZURE_CLIENT_SECRET=your-client-secret
RADIUS_SERVER_ID=your-radius-server-id

# RADIUS Configuration
RADIUS_SECRET=your-radius-secret
PORT=1812

# Database Configuration
DB_HOST=radius-mysql
DB_PORT=3306
DB_NAME=radius_user
DB_USER=radiususer
DB_PASSWORD=your-db-password

# Domain Configuration
ALLOWED_DOMAINS=globalhitss.com,otrodominio.com

# Debug Configuration
DEBUG=*
```

### Configuración de Dominios

#### Un Solo Dominio
```env
ALLOWED_DOMAINS=contoso.com
```

#### Múltiples Dominios
```env
ALLOWED_DOMAINS=contoso.com,otrodominio.com,tercerdominio.com
```

### Configuración de Azure AD

#### 1. Registrar Aplicación en Azure AD
1. Ve a [Azure Portal](https://portal.azure.com)
2. Navega a **Azure Active Directory** → **App registrations**
3. Haz clic en **New registration**
4. Completa la información:
   - **Name**: `RADIUS Server`
   - **Supported account types**: `Accounts in this organizational directory only`
   - **Redirect URI**: Deja vacío

#### 2. Configurar Permisos
1. Ve a **API permissions**
2. Haz clic en **Add a permission**
3. Selecciona **Microsoft Graph**
4. Selecciona **Application permissions**
5. Agrega:
   - `User.Read.All`
   - `Directory.Read.All`
6. Haz clic en **Grant admin consent**

#### 3. Crear Client Secret
1. Ve a **Certificates & secrets**
2. Haz clic en **New client secret**
3. Agrega descripción y selecciona expiración
4. **Copia el valor** (solo se muestra una vez)

#### 4. Obtener IDs
- **Tenant ID**: En **Overview** de la aplicación
- **Client ID**: En **Overview** de la aplicación
- **Client Secret**: El valor copiado en el paso anterior

## 🔧 Configuración de FortiGate

### Configuración Básica
```fortios
config user radius
    edit "Azure-RADIUS"
        set server "IP-DEL-SERVIDOR-RADIUS"
        set secret "TU-RADIUS-SECRET"
        set port 1812
        set auth-type auto
    next
end
```

### Configuración de Política
```fortios
config firewall policy
    edit 1
        set name "VPN-Policy"
        set srcintf "port1"
        set dstintf "port2"
        set srcaddr "all"
        set dstaddr "all"
        set action accept
        set schedule "always"
        set service "ALL"
        set groups "Azure-RADIUS-Group"
        set ssl-ssh-profile "certificate-inspection"
    next
end
```

## 📊 Monitoreo y Logs

### Ver Logs del Servidor
```bash
# Ver logs en tiempo real
docker logs -f nombre-contenedor-radius

# Ver logs de los últimos 100 eventos
docker logs --tail 100 nombre-contenedor-radius

# Ver logs con timestamps
docker logs -t nombre-contenedor-radius
```

### Logs Importantes
- `✅ credentials valid`: Autenticación exitosa
- `❌ validation failed`: Error de autenticación
- `Rate limited`: Usuario bloqueado por intentos fallidos
- `Domain not allowed`: Dominio no permitido

### Métricas de Rendimiento
```bash
# Ver estadísticas del contenedor
docker stats nombre-contenedor-radius

# Ver uso de recursos
docker system df
```

## 🔍 Troubleshooting

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
**Solución**: Verificar que se haya dado consentimiento de administrador a los permisos.

#### 3. Dominio No Permitido
```
Domain not allowed for username: usuario@dominioinvalido.com
```
**Solución**: Agregar el dominio a `ALLOWED_DOMAINS` en el archivo `.env`.

#### 4. Rate Limiting
```
Rate limited authentication attempt for usuario@dominio.com
```
**Solución**: Esperar 5 minutos o revisar si hay intentos de ataque.

#### 5. Puerto en Uso
```
Error: port is already allocated
```
**Solución**: Cambiar el puerto en la variable `PORT` del archivo `.env`.

### Comandos de Diagnóstico

```bash
# Verificar conectividad con Azure
docker exec nombre-contenedor-radius node -e "
const { ClientSecretCredential } = require('@azure/identity');
const credential = new ClientSecretCredential(
  process.env.AZURE_TENANT_ID,
  process.env.AZURE_CLIENT_ID,
  process.env.AZURE_CLIENT_SECRET
);
console.log('Credenciales válidas');
"

# Verificar configuración del servidor
docker exec nombre-contenedor-radius cat /app/.env

# Verificar logs de MySQL
docker logs radius-mysql
```

## 🔒 Seguridad

### Mejores Prácticas

1. **Secrets Management**
   - Usa variables de entorno para credenciales
   - Rota regularmente los client secrets
   - No commits credenciales al repositorio

2. **Network Security**
   - Usa firewalls para restringir acceso
   - Configura VPN para acceso remoto
   - Monitorea logs de acceso

3. **Azure AD Security**
   - Usa permisos mínimos necesarios
   - Revisa regularmente los permisos de aplicación
   - Habilita auditoría de Azure AD

4. **Rate Limiting**
   - El servidor incluye protección automática
   - Configura límites adicionales en FortiGate
   - Monitorea intentos de autenticación fallidos

## 📈 Escalabilidad

### Configuración para Producción

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
          memory: 2G
        reservations:
          cpus: '1'
          memory: 1G
    networks:
      - app-network
    volumes:
      - radius_logs:/app/logs
      - radius_cache:/app/cache

  mysql:
    image: mysql:8.0
    container_name: radius-mysql-prod
    environment:
      MYSQL_ROOT_PASSWORD: ${MYSQL_ROOT_PASSWORD}
      MYSQL_DATABASE: ${DB_NAME}
      MYSQL_USER: ${DB_USER}
      MYSQL_PASSWORD: ${DB_PASSWORD}
    volumes:
      - mysql_data:/var/lib/mysql
    restart: unless-stopped
    deploy:
      resources:
        limits:
          cpus: '1'
          memory: 1G

volumes:
  radius_logs:
  radius_cache:
  mysql_data:

networks:
  app-network:
    external: true
```

### Load Balancing
Para múltiples instancias, considera usar:
- **HAProxy** para balanceo de carga
- **Redis** para cache compartido
- **MySQL Cluster** para alta disponibilidad

## 🤝 Contribución

### Cómo Contribuir

1. Fork el repositorio
2. Crea una rama para tu feature (`git checkout -b feature/nueva-funcionalidad`)
3. Commit tus cambios (`git commit -am 'Agregar nueva funcionalidad'`)
4. Push a la rama (`git push origin feature/nueva-funcionalidad`)
5. Crea un Pull Request

### Estándares de Código

- Usa ESLint para linting
- Sigue las convenciones de Node.js
- Agrega tests para nuevas funcionalidades
- Documenta cambios importantes

## 📄 Licencia

Este proyecto está bajo la Licencia MIT. Ver el archivo `LICENSE` para más detalles.

## 🆘 Soporte

### Canales de Soporte

- **Issues**: [GitHub Issues](https://github.com/De0xyS3/azure_radius/issues)
- **Documentación**: [Wiki del Proyecto](https://github.com/De0xyS3/azure_radius/wiki)
- **Discusiones**: [GitHub Discussions](https://github.com/De0xyS3/azure_radius/discussions)

### Información de Contacto

- **Autor**: De0xyS3
- **Email**: [Tu email]
- **GitHub**: [@De0xyS3](https://github.com/De0xyS3)

## 📝 Changelog

### v2.0.0 (Actual)
- ✅ Soporte multi-dominio
- ✅ Script de configuración automática
- ✅ Validación híbrida de credenciales
- ✅ Cache inteligente
- ✅ Rate limiting mejorado
- ✅ Logging estructurado

### v1.0.0
- ✅ Integración básica con Azure AD
- ✅ Soporte RADIUS estándar
- ✅ Docker containerization

---

**¿Necesitas ayuda?** Revisa la sección de [Troubleshooting](#-troubleshooting) o abre un issue en GitHub.
