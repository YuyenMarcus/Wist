# Environment Variable Setup Guide

## ✅ Correct File Location

Your `.env.local` file **MUST** be in the root folder of your project:

```
C:\Users\yuyen\OneDrive\Desktop\Projects\wist\
├── .env.local          ← MUST BE HERE (same level as package.json)
├── package.json
├── next.config.js
├── app/
├── components/
└── ...
```

## 📝 File Contents

Your `.env.local` should contain:

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project-id.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

## 🔍 How to Verify

1. **Check file location in VS Code:**
   - Look at the file explorer on the left
   - Find `package.json` in the root
   - `.env.local` should be at the same level

2. **Check file name:**
   - Must be exactly `.env.local` (not `.env` or `.env.local.txt`)
   - The dot (.) at the beginning is important

3. **After creating/updating:**
   - Save the file (Ctrl+S)
   - **Restart the server** (Ctrl+C, then `npm run dev`)

## 🚨 Common Mistakes

❌ **Wrong:** `.env.local` inside the `app/` folder  
❌ **Wrong:** File named `env.local` (missing the dot)  
❌ **Wrong:** File named `.env.local.txt`  
❌ **Wrong:** Not restarting the server after changes  

✅ **Correct:** `.env.local` at root level, restart server after changes



