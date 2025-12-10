# How to Run the Python Service - Step by Step

## Option 1: Using VS Code Terminal (Easiest)

1. **Open VS Code** in your project
2. **Open Terminal**: 
   - Press `` Ctrl + ` `` (backtick key)
   - OR go to: Terminal → New Terminal
3. **Navigate to scraper-service**:
   ```bash
   cd scraper-service
   ```
4. **Run the service**:
   ```bash
   python app.py
   ```

**You'll see the terminal output right there in VS Code!**

---

## Option 2: Using Windows PowerShell

1. **Open PowerShell**:
   - Press `Windows Key + X`
   - Select "Windows PowerShell" or "Terminal"
   - OR search "PowerShell" in Start menu

2. **Navigate to project**:
   ```powershell
   cd C:\Users\yuyen\OneDrive\Desktop\Projects\wist\scraper-service
   ```

3. **Run the service**:
   ```powershell
   python app.py
   ```

---

## Option 3: Using Command Prompt

1. **Open CMD**:
   - Press `Windows Key + R`
   - Type `cmd` and press Enter

2. **Navigate to project**:
   ```cmd
   cd C:\Users\yuyen\OneDrive\Desktop\Projects\wist\scraper-service
   ```

3. **Run the service**:
   ```cmd
   python app.py
   ```

---

## What You Should See

When you run `python app.py`, you should see:

```
============================================================
Starting Wist Scraper Service...
Using crochet to manage Scrapy reactor
Service will be available at http://0.0.0.0:5000
============================================================
 * Running on http://0.0.0.0:5000
Press CTRL+C to quit
```

**Keep this terminal window open!** This is where you'll see all the scraping logs.

---

## Then Test It

1. **Open another terminal** (or browser) for the frontend
2. Go to `http://localhost:3000`
3. Paste Amazon URL and click "Fetch"
4. **Watch the Python terminal** - you'll see the Story A/B/C output!

---

## Quick Start Command

**Copy and paste this entire block into your terminal**:

```bash
cd C:\Users\yuyen\OneDrive\Desktop\Projects\wist\scraper-service
python app.py
```

That's it! The terminal output will appear right there.

