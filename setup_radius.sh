#!/bin/bash

# Colores para una mejor salida
VERDE='\033[0;32m'
AMARILLO='\033[1;33m'
AZUL='\033[0;34m'
ROJO='\033[0;31m'
NC='\033[0m' # Sin Color

# Función para mostrar el estado
show_status() {
    local message=$1
    local status=$2
    printf "%-60s ${VERDE}[%s]${NC}\n" "$message" "$status"
}

# Función para mostrar mensajes de depuración
debug() {
    if [ "$DEBUG_MODE" = "true" ]; then
        echo -e "${AMARILLO}[DEBUG] $1${NC}" >&2
    fi
}

# Función simplificada para verificar si un puerto está en uso
is_port_in_use() {
    local port=$1
    local protocol=$2
    debug "Verificando si el puerto $port/$protocol está en uso..."

    # Verificar si el puerto está en uso por cualquier proceso
    if netstat -tuln | grep -q ":$port "; then
        debug "Puerto $port está en uso según netstat"
        return 0
    fi

    # Verificar si Docker está usando el puerto
    if docker ps --format "{{.Ports}}" | grep -q "$port->"; then
        debug "Puerto $port está en uso según Docker"
        return 0
    fi

    debug "Puerto $port está disponible"
    return 1
}

# Función para encontrar un puerto disponible
find_available_port() {
    local base_port=$1
    local protocol=$2
    local port=$base_port

    debug "Buscando puerto disponible a partir de $base_port/$protocol"

    # Limitar la búsqueda a 20 intentos para evitar bucles infinitos
    for i in {1..20}; do
        if is_port_in_use $port $protocol; then
            debug "Puerto $port/$protocol ya está en uso, probando siguiente"
            port=$((port + 1))
        else
            debug "Puerto $port/$protocol está disponible"
            break
        fi
    done

    echo "$port"
}

# Función para solicitar dominios
solicitar_dominios() {
    local dominios=()
    
    echo -e "\n${AZUL}=== Configuración de Dominios ===${NC}"
    echo -e "${AMARILLO}¿Deseas configurar uno o más dominios?${NC}"
    echo -e "1. Un solo dominio"
    echo -e "2. Múltiples dominios"
    echo -e "${AZUL}Selecciona una opción (1 o 2):${NC}"
    read opcion_dominio
    
    case $opcion_dominio in
        1)
            echo -e "${AZUL}Ingrese el dominio por defecto (ej: contoso.com):${NC}"
            read dominio
            dominios+=("$dominio")
            ;;
        2)
            echo -e "${AZUL}Ingrese el primer dominio (ej: contoso.com):${NC}"
            read dominio1
            dominios+=("$dominio1")
            
            echo -e "${AZUL}¿Desea agregar otro dominio? (s/n):${NC}"
            read continuar
            
            while [[ $continuar == "s" || $continuar == "S" ]]; do
                echo -e "${AZUL}Ingrese el siguiente dominio:${NC}"
                read siguiente_dominio
                dominios+=("$siguiente_dominio")
                
                echo -e "${AZUL}¿Desea agregar otro dominio? (s/n):${NC}"
                read continuar
            done
            ;;
        *)
            echo -e "${ROJO}Opción inválida. Usando dominio por defecto.${NC}"
            dominios+=("globalhitss.com")
            ;;
    esac
    
    # Mostrar dominios configurados
    echo -e "\n${VERDE}Dominios configurados:${NC}"
    for i in "${!dominios[@]}"; do
        echo -e "  $((i+1)). ${dominios[$i]}"
    done
    
    # Crear variable ALLOWED_DOMAINS
    ALLOWED_DOMAINS_STR=$(IFS=','; echo "${dominios[*]}")
    echo -e "${AMARILLO}Variable ALLOWED_DOMAINS: $ALLOWED_DOMAINS_STR${NC}"
}

# Activar/desactivar modo de depuración
DEBUG_MODE="true"

clear
echo -e "${AZUL}=== Script de Configuración de Radius Automático ===${NC}\n"

# Verificar si el script se está ejecutando como root
if [ "$EUID" -ne 0 ]; then
    show_status "Verificando permisos de root" "ERROR"
    echo -e "${ROJO}Este script debe ejecutarse como root o con sudo${NC}"
    exit 1
fi
show_status "Verificando permisos de root" "OK"

# Verificar si netstat está instalado
if ! command -v netstat &> /dev/null; then
    show_status "Instalando net-tools (netstat)" "INSTALANDO"
    apt-get update > /dev/null 2>&1
    apt-get install -y net-tools > /dev/null 2>&1
    show_status "Instalando net-tools" "OK"
fi

# Verificar si Docker está instalado
if ! command -v docker &> /dev/null; then
    show_status "Verificando instalación de Docker" "INSTALANDO"
    curl -fsSL https://get.docker.com -o get-docker.sh
    sh get-docker.sh
    rm get-docker.sh
    show_status "Instalando Docker" "OK"
else
    show_status "Verificando instalación de Docker" "OK"
fi

# Verificar si Docker Compose está instalado
if ! command -v docker-compose &> /dev/null; then
    show_status "Verificando Docker Compose" "INSTALANDO"
    curl -L "https://github.com/docker/compose/releases/download/1.29.2/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
    chmod +x /usr/local/bin/docker-compose
    show_status "Instalando Docker Compose" "OK"
else
    show_status "Verificando Docker Compose" "OK"
fi

# Verificar si la carpeta docker existe, si no, crearla
if [ ! -d "docker" ]; then
    show_status "Verificando carpeta docker" "CREANDO"
    mkdir -p docker
else
    show_status "Verificando carpeta docker" "OK"
fi

# Cambiar al directorio docker
cd docker
debug "Directorio actual: $(pwd)"

# Crear la red de Docker manualmente
if ! docker network inspect app-network &> /dev/null; then
    show_status "Creando red Docker app-network" "CREANDO"
    docker network create app-network
    show_status "Red app-network creada" "OK"
else
    show_status "Verificando red Docker app-network" "OK"
fi

# Crear carpeta MySQL
show_status "Creando estructura de carpetas" "OK"
mkdir -p mysql
debug "Carpeta MySQL creada en: $(pwd)/mysql"

# Crear docker-compose.yml para MySQL
show_status "Configurando MySQL" "OK"
cat > mysql/docker-compose.yml << EOF
version: '3.8'
services:
  mysql:
    image: mysql:8.0
    container_name: radius-mysql
    environment:
      MYSQL_ROOT_PASSWORD: Rn.N9f7jvZ
      MYSQL_DATABASE: radius_user
      MYSQL_USER: radiususer
      MYSQL_PASSWORD: Rn.xN9f7jvZ
    ports:
      - "3306:3306"
    volumes:
      - mysql_data:/var/lib/mysql
    command: --default-authentication-plugin=mysql_native_password
    restart: always
    networks:
      - app-network
networks:
  app-network:
    external: true
volumes:
  mysql_data:
EOF

# Iniciar contenedor MySQL
show_status "Iniciando contenedor MySQL" "INICIANDO"
cd mysql
debug "Directorio actual para MySQL: $(pwd)"
docker-compose up -d
if [ $? -ne 0 ]; then
    show_status "Error al iniciar MySQL" "ERROR"
    exit 1
fi
show_status "Contenedor MySQL iniciado" "OK"
cd ..
debug "Volviendo al directorio: $(pwd)"

# Solicitar nombre para el contenedor radius
echo -e "\n${AZUL}Por favor, ingrese un nombre para el contenedor radius:${NC}"
read RADIUS_CONTAINER_NAME
debug "Nombre del contenedor: $RADIUS_CONTAINER_NAME"

# Encontrar un puerto disponible para RADIUS (UDP 1812)
BASE_RADIUS_PORT=1812
debug "Buscando puerto disponible a partir de $BASE_RADIUS_PORT"

# Desactivar temporalmente los mensajes de depuración para la asignación de variables
DEBUG_MODE="false"
RADIUS_PORT=$(find_available_port $BASE_RADIUS_PORT "udp")
DEBUG_MODE="true"

show_status "Puerto seleccionado para RADIUS" "$RADIUS_PORT/udp"

# Solicitar información para la integración con Azure y FortiGate
echo -e "\n${AZUL}=== Configuración para integración con Azure y FortiGate ===${NC}"
echo -e "${AMARILLO}IMPORTANTE: Para continuar, necesita crear una aplicación en Azure AD y obtener los siguientes datos:${NC}"
echo -e "  - ID de Tenant de Azure (Azure Tenant ID)"
echo -e "  - ID de Cliente de Azure (Azure Client ID)"
echo -e "  - Secreto de Cliente de Azure (Azure Client Secret)"
echo -e "  - ID de Servidor RADIUS (RADIUS Server ID)"
echo -e "  - Secreto RADIUS para FortiGate (RADIUS Secret)"
echo -e "\n${AMARILLO}Nota: El RADIUS Server ID debe generarse en Azure y el RADIUS Secret se utilizará para registrar el RADIUS en FortiGate.${NC}\n"

# Solicitar valores para Azure
echo -e "${AZUL}Ingrese el ID de Tenant de Azure (Azure Tenant ID):${NC}"
read AZURE_TENANT_ID

echo -e "${AZUL}Ingrese el ID de Cliente de Azure (Azure Client ID):${NC}"
read AZURE_CLIENT_ID

echo -e "${AZUL}Ingrese el Secreto de Cliente de Azure (Azure Client Secret):${NC}"
read AZURE_CLIENT_SECRET

echo -e "${AZUL}Ingrese el ID de Servidor RADIUS (RADIUS Server ID):${NC}"
read RADIUS_SERVER_ID

echo -e "${AZUL}Ingrese el Secreto RADIUS para FortiGate (RADIUS Secret):${NC}"
read RADIUS_SECRET

# Solicitar dominios usando la nueva función
solicitar_dominios

# Clonar el repositorio azure_radius
if [ ! -d "$RADIUS_CONTAINER_NAME" ]; then
    show_status "Clonando repositorio azure_radius" "CLONANDO"
    git clone https://github.com/De0xyS3/azure_radius.git "$RADIUS_CONTAINER_NAME"
    if [ $? -ne 0 ]; then
        show_status "Error al clonar repositorio" "ERROR"
        exit 1
    fi
    show_status "Repositorio azure_radius clonado" "OK"
else
    show_status "Verificando repositorio azure_radius" "OK"
fi

debug "Directorio del repositorio: $(pwd)/$RADIUS_CONTAINER_NAME"

# Configurar variables de entorno para azure_radius con los valores proporcionados
show_status "Configurando variables de entorno azure_radius" "OK"
cat > "$RADIUS_CONTAINER_NAME/.env" << EOF
AZURE_TENANT_ID=$AZURE_TENANT_ID
AZURE_CLIENT_ID=$AZURE_CLIENT_ID
AZURE_CLIENT_SECRET=$AZURE_CLIENT_SECRET
RADIUS_SECRET=$RADIUS_SECRET
PORT=$RADIUS_PORT
API_PORT=3001
DB_HOST=radius-mysql
DB_PORT=3306
DB_NAME=radius_user
DB_USER=radiususer
DB_PASSWORD=Rn.xN9f7jvZ
ALLOWED_DOMAINS=$ALLOWED_DOMAINS_STR
RADIUS_SERVER_ID=$RADIUS_SERVER_ID
DEBUG=*
EOF

# Configurar docker-compose.yml para azure_radius
show_status "Configurando docker-compose.yml para azure_radius" "OK"
cat > "$RADIUS_CONTAINER_NAME/docker-compose.yml" << EOF
version: '3'
services:
  radius:
    build: .
    container_name: ${RADIUS_CONTAINER_NAME}
    env_file:
      - .env
    ports:
      - "${RADIUS_PORT}:${RADIUS_PORT}/udp"
    environment:
      - AZURE_TENANT_ID=\${AZURE_TENANT_ID}
      - AZURE_CLIENT_ID=\${AZURE_CLIENT_ID}
      - AZURE_CLIENT_SECRET=\${AZURE_CLIENT_SECRET}
      - RADIUS_SECRET=\${RADIUS_SECRET}
      - PORT=\${PORT}
      - ALLOWED_DOMAINS=\${ALLOWED_DOMAINS}
      - DEBUG=*
    restart: always
    networks:
      - app-network
networks:
  app-network:
    external: true
EOF

# Iniciar contenedor radius
show_status "Iniciando contenedor radius" "INICIANDO"
cd "$RADIUS_CONTAINER_NAME"
debug "Directorio actual para Radius: $(pwd)"
docker-compose up -d
if [ $? -ne 0 ]; then
    show_status "Error al iniciar contenedor Radius" "ERROR"
    exit 1
fi
show_status "Contenedor radius iniciado" "OK"

echo -e "\n${VERDE}Configuración completada exitosamente!${NC}"
echo -e "${AMARILLO}Información de configuración:${NC}"
echo -e "  - Servicio RADIUS configurado en el puerto: ${RADIUS_PORT}/UDP"
echo -e "  - Nombre del contenedor: ${RADIUS_CONTAINER_NAME}"
echo -e "  - Secreto RADIUS para FortiGate: ${RADIUS_SECRET}"
echo -e "  - Dominios permitidos: ${ALLOWED_DOMAINS_STR}"
echo -e "\n${AMARILLO}Para configurar FortiGate, utilice:${NC}"
echo -e "  - Edite su servidor radius en fortigate e ingrese el comando set radius-port ${RADIUS_PORT} "
echo -e "  - Puerto del servidor RADIUS: ${RADIUS_PORT}"
echo -e "  - Secreto RADIUS: ${RADIUS_SECRET}"
echo -e "\n${AMARILLO}Para verificar el estado del contenedor:${NC}"
echo -e "  docker logs ${RADIUS_CONTAINER_NAME}" 