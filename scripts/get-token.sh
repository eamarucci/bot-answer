#!/bin/bash

# Script para gerar access token do Matrix a partir de usuario/senha

show_help() {
    echo "Uso: $0 [opcoes]"
    echo ""
    echo "Gera um access token do Matrix a partir de usuario e senha."
    echo ""
    echo "Opcoes:"
    echo "  -h, --host      URL do homeserver (ex: https://matrix.example.com)"
    echo "  -u, --user      Usuario completo (ex: @bot:matrix.example.com)"
    echo "  -p, --password  Senha do usuario"
    echo "  --help          Mostra esta ajuda"
    echo ""
    echo "Exemplo:"
    echo "  $0 -h https://matrix.example.com -u @bot:matrix.example.com -p minhasenha"
    echo ""
    echo "Se nenhum parametro for passado, o script vai perguntar interativamente."
}

# Valores default
HOST=""
USER=""
PASSWORD=""

# Parse argumentos
while [[ $# -gt 0 ]]; do
    case $1 in
        -h|--host)
            HOST="$2"
            shift 2
            ;;
        -u|--user)
            USER="$2"
            shift 2
            ;;
        -p|--password)
            PASSWORD="$2"
            shift 2
            ;;
        --help)
            show_help
            exit 0
            ;;
        *)
            echo "Opcao desconhecida: $1"
            show_help
            exit 1
            ;;
    esac
done

# Modo interativo se faltarem parametros
if [ -z "$HOST" ]; then
    read -p "Homeserver URL (ex: https://matrix.example.com): " HOST
fi

if [ -z "$USER" ]; then
    read -p "Usuario (ex: @bot:matrix.example.com): " USER
fi

if [ -z "$PASSWORD" ]; then
    read -s -p "Senha: " PASSWORD
    echo ""
fi

# Validacoes
if [ -z "$HOST" ] || [ -z "$USER" ] || [ -z "$PASSWORD" ]; then
    echo "Erro: Todos os campos sao obrigatorios."
    exit 1
fi

# Remove trailing slash do host
HOST="${HOST%/}"

echo ""
echo "Gerando token para $USER em $HOST..."
echo ""

# Faz a requisicao
RESPONSE=$(curl -s -XPOST \
    -H "Content-Type: application/json" \
    -d "{\"type\":\"m.login.password\", \"user\":\"$USER\", \"password\":\"$PASSWORD\"}" \
    "$HOST/_matrix/client/r0/login")

# Verifica se tem erro
if echo "$RESPONSE" | grep -q "errcode"; then
    echo "Erro ao gerar token:"
    echo "$RESPONSE" | jq . 2>/dev/null || echo "$RESPONSE"
    exit 1
fi

# Extrai o token
ACCESS_TOKEN=$(echo "$RESPONSE" | jq -r '.access_token' 2>/dev/null)
DEVICE_ID=$(echo "$RESPONSE" | jq -r '.device_id' 2>/dev/null)

if [ -z "$ACCESS_TOKEN" ] || [ "$ACCESS_TOKEN" == "null" ]; then
    echo "Erro: Nao foi possivel extrair o token."
    echo "Resposta: $RESPONSE"
    exit 1
fi

echo "Token gerado com sucesso!"
echo ""
echo "ACCESS_TOKEN=$ACCESS_TOKEN"
echo "DEVICE_ID=$DEVICE_ID"
echo ""
echo "Adicione no seu .env:"
echo "MATRIX_ACCESS_TOKEN=$ACCESS_TOKEN"
