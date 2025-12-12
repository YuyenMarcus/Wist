import os
from supabase import create_client, Client


class SupabasePipeline:
    def open_spider(self, spider):
        url = os.environ.get("SUPABASE_URL")
        key = os.environ.get("SUPABASE_KEY")
        if url and key:
            self.supabase: Client = create_client(url, key)
        else:
            self.supabase = None


    def process_item(self, item, spider):
        if self.supabase:
            try:
                # 👇 CLEANING STEP: Only send columns that actually exist in Supabase
                # (Adjust this list if you added more columns to your table!)
                clean_data = {
                    'title': item.get('title'),
                    'price': item.get('price'),
                    'image': item.get('image'),
                    'url': item.get('url')
                    # We EXCLUDE 'priceRaw', 'currency', 'description' to prevent errors
                }

                self.supabase.table("products").insert(clean_data).execute()
                spider.logger.info(f"✨ Saved to Supabase: {clean_data['title']}")
            except Exception as e:
                # This will print the EXACT reason why it failed
                spider.logger.error(f"❌ DATABASE ERROR: {e}")
        return item

