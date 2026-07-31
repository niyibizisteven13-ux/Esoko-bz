FROM node:22-bookworm-slim

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build
RUN node -e "const fs=require('fs'); if (!fs.existsSync('dist/index.html') || !fs.existsSync('dist/assets')) { throw new Error('Vite build did not produce dist/index.html and dist/assets'); }"

ENV NODE_ENV=production
ENV PORT=5173

EXPOSE 5173

VOLUME ["/app/data", "/app/uploads"]

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:' + (process.env.PORT || 5173) + '/api/health').then(r => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))"

CMD ["npm", "run", "start"]
