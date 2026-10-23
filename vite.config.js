import { defineConfig } from 'vite';
import { resolve } from 'node:path';

// Build every HTML page as an explicit entry so all routes survive deployment.
export default defineConfig({
  build: {
    rollupOptions: {
      input: {
        index: resolve(process.cwd(), 'index.html'),
        admin: resolve(process.cwd(), 'admin.html'),
        member: resolve(process.cwd(), 'member.html'),
        members: resolve(process.cwd(), 'members.html'),
        register: resolve(process.cwd(), 'register.html'),
        supabaseSetup: resolve(process.cwd(), 'supabase-setup.html'),
      },
    },
  },
});
