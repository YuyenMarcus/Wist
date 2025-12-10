# Debug Startup Issues

## If Service Won't Start

### Check 1: Import Errors

Run:
```bash
python test_service.py
```

Should show all ✅ checks. If any fail, that's the issue.

### Check 2: Settings File

Run:
```bash
python -c "from scrapy.utils.project import get_project_settings; s = get_project_settings(); print('BOT_NAME:', s.get('BOT_NAME'))"
```

Should print: `BOT_NAME: product_spider`

### Check 3: Port Already in Use

Check if port 5000 is already taken:
```bash
netstat -ano | findstr :5000
```

If something is using it, either:
- Kill that process
- Change port in `app.py` (last line: `port=5000`)

### Check 4: Run in Foreground to See Errors

Instead of background, run:
```bash
python app.py
```

This will show any error messages directly.

## Common Errors

### "ModuleNotFoundError: No module named 'spiders'"
- **Fix**: Make sure you're in `scraper-service/` directory
- **Check**: `ls spiders/` should show `__init__.py` and `product_spider.py`

### "ReactorAlreadyInstalledError"
- **Fix**: Restart Python (crochet.setup() already called)
- **Check**: Only one instance of app.py should be running

### "Address already in use"
- **Fix**: Port 5000 is taken
- **Fix**: Kill process using port 5000 or change port

## Share Terminal Output

If you see errors, please share:
1. The full error message
2. The line where it fails
3. Any stack trace


