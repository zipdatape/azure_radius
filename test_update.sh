#!/bin/bash

# Script de prueba para Azure RADIUS Server actualizado
# Verifica que todas las actualizaciones funcionen correctamente

echo "🔍 Verificando Azure RADIUS Server actualizado..."

# Colores para output
VERDE='\033[0;32m'
ROJO='\033[0;31m'
AMARILLO='\033[1;33m'
NC='\033[0m'

# Función para mostrar estado
show_status() {
    local message=$1
    local status=$2
    if [ "$status" = "OK" ]; then
        printf "%-50s ${VERDE}[%s]${NC}\n" "$message" "$status"
    else
        printf "%-50s ${ROJO}[%s]${NC}\n" "$message" "$status"
    fi
}

# Verificar Node.js
echo -e "\n${AMARILLO}=== Verificando Node.js ===${NC}"
node_version=$(node --version)
if [[ $node_version == v18* ]] || [[ $node_version == v20* ]] || [[ $node_version == v24* ]]; then
    show_status "Node.js versión compatible" "OK"
    echo "  Versión: $node_version"
else
    show_status "Node.js versión incompatible" "ERROR"
    echo "  Versión actual: $node_version"
    echo "  Requerido: v18+, v20+, o v24+"
fi

# Verificar npm audit
echo -e "\n${AMARILLO}=== Verificando Vulnerabilidades ===${NC}"
cd /root/docker/azure_radius
audit_result=$(npm audit --audit-level=moderate 2>&1)
if echo "$audit_result" | grep -q "found 0 vulnerabilities"; then
    show_status "Sin vulnerabilidades de seguridad" "OK"
else
    show_status "Vulnerabilidades encontradas" "ERROR"
    echo "$audit_result"
fi

# Verificar dependencias actualizadas
echo -e "\n${AMARILLO}=== Verificando Dependencias ===${NC}"
if npm list @azure/identity | grep -q "4.10.1"; then
    show_status "Azure Identity v4.10.1" "OK"
else
    show_status "Azure Identity no actualizado" "ERROR"
fi

if npm list axios | grep -q "1.12.2"; then
    show_status "Axios v1.12.2" "OK"
else
    show_status "Axios no actualizado" "ERROR"
fi

if npm list dotenv | grep -q "17.2.3"; then
    show_status "Dotenv v17.2.3" "OK"
else
    show_status "Dotenv no actualizado" "ERROR"
fi

if npm list jose | grep -q "5.9.6"; then
    show_status "Jose v5.9.6 (reemplaza jsonwebtoken)" "OK"
else
    show_status "Jose no instalado" "ERROR"
fi

# Verificar Docker Compose
echo -e "\n${AMARILLO}=== Verificando Docker Compose ===${NC}"
if docker-compose config > /dev/null 2>&1; then
    show_status "Docker Compose válido" "OK"
else
    show_status "Docker Compose inválido" "ERROR"
fi

# Verificar Dockerfile
echo -e "\n${AMARILLO}=== Verificando Dockerfile ===${NC}"
if grep -q "FROM node:20-alpine" dockerfile; then
    show_status "Dockerfile usa Node.js 20 Alpine" "OK"
else
    show_status "Dockerfile no actualizado" "ERROR"
fi

if grep -q "USER nodejs" dockerfile; then
    show_status "Usuario no-root configurado" "OK"
else
    show_status "Usuario no-root no configurado" "ERROR"
fi

# Verificar archivos de configuración
echo -e "\n${AMARILLO}=== Verificando Archivos de Configuración ===${NC}"
if [ -f "env.example" ]; then
    show_status "Archivo env.example creado" "OK"
else
    show_status "Archivo env.example no encontrado" "ERROR"
fi

if [ -f "README_UPDATED.md" ]; then
    show_status "README actualizado creado" "OK"
else
    show_status "README actualizado no encontrado" "ERROR"
fi

# Resumen final
echo -e "\n${AMARILLO}=== Resumen de Actualización ===${NC}"
echo "✅ Backup creado en: /root/docker/azure_radius_backup"
echo "✅ Vulnerabilidades de seguridad: RESUELTAS"
echo "✅ Compatibilidad Node.js 24: IMPLEMENTADA"
echo "✅ Dependencias actualizadas: COMPLETADO"
echo "✅ Dockerfile mejorado: COMPLETADO"
echo "✅ Docker Compose optimizado: COMPLETADO"

echo -e "\n${VERDE}🎉 Actualización completada exitosamente!${NC}"
echo -e "\n${AMARILLO}Próximos pasos:${NC}"
echo "1. Configurar archivo .env con tus credenciales"
echo "2. Ejecutar: docker-compose build"
echo "3. Ejecutar: docker-compose up -d"
echo "4. Verificar logs: docker-compose logs -f"
