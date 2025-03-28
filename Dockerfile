# Etapa 1: Construir la aplicación React
FROM node:23.9.0-alpine AS build
WORKDIR /app

# Copia los archivos de dependencias e instala
COPY package*.json ./
RUN npm install

# Copia el resto del código y compila la aplicación
COPY . .
RUN npm run build

# Etapa 2: Servir la aplicación compilada con Apache HTTP Server (httpd)
FROM httpd:alpine

# Copia la carpeta build generada a la ubicación donde httpd sirve los archivos
COPY --from=build /app/build/ /usr/local/apache2/htdocs/

# Expone el puerto 80 (interno en el contenedor)
EXPOSE 80
