# QueueStorm Backend

## Running TypeScript

Use the local TypeScript runner from this project:

```powershell
npm run dev
```

Run any TypeScript file:

```powershell
npm run ts -- src/lib/auth.ts
```

Check the project:

```powershell
npm run check
```

Build and run compiled JavaScript:

```powershell
npm run build
npm start
```

Do not run TypeScript files with plain `node`, because Node runs JavaScript. Use `tsx` through the npm scripts above.

In this ESM project, relative TypeScript imports must include `.js`:

```ts
import { prisma } from "./prisma.js";
```
