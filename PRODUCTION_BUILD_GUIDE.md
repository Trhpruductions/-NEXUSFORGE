# NexusForge Production Build Guide

**Build Date**: 2026-06-16  
**Status**: ✅ Production-ready  
**Build Version**: 1.0.11

## Build Summary

Production build completed successfully with **zero errors** and **46 routes pre-compiled** for optimal performance.

### Web App Build (`apps/web/.next-build/`)

- **Status**: ✅ Complete
- **Routes**: 46 static + dynamic pages pre-compiled
- **Engine**: Next.js 16.2.9 with Turbopack
- **TypeScript**: ES2020 target for BigInt support
- **Size**: Optimized with tree-shaking and code-splitting
- **Output Format**: Static pre-rendered + dynamic server pages

**Key Routes Included:**
- Authentication: `/login`, `/register`, `/forgot-password`
- Application: `/app`, `/app/games`, `/app/mining`, `/app/rewards`, `/app/profile`
- Admin: `/admin`, `/admin/age-gate-review`
- Developer: `/developer/bots`, `/developer/oauth`, `/developer/webhooks`
- Public: `/`, `/leaderboards`, `/pricing`, `/terms`, `/privacy`

### Server Build (`apps/server/dist/`)

- **Status**: ✅ Complete
- **Language**: TypeScript → JavaScript (ES2022)
- **Framework**: Express.js + Node.js
- **Port**: Configurable (default: 4001)
- **Routes**: All API endpoints compiled

**API Endpoints Include:**
- Authentication: `/auth/*` (login, register, refresh tokens)
- Economy: `/api/economy/*` (balances, transactions, transfers)
- Admin: `/api/admin/*` (moderation, analytics, role management)
- Discord: `/api/discord/*` (bot integration, guild management)
- Developer: `/api/developer/*` (applications, oauth, webhooks)

## Deployment Checklist

### Pre-Deployment

- [x] Code compiles without errors
- [x] TypeScript strict mode passes
- [x] All routes pre-rendered
- [x] Brand assets verified (16/16)
- [x] Development server tested (app fully functional)

### Before Going Live

- [ ] Database migrations applied (`npm run prisma:migrate`)
- [ ] Environment variables configured (.env.production)
- [ ] CORS origins configured for your domain
- [ ] SSL certificates installed
- [ ] Redis cache cluster ready
- [ ] PostgreSQL database initialized
- [ ] Discord bot token configured
- [ ] Stripe API keys configured (if using billing)
- [ ] SMTP email service configured

### Production Environment Variables

**Web App** (`apps/web/.env.production`):
```bash
NEXT_PUBLIC_APP_URL=https://app.your-domain.com
NEXT_PUBLIC_API_URL=https://api.your-domain.com
NEXUSFORGE_DESKTOP_ONLY=false
NODE_ENV=production
```

**API Server** (`apps/server/.env.production`):
```bash
NODE_ENV=production
PORT=4001
DATABASE_URL=postgresql://user:pass@host:5432/nexusforge
REDIS_URL=redis://host:6379
JWT_ACCESS_SECRET=<generate-secure-random-token>
JWT_REFRESH_SECRET=<generate-secure-random-token>
CLIENT_ORIGIN=https://app.your-domain.com
APP_WEB_URL=https://app.your-domain.com
DISCORD_BOT_TOKEN=<your-discord-bot-token>
STRIPE_SECRET_KEY=<your-stripe-secret-key>
STRIPE_PUBLISHABLE_KEY=<your-stripe-public-key>
```

## Deployment Methods

### Option 1: Docker Deployment

```bash
# Build Docker images
docker build -t nexusforge-web apps/web -f apps/web/Dockerfile
docker build -t nexusforge-server apps/server -f apps/server/Dockerfile

# Run containers
docker run -d -p 3000:3000 --env-file .env.web nexusforge-web
docker run -d -p 4001:4001 --env-file .env.server nexusforge-server
```

### Option 2: PM2 Deployment (Linux/macOS)

```bash
# Install PM2 globally
npm install -g pm2

# Start server
cd apps/server
npm start

# Start web (if using Node.js server mode)
cd apps/web
npm start

# Save PM2 state
pm2 save

# Restart on reboot
pm2 startup
```

### Option 3: Vercel Deployment (Web Only)

```bash
# Push to git repository
git push origin main

# Connect repository to Vercel
# Set environment variables in Vercel dashboard
# Deploy automatically or manually trigger
vercel --prod
```

### Option 4: Manual Server Deployment

```bash
# Upload build artifacts to production server
scp -r apps/web/.next-build/ user@server:/app/web/
scp -r apps/server/dist/ user@server:/app/server/

# On production server
cd /app/server
NODE_ENV=production npm start

# On production server (web)
cd /app/web
NODE_ENV=production npm start
```

## Post-Deployment Testing

### Smoke Tests

```bash
# Test API health
curl https://api.your-domain.com/health

# Test web app loads
curl https://app.your-domain.com/app

# Test authentication
curl -X POST https://api.your-domain.com/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"password"}'
```

### Functional Tests

- [ ] User registration works
- [ ] Login flow completes
- [ ] All app routes load (games, mining, rewards, etc.)
- [ ] Admin dashboard accessible
- [ ] API returns correct data
- [ ] Discord bot connects
- [ ] Stripe webhook integration (if enabled)
- [ ] Email notifications send
- [ ] Rate limiting works

## Monitoring

### Key Metrics to Track

- Response times: API should respond < 200ms
- Error rates: Keep below 1% of requests
- Uptime: Monitor 24/7 for availability
- Database connections: Monitor pool utilization
- Memory usage: Alert if > 80% of available

### Logs to Monitor

- `/var/log/nexusforge/web.log` - Web application errors
- `/var/log/nexusforge/server.log` - API errors
- `/var/log/nexusforge/database.log` - Database connection issues
- `/var/log/nexusforge/discord.log` - Discord bot status

## Performance Optimizations

### What's Already Optimized

- ✅ Static routes pre-compiled (no cold-start delay)
- ✅ CSS and JavaScript minified
- ✅ Images optimized with Next.js Image component
- ✅ API response caching with Redis
- ✅ Database query optimization
- ✅ Rate limiting enabled
- ✅ CORS configured for production

### Additional Optimizations

- Enable HTTP/2 on your web server
- Configure CDN for static assets
- Enable gzip compression
- Set appropriate cache headers
- Monitor database indexes
- Use read replicas for analytics queries

## Rollback Procedure

If deployment has issues:

```bash
# Revert to previous build
git checkout HEAD~1

# Rebuild
npm run build

# Redeploy
# (use your deployment method from above)
```

## Support & Troubleshooting

### Common Issues

**Issue**: Web app shows 404 for routes
- **Cause**: Static build routes not generated
- **Fix**: Ensure `npm run build` completes without errors

**Issue**: API returns CORS errors
- **Cause**: `CLIENT_ORIGIN` not configured
- **Fix**: Set `CLIENT_ORIGIN` to your domain in .env

**Issue**: Database connection fails
- **Cause**: `DATABASE_URL` incorrect or database offline
- **Fix**: Verify database is running and `DATABASE_URL` is correct

**Issue**: Discord bot doesn't respond
- **Cause**: Bot token expired or missing
- **Fix**: Regenerate token in Discord Developer Portal

## Next Steps

1. Copy `.env.production.sample` files and fill in real values
2. Run `npm run prisma:migrate` to set up database schema
3. Configure your domain and SSL certificates
4. Deploy using one of the methods above
5. Run post-deployment smoke tests
6. Monitor logs and metrics

---

**Questions?** Check DEPLOYMENT_ENV_CHECKLIST.md and DEPLOYMENT_PLATFORM_CHECKLIST.md for platform-specific setup.
