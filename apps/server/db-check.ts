import './src/config/env.js';
import { prisma } from './src/lib/prisma.js';
prisma.$queryRawUnsafe('SELECT 1')
  .then(() => {
    console.log('DB Connected Successfully');
    process.exit(0);
  })
  .catch(err => {
    console.error('DB Connection Failed:', err);
    process.exit(1);
  });
