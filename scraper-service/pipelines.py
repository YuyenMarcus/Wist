import os
from supabase import create_client, Client


class SupabasePipeline:
    def open_spider(self, spider):
        # 1. Connect to Supabase when the spider starts
        url = os.environ.get("SUPABASE_URL")
        key = os.environ.get("SUPABASE_KEY")
        
        if url and key:
            self.supabase: Client = create_client(url, key)
            spider.logger.info("✅ Connected to Supabase Pipeline")
        else:
            self.supabase = None
            spider.logger.warning("⚠️ SUPABASE_URL or SUPABASE_KEY missing! Data will NOT be saved.")


    def process_item(self, item, spider):
        # 2. Save the item (product) to the database
        if self.supabase:
            try:
                data = dict(item)
                # IMPORTANT: Ensure 'products' matches your Table Name exactly
                self.supabase.table("products").insert(data).execute()
                spider.logger.info(f"✨ Saved to Supabase: {data.get('title')}")
            except Exception as e:
                spider.logger.error(f"❌ Failed to save to Supabase: {e}")
        return item

