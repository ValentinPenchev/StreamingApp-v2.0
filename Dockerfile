# Използваме официалния готов контейнер на Puppeteer, в който има инсталиран Node.js, Chrome и ВСИЧКИ нужни Linux библиотеки
FROM ghcr.io/puppeteer/puppeteer:latest

# Задаваме работна папка в контейнера
WORKDIR /app

# Копираме файловете за зависимостите
COPY package*.json ./

# Инсталираме пакетите чисто
RUN npm install --omit=dev

# Копираме целия останал код на проекта ни
COPY . .

# Отваряме порта на приложението
EXPOSE 3000

# Стартираме сървъра
CMD ["node", "server.js"]
